---
name: pinpoint-security
description: The security choices PinPoint made that its own code does not state — which modules may touch `@supabase/ssr` directly, the CSP authoring posture and what is already allowlisted, matrix permissions vs resource-level predicates (`collections.ts`, `settings.ts`) under `src/lib/permissions/`, what counts as a non-gating role comparison under the `permissions-audit-allow` contract, why a `SECURITY DEFINER` RPC returning a secret needs an in-body `auth.role()` check rather than `REVOKE`/`GRANT` alone (and which migrations to copy), the multi-provider OAuth registry and unlink guard, the shared `sanitize-html` allowlist, and the `~/lib/url` seam (`getSiteUrl` / `requireSiteUrl` / `resolveRequestUrl` / `isInternalUrl` / `getSafeRedirect`) that makes hand-rolled `process.env` URL building a bug. Use when creating a Supabase server client, writing a Server Action's auth check, a Postgres function that reads Vault, a redirect, an absolute URL in an email or webhook, a CSP change, an OAuth flow, a sanitizer, or a permission gate. The enforced rules themselves are `CORE-SEC-*` / `CORE-SSR-*` in `docs/NON_NEGOTIABLES.md`; recorded threat-model decisions are in `docs/SECURITY.md`.
---

# PinPoint Security

The enforced rules live in `docs/NON_NEGOTIABLES.md` (`CORE-SEC-*`, `CORE-SSR-*`,
`CORE-ARCH-008`) and are checked by `pnpm run check`. This skill carries only the
decisions behind them.

## SSR client creation and allowed imports (CORE-SSR-001/002)

Nothing enforces this — it is a convention with a short allowlist, so it is worth
stating.

Always import and use the custom client creator from `~/lib/supabase/server`. Only a small allowlist of **non-test** modules touches `@supabase/ssr` directly: `src/lib/supabase/server.ts` (the SSR wrapper itself), `src/lib/supabase/middleware.ts` (token refresh in `updateSession`), and `src/app/(auth)/auth/callback/route.ts` (custom cookie handling so OAuth tokens are written to the response). App code outside this allowlist must go through `~/lib/supabase/server`. (Tests may mock `@supabase/ssr` — e.g. `src/lib/supabase/middleware.test.ts` — which is fine.)

After creating an SSR client, call `await supabase.auth.getUser()` immediately; do not run other logic between client creation and that call (CORE-SSR-002).

`src/lib/supabase/admin.ts` legitimately builds the server-only, service-role
admin client from `@supabase/supabase-js`; importing types or specific utilities
from that package is also fine.

The `auth.users` ban (CORE-SSR-007) has one workaround worth knowing: to look up
an auth record by email — e.g. detecting an orphaned `auth.users` row after a
trigger failure — use `createAdminClient().auth.admin.listUsers(...)` and filter
in JS rather than querying the table.

## CSP authoring (CORE-SEC-003/004)

The root `middleware.ts` sets the Content-Security-Policy. Things to know before modifying it:

- **`script-src` posture**: production is nonce-only — `'self' 'nonce-<uuid>' 'strict-dynamic'`, no host allowlist. Preview adds `https://vercel.live` for the Vercel toolbar. Never add `'unsafe-inline'` or `'unsafe-eval'`.
- **Per-request nonce**: `middleware.ts` calls `crypto.randomUUID()` and sets the nonce on `Content-Security-Policy` (`'nonce-<uuid>'`) plus an `x-nonce` response header. The `x-nonce` header is set for any inline-script use case; there is no consumer in `src/` today, so if you add an inline `<script>` you must read `x-nonce` yourself and set the `nonce` attribute.
- **Already allowlisted**: Supabase URL + WS URL in `connect-src`. Note `connect-src` allows both `localhost:*` and `127.0.0.1:*` in **both** branches (production included), so don't describe that as dev-only.
- **Adding a new external host**: add to the appropriate directive in the production branch first, mirror to the preview branch only if needed. Default to deny.

Why `'strict-dynamic'` is there, and the gaps the header set does not cover, are
in `docs/SECURITY.md`.

## What counts as a non-gating role comparison (CORE-ARCH-008)

The `permissions-audit-allow` annotation contract is **enforced**, not documentation. `scripts/audit/no-hardcoded-role-checks.sh` scans `src/` for `role === "<role>"` comparisons and fails on any that lack `// permissions-audit-allow: <reason>` on the same line, the line directly above, or the line directly below. The audit is wired into `pnpm run check` as `audit:role-checks` — preflight will reject unannotated gates.

