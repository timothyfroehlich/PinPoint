---
name: pinpoint-security
description: The security choices PinPoint made that its own code does not state — which modules may touch `@supabase/ssr` directly, the CSP authoring posture and what is already allowlisted, what counts as a non-gating role comparison under the `permissions-audit-allow` contract, why a `SECURITY DEFINER` RPC returning a secret needs an in-body `auth.role()` check rather than `REVOKE`/`GRANT` alone (and which migrations to copy), the multi-provider OAuth registry and unlink guard, the shared `sanitize-html` allowlist, and the `~/lib/url` seam (`getSiteUrl` / `requireSiteUrl` / `resolveRequestUrl` / `isInternalUrl` / `getSafeRedirect`) that makes hand-rolled `process.env` URL building a bug. Use when creating a Supabase server client, writing a Server Action's auth check, a Postgres function that reads Vault, a redirect, an absolute URL in an email or webhook, a CSP change, an OAuth flow, a sanitizer, or a permission gate. The enforced rules themselves are `CORE-SEC-*` / `CORE-SSR-*` in `docs/NON_NEGOTIABLES.md`; recorded threat-model decisions are in `docs/SECURITY.md`.
---

# PinPoint Security

The enforced rules live in `docs/NON_NEGOTIABLES.md` (`CORE-SEC-*`, `CORE-SSR-*`,
`CORE-ARCH-008`) and are checked by `pnpm run check`. This skill carries only the
decisions behind them.

## Which modules may touch `@supabase/ssr` (CORE-SSR-001)

Nothing enforces this — it is a convention with a short allowlist, so it is worth
stating.

Always import and use the custom client creator from `~/lib/supabase/server`. Only a small allowlist of **non-test** modules touches `@supabase/ssr` directly: `src/lib/supabase/server.ts` (the SSR wrapper itself), `src/lib/supabase/middleware.ts` (token refresh in `updateSession`), and `src/app/(auth)/auth/callback/route.ts` (custom cookie handling so OAuth tokens are written to the response). App code outside this allowlist must go through `~/lib/supabase/server`. (Tests may mock `@supabase/ssr` — e.g. `src/lib/supabase/middleware.test.ts` — which is fine.)

`src/lib/supabase/admin.ts` legitimately builds the server-only, service-role
admin client from `@supabase/supabase-js`; importing types or specific utilities
from that package is also fine.

The `auth.users` ban (CORE-SSR-007) has one workaround worth knowing: to look up
an auth record by email — e.g. detecting an orphaned `auth.users` row after a
trigger failure — use `createAdminClient().auth.admin.listUsers(...)` and filter
in JS rather than querying the table.

## CSP authoring (CORE-SEC-003/004)

The root `middleware.ts` sets the Content-Security-Policy. Things to know before modifying it:

- **`script-src` posture**: production is nonce-only — `'self' 'nonce-<uuid>' 'strict-dynamic'`, no host allowlist. Preview adds `https://vercel.live` and `https://challenges.cloudflare.com` for the Vercel toolbar and Turnstile widget. Never add `'unsafe-inline'` or `'unsafe-eval'`.
- **Per-request nonce**: `middleware.ts` calls `crypto.randomUUID()` and sets the nonce on `Content-Security-Policy` (`'nonce-<uuid>'`) plus an `x-nonce` response header. The `x-nonce` header is set for any inline-script use case; there is no consumer in `src/` today, so if you add an inline `<script>` you must read `x-nonce` yourself and set the `nonce` attribute.
- **Already allowlisted**: `challenges.cloudflare.com` (Turnstile CAPTCHA) — in `connect-src` and `frame-src` in both branches, and additionally in `script-src` only on preview. Supabase URL + WS URL in `connect-src`. Note `connect-src` allows both `localhost:*` and `127.0.0.1:*` in **both** branches (production included), so don't describe that as dev-only.
- **Adding a new external host**: add to the appropriate directive in the production branch first, mirror to the preview branch only if needed. Default to deny.

Why `'strict-dynamic'` is there, and the gaps the header set does not cover, are
in `docs/SECURITY.md`.

## What counts as a non-gating role comparison (CORE-ARCH-008)

The `permissions-audit-allow` annotation contract is **enforced**, not documentation. `scripts/audit/no-hardcoded-role-checks.sh` scans `src/` (excluding the permissions module and tests) for `role === "<role>"` comparisons and fails on any that lack `// permissions-audit-allow: <reason>` on the same line, the line directly above, or the line directly below. The audit is wired into `pnpm run check` as `audit:role-checks` — preflight will reject unannotated gates.

The line the audit cannot draw for you: a role comparison that **gates a request
or enforces authorization** is forbidden outright and must go through
`checkPermission()` / `getPermissionState()`. Comparisons that merely _shape_
behaviour are allowed with an annotation — SQL/query row filtering (an `isAdmin`
flag driving a `where` clause), UI display flags and badges, business-logic
preconditions.

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