**The exemption is two files, not the permissions directory.** Only `src/lib/permissions/matrix.ts` and `helpers.ts` are skipped (plus tests and `src/test/`), because a role comparison in those two _is_ the matrix implementation. Everything else under `src/lib/permissions/` is audited like any other caller — including `collections.ts`, which holds the collection access predicates. PP-vdz6 narrowed this: the glob used to be `src/lib/permissions/**`, so moving a permission helper into the directory silently bought it an exemption, which is the same blind spot that let a `viewer.role === "admin"` gate sit un-audited in the first place.

The line the audit cannot draw for you: a role comparison that **gates a request
or enforces authorization** is forbidden outright and must go through
`checkPermission()` / `getPermissionState()`. Comparisons that merely _shape_
behaviour are allowed with an annotation — non-protective UI display hints,
badges, or domain invariants that do not govern access to protected data or
capabilities. If a query row filter controls access to protected data or search
scopes (such as matching reporter or user emails), that decision is an
authorization capability and belongs under `checkPermission()`.

**`getRawPermissionValue` is introspection-only.** It returns the raw matrix
entry — `boolean | "own" | "owner" | "own_or_owner"` — so every conditional
value is truthy. Using it as a gate (`if (getRawPermissionValue(...))`) grants
access to everyone at that access level. Reach for it only to choose between
two UI states; actual access decisions go through `checkPermission()` /
`getPermissionState()`.

**There are no permission React hooks.** The helpers in
`src/lib/permissions/helpers.ts` are pure, so client components call them
directly: derive the `AccessLevel` and `OwnershipContext` server-side, pass them
down as props, then call `getPermissionState` / `getPermissionDeniedReason` in
the component. Deriving server-side also keeps the client payload minimal
(CORE-SEC-006).

### Matrix-level permissions vs. resource-level permission predicates

Authorization in PinPoint is partitioned between two complementary layers:

- **Matrix-level permissions (`matrix.ts` / `helpers.ts`)**: Model role-based capabilities and standard ownership rules across the application (e.g. `issues.create`, `machines.edit`, `collections.view.private`). `checkPermission(permission, accessLevel, context)` evaluates role levels and resolves `own`, `owner`, and `own_or_owner` against an `OwnershipContext` (`reporterId`, `machineOwnerId`). When an ownership rule fits this model, prefer extending the matrix and `OwnershipContext` so capabilities stay visible on `/help/permissions` (CORE-ARCH-008).
- **Resource-level permission predicates (`collections.ts`, upcoming `settings.ts`)**: Reserved for authorization rules depending on multi-dimensional entity state that `OwnershipContext` cannot represent—such as collaborator rosters, compound record relationships (e.g., machine owner vs settings set creator), public/private draft visibility, or capability tokens (e.g. `canViewCollection`, `canEditCollection`, `canManageCollection`, `canViewSet`, `canEditSet`).

**All permission helpers must live in `src/lib/permissions/` (CORE-ARCH-008).** Standalone permission predicates must never live scattered across feature domains (e.g., `src/lib/machines/settings-permissions.ts` being relocated to `src/lib/permissions/settings.ts` per PP-leli.5). Centralizing them in `src/lib/permissions/` ensures all authorization logic is discoverable in one place, cleanly separated from UI and data layers, and subject to audit scrutiny.

**The role dimension must use `checkPermission()`; annotations are only for non-gating logic.** As noted above, the CI role-check audit exempts only `matrix.ts` and `helpers.ts`. Resource-level predicate modules under `src/lib/permissions/` are fully audited caller code. In resource-level helpers:

- The role capability dimension (e.g., admin override or technician access) must be declared in `matrix.ts` and evaluated via `checkPermission()`, ensuring capabilities reflect on `/help/permissions` (CORE-ARCH-008).
- Entity-specific checks handle ownership and identity comparisons (`viewer.userId === ownerId`, collaborator status) directly.
- Hardcoded role comparisons must never be used as authorization gates—even inside resource-level predicate files. Any role comparison that merely shapes presentation or domain invariants without controlling access to protected data or capabilities must be explicit and tagged with `// permissions-audit-allow: <reason>`.

## OAuth providers

Discord is the only provider currently registered. The OAuth machinery (provider registry, unlink guard, callback redirect handling) is structured so additional providers can be added by appending entries to the registry, but `ProviderKey` resolves to `"discord"` today.

`canUnlinkIdentity` (`src/lib/auth/identity-guards.ts`) exists to stop users
locking themselves out: unlinking is only allowed if the user has at least one
other active login method (another provider, or a password).

Redirect target URLs in the callback route are normalized through
`resolveRedirectPath`, which enforces internal-path-or-`getSiteUrl()`. Anywhere
else that accepts a redirect target from the user, use `getSafeRedirect`.

## Site URL construction & safe redirects

**Goal**: one consistent site-URL resolution across dev, preview, and prod — and no open redirects.

Never read `process.env` and stitch a URL together by hand. Use the helpers in `~/lib/url`:

| Helper                       | Use for                                                                                                        |
| :--------------------------- | :------------------------------------------------------------------------------------------------------------- |
| `getSiteUrl()`               | The general case. Prefers `NEXT_PUBLIC_SITE_URL`, falls back to `localhost` in development.                    |
| `requireSiteUrl(action)`     | When a missing site URL should be a hard failure rather than a silent `localhost` fallback (emails, webhooks). |
| `resolveRequestUrl(headers)` | Deriving the origin from an incoming request's headers.                                                        |
| `isInternalUrl(url)`         | Type guard: is this a same-site path we're allowed to send a user to?                                          |
| `getSafeRedirect(...)`       | Normalizing a user-supplied `?redirect=` target down to an internal path. Open-redirect prevention.            |

Why it's centralized: the fallback rules differ per environment, and a hand-rolled copy silently emails users a `localhost` link from production.

**Watch for this**: the local-mock branch of `src/lib/blob/client.ts` still builds its upload URL from `process.env["NEXT_PUBLIC_SITE_URL"] ?? \`http://localhost:${port}\`` instead of calling `getSiteUrl()` — the one place in the codebase that still hand-rolls this. Don't copy it, and fold it in if you're already touching that file.

## `SECURITY DEFINER` RPCs that return a secret

**`REVOKE`/`GRANT` is not the gate. The gate is an `auth.role()` check inside the function body.**

Supabase re-grants `EXECUTE` on `public.*` functions to `authenticated` at connection time, which can undo a SQL-level `REVOKE`, and PostgREST exposes every public function as `POST /rest/v1/rpc/<name>`. A `SECURITY DEFINER` function that decrypts a Vault secret and relies only on grants is one connection-time re-grant away from handing that secret to any logged-in member.

So every such function opens with:

```sql
IF COALESCE(auth.role(), '') <> 'service_role' THEN
  RAISE EXCEPTION 'permission denied for function <name>'
    USING ERRCODE = '42501';
END IF;
```

and keeps the `REVOKE`/`GRANT` as defense in depth.

This has been learned twice the expensive way. `0028_natural_vengeance.sql` shipped `get_discord_config()` grants-only and `0029_discord_config_role_check.sql` hardened it; `0061_pinballmap_credentials_rpc.sql` then cited **0028** as its model and repeated the mistake, fixed in `0062_pinballmap_credentials_role_check.sql` (PP-rnup). **Copy 0029 or 0062 — never 0028 or 0061.** Those two are already applied and are left unedited on purpose, so their headers still point at the unhardened shape.

**Testing it needs one non-obvious step.** A test that only asserts "a member is refused" proves nothing about the guard: with the `REVOKE` intact Postgres refuses on privilege first, so the test passes against the unhardened function too. To isolate the body check, `GRANT EXECUTE ... TO authenticated` over a direct `postgres` connection first (supabase-js cannot run DDL), assert the refusal, and revoke in a `finally`. `pinballmap-credentials-rpc.test.ts` is the reference; `discord-config-rls.test.ts` still has the weaker shape.

## Input sanitization

Don't roll a new `sanitize-html` allowlist. The codebase has a shared config — `~/lib/sanitize-html-config` exports `NON_TEXT_TAGS`, the canonical set of raw-text tags that must be stripped (covered by the test in `sanitize-html-config.test.ts`). The shared config is consumed by `src/lib/markdown.ts`, `src/lib/tiptap/render.ts`, and `src/lib/notifications/channels/email-channel.ts`.

For the common cases:

- **Markdown-from-user-input → safe HTML**: call `renderMarkdownToHtml(...)` from `~/lib/markdown` (double-sanitizes after the markdown renderer runs).
- **TipTap ProseMirror JSON → safe HTML for display**: use the renderer in `~/lib/tiptap/render` (this is what `RichTextDisplay` uses; the comment there reads "Output is double-sanitized — the renderer escapes all text").
- **Raw HTML that genuinely needs sanitization in a new place**: import `sanitizeHtml` from `sanitize-html` AND `NON_TEXT_TAGS` from `~/lib/sanitize-html-config`, and pass `nonTextTags: NON_TEXT_TAGS` alongside whatever `allowedTags`/`allowedAttributes` you need. The shared `NON_TEXT_TAGS` constant is what keeps `<script>`, `<style>`, `<textarea>`, etc. from leaking through; replicating an inline allowlist that omits it is a footgun.
