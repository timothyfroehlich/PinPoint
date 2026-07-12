---
name: pinpoint-security
description: Security patterns, CSP nonces, input validation, auth checks, Supabase SSR patterns. Use when implementing authentication, forms, security features, or when user mentions security/validation/auth.
---

# PinPoint Security Guide

## When to Use This Skill

Use this skill when:

- Implementing authentication or authorization checks.
- Creating forms, validating user inputs, or handling FormData.
- Setting up or modifying security headers (CSP, HSTS, X-Frame-Options, etc.).
- Working with Supabase SSR authentication (Server Components, Server Actions, API routes, or Middleware).
- Implementing or modifying OAuth login/linking flows (e.g., Discord OAuth).
- Performing or verifying permission checks in pages, layouts, server actions, or client components.
- The user mentions: "security", "auth", "validation", "XSS", "CSRF", "input", "forms", "permissions", "roles", "CSP", "Discord".

---

## Quick Reference

### Critical Security Rules

1. **Permissions Go Through the Matrix (CORE-ARCH-008)**: All permission checks that gate a request or enforce authorization MUST go through `checkPermission()` / `getPermissionState()` from `~/lib/permissions/helpers` — these are pure functions, so the same helpers run in Server Components, Server Actions, and Client Components (there are no permission React hooks). Hardcoded role checks (e.g., `role === "admin"`) as auth gates are strictly forbidden. Limited role comparisons are allowed for non-gating logic — SQL/query row filtering (e.g., an `isAdmin` flag driving a `where` clause), UI display flags/badges, business-logic preconditions — but each such usage must be annotated with `// permissions-audit-allow: <reason>` so the matrix audit recognizes the exception. The matrix at `src/lib/permissions/matrix.ts` is the single source of truth and must remain perfectly synced with actual enforcement.
2. **Supabase SSR Contract (CORE-SSR-001/002)**: Use `~/lib/supabase/server`'s `createClient()` for user-scoped server work. Always call `await supabase.auth.getUser()` immediately after client creation, with **no logic in between**. Do not hand-build a user-scoped SSR client from `@supabase/supabase-js` — go through `~/lib/supabase/server`. Importing types or specific utilities from `@supabase/supabase-js` is fine, and `src/lib/supabase/admin.ts` legitimately uses `createClient` from `@supabase/supabase-js` to build the server-only, service-role admin client.
3. **Validate ALL Inputs (CORE-SEC-002)**: Use Zod for all form data and user inputs. Never trust `FormData` or query parameters without validation.
4. **CSP with Nonces (CORE-SEC-003/004)**: Dynamic nonces are generated via `middleware.ts` for script execution. Do not use `'unsafe-inline'` or `'unsafe-eval'` for scripts. Static security headers are set in `next.config.ts`.
5. **PII and Email Privacy (CORE-SEC-007)**: Email addresses are PII. Display user emails only in admin views and the user's own settings page. Everywhere else: names, "Anonymous", or roles.
6. **Host Consistency (CORE-SEC-008)**: Use `localhost` for all local URLs, config, `.env*`, and Playwright `baseURL`. Mixing `localhost` and `127.0.0.1` breaks cookies and SSR auth.

---

## 1. Authentication & Supabase SSR

### Server Client Creation (CORE-SSR-001)

Always import and use the custom client creator from `~/lib/supabase/server`. Only a small allowlist of **non-test** modules touches `@supabase/ssr` directly: `src/lib/supabase/server.ts` (the SSR wrapper itself), `src/lib/supabase/middleware.ts` (token refresh in `updateSession`), and `src/app/(auth)/auth/callback/route.ts` (custom cookie handling so OAuth tokens are written to the response). App code outside this allowlist must go through `~/lib/supabase/server`. (Tests may mock `@supabase/ssr` — e.g. `src/lib/supabase/middleware.test.ts` — which is fine.)

### Immediate `getUser` Check (CORE-SSR-002)

To prevent timing and token invalidation issues, `await supabase.auth.getUser()` must be the very next line after client instantiation.

**Correct Pattern (Server Action or Route):**

```typescript
const supabase = await createClient();
const {
  data: { user },
} = await supabase.auth.getUser(); // Called immediately!
if (!user) redirect("/login");
```

### Middleware Token Refresh (CORE-SSR-003, CORE-SSR-005)

Token refresh is managed automatically in `middleware.ts` (at the repo root — not `src/middleware.ts`) via `updateSession(request)` (implemented in `src/lib/supabase/middleware.ts`). This function invokes `supabase.auth.getUser()` to refresh expired tokens and updates response cookies for the browser.

Return the response object from `updateSession` as-is (CORE-SSR-005). Don't mutate, rewrap, or copy headers into a fresh `NextResponse` — that strips the `Set-Cookie` headers that carry refreshed session tokens, and the next request will see an anonymous user.

### CSP Authoring (CORE-SEC-003/004)

The root `middleware.ts` also sets the Content-Security-Policy. Things to know before modifying it:

- **`script-src` posture**: production is nonce-only — `'self' 'nonce-<uuid>' 'strict-dynamic'`, no host allowlist. Preview adds `https://vercel.live` and `https://challenges.cloudflare.com` for the Vercel toolbar and Turnstile widget. Never add `'unsafe-inline'` or `'unsafe-eval'`.
- **Per-request nonce**: `middleware.ts` calls `crypto.randomUUID()` and sets the nonce on `Content-Security-Policy` (`'nonce-<uuid>'`) plus an `x-nonce` response header. The `x-nonce` header is set for any inline-script use case; there is no consumer in `src/` today, so if you add an inline `<script>` you must read `x-nonce` yourself and set the `nonce` attribute.
- **Already allowlisted**: `challenges.cloudflare.com` (Turnstile CAPTCHA) — in `connect-src` and `frame-src` in both branches, and additionally in `script-src` only on preview. Supabase URL + WS URL in `connect-src`. Note `connect-src` allows both `localhost:*` and `127.0.0.1:*` in **both** branches (production included), so don't describe that as dev-only.
- **Adding a new external host**: add to the appropriate directive in the production branch first, mirror to the preview branch only if needed. Default to deny.

### Auth Callback Route (CORE-SSR-004)

The OAuth flow redirects through `src/app/(auth)/auth/callback/route.ts` which handles the code-to-session exchange (`exchangeCodeForSession`) and OTP verification (`verifyOtp`).

### Database Profile Trigger (CORE-SSR-006)

Never create user profiles manually in Server Actions. Profiles are created atomically via the `handle_new_user` SQL trigger on `auth.users` insert, ensuring compatibility with all auth methods including OAuth.

### Don't Query `auth.users` Directly (CORE-SSR-007)

Application code reads user data from `user_profiles` (mirrored from `auth.users` via the `handle_new_user` trigger). Do not write Drizzle queries or raw SQL against `auth.users` in Server Actions, services, or route handlers — the schema is internal to Supabase and can change between releases. If you need to look up an auth record by email (e.g., detecting an orphaned `auth.users` row after a trigger failure), use the Supabase Admin API: `createAdminClient().auth.admin.listUsers(...)` and filter in JS.

**Allowed exceptions:**

- Database triggers and `supabase/seed.sql`.
- Test bootstrapping (`src/test/setup/pglite.ts` and integration test fixtures, which use the `authUsers` Drizzle wrapper to seed paired `auth.users` + `user_profiles` rows).

### Server→Client Data Minimization (CORE-SEC-006)

The React Server Components payload is visible in page source — `view-source:` on any authenticated page reveals every prop passed to `"use client"` components. Map server-fetched data to a minimal shape _before_ the boundary; never pass full ORM/domain objects (`UnifiedUser`, full `user_profiles` records, raw issue rows with `reporterEmail`, etc.) as Client Component props.

Practical pattern: define a `XyzProps` interface listing only the fields the component actually uses, then build it from the full object in the Server Component. Combine with CORE-SEC-007: even authenticated users should not see other users' emails in the RSC payload outside admin views.

---

## 2. Authorization & Permissions Framework (CORE-ARCH-008)

The permissions system is defined in `src/lib/permissions/matrix.ts` (single source of truth) and checked via the pure helpers in `src/lib/permissions/helpers.ts`, which run unchanged in both server and client code.

The `permissions-audit-allow` annotation contract is **enforced**, not documentation. `scripts/audit/no-hardcoded-role-checks.sh` scans `src/` (excluding the permissions module and tests) for `role === "<role>"` comparisons and fails on any that lack `// permissions-audit-allow: <reason>` on the same line, the line directly above, or the line directly below. The audit is wired into `pnpm run check` as `audit:role-checks` — preflight will reject unannotated gates.

### Permission Helpers

Always use the following functions for permission gating and auditing:

- **Server Helpers (`src/lib/permissions/helpers.ts`)**:
  - `getAccessLevel(role)`: Resolves a database role string (or null) to an `AccessLevel` ("unauthenticated", "guest", "member", "technician", "admin").
  - `checkPermission(permissionId, accessLevel, context)`: Checks if a permission is granted. Handles conditional permissions (`'own'`, `'owner'`) using `OwnershipContext`.
  - `checkPermissions(permissionIds, accessLevel, context)`: Returns true if all permissions are granted.
  - `checkAnyPermission(permissionIds, accessLevel, context)`: Returns true if any of the permissions are granted.
  - `getGrantedPermissions(accessLevel, context)`: Retrieves list of granted permission IDs.
  - `getPermissionState(permissionId, accessLevel, context)`: Returns a discriminated union — `{ allowed: true }` or `{ allowed: false; reason: "unauthenticated" | "role" | "ownership" }`. Narrow on `allowed` before reading `reason`; it only exists on the denied branch.
  - `getPermissionDeniedReason(permissionId, accessLevel, context)`: Returns a human-readable tooltip string for disabled actions.
  - `isConditionalPermission(permissionId, accessLevel)`: Checks if a permission's matrix value is conditional (`'own'`/`'owner'`) and therefore requires `OwnershipContext` to evaluate.
  - `getRawPermissionValue(permissionId, accessLevel)`: Returns the raw matrix value (`true`, `false`, `'own'`, or `'owner'`) before ownership resolution. Use this only when you need to introspect the matrix entry itself (e.g., to choose between two UI states); for actual access decisions, always go through `checkPermission` / `getPermissionState`.
- **Client Components**: there are no permission-specific React hooks. Because the helpers above are pure (no server-only dependencies), client components call them directly — compute the `accessLevel` (`AccessLevel`) and `OwnershipContext` server-side, pass them down as props, then call `getPermissionState` / `getPermissionDeniedReason` inside the component. Keeping the derivation server-side also keeps the client payload minimal (CORE-SEC-006).

---

## 3. Discord OAuth Integration (extensible to other providers)

Discord is the only provider currently registered. The OAuth machinery (provider registry, unlink guard, callback redirect handling) is structured so additional providers can be added by appending entries to the registry, but `ProviderKey` resolves to `"discord"` today.

### Multi-Provider Registry (`src/lib/auth/providers.ts`)

Supported providers are defined in the `providers` map, which implements the `Provider` interface:

- `key`: Stable key matching Supabase (e.g., `"discord"`).
- `displayName`: User-facing name (e.g., `"Discord"`).
- `scopes`: OAuth scopes requested (e.g., `"identify email"`).
- `iconComponent`: SVG icon for the button.
- `isAvailable()`: Returns `true` if credentials (e.g., client ID and secret) exist in environment variables.

### Unlink Identity Guard (`src/lib/auth/identity-guards.ts`)

To prevent users from locking themselves out, `canUnlinkIdentity` enforces that unlinking is only allowed if the user has at least one other active login method (e.g., another provider or a password):

```typescript
export function canUnlinkIdentity(
  identities: readonly UserIdentity[],
  providerKey: ProviderKey
): UnlinkCheck;
```

### Discord Identity Mirroring

During OAuth login or linking, the callback route `src/app/(auth)/auth/callback/route.ts` invokes `syncDiscordIdentity(supabase)` to extract the Discord user ID from `getUserIdentities()` and mirror it into `user_profiles.discordUserId` in the database. `syncDiscordIdentity` is defined as an internal helper inside the callback route — it is not exported and is not callable from elsewhere.

### Dynamic Redirects

Redirect target URLs are normalized using `resolveRedirectPath` in the callback route to enforce that redirects only point to internal paths or the configured `getSiteUrl()`, preventing open redirect vulnerabilities.

---

## 4. Code Examples

### Server Action with Auth & Permission Gates

```typescript
"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "~/lib/supabase/server";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { db } from "~/server/db";
import { issues } from "~/server/db/schema";
import { eq } from "drizzle-orm";

const updateIssueSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, "Title is required"),
  severity: z.enum(["cosmetic", "minor", "major", "unplayable"]),
});

export async function updateIssueAction(formData: FormData) {
  // 1. Create client and fetch user immediately (CORE-SSR-001, CORE-SSR-002)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // 2. Fetch the user's role from the profile
  const profile = await db.query.userProfiles.findFirst({
    where: (profiles, { eq }) => eq(profiles.id, user.id),
  });
  const accessLevel = getAccessLevel(profile?.role);

  // 3. Validate form inputs (CORE-SEC-002)
  const validation = updateIssueSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    severity: formData.get("severity"),
  });
  if (!validation.success) {
    return { ok: false, error: "Invalid form input" };
  }
  const data = validation.data;

  // 4. Fetch resource for ownership context
  const issue = await db.query.issues.findFirst({
    where: eq(issues.id, data.id),
  });
  if (!issue) {
    return { ok: false, error: "Issue not found" };
  }

  // 5. Check permissions through the matrix helper (CORE-ARCH-008)
  //    checkPermission returns boolean — it resolves "own"/"owner" conditional
  //    permissions internally against the OwnershipContext. Always pass
  //    { userId, reporterId } (issues) or { userId, machineOwnerId } (machines)
  //    when the permission may be conditional; otherwise the call denies by
  //    default. For UI gating with denial-reason tooltips, prefer
  //    getPermissionState(...).allowed, which returns { allowed, reason }.
  const isAllowed = checkPermission("issues.update.reporting", accessLevel, {
    userId: user.id,
    reporterId: issue.reportedBy,
  });

  if (!isAllowed) {
    return { ok: false, error: "Unauthorized" };
  }

  // 6. Proceed with database update
  await db
    .update(issues)
    .set({
      title: data.title,
      severity: data.severity,
    })
    .where(eq(issues.id, data.id));

  return { ok: true };
}
```

### Client Component (pure helpers, no hooks)

```typescript
"use client";

import {
  getPermissionDeniedReason,
  getPermissionState,
  type OwnershipContext,
} from "~/lib/permissions/helpers";
import { type AccessLevel } from "~/lib/permissions/matrix";

interface IssueEditorProps {
  // Derived server-side and passed down — keeps the client payload minimal (CORE-SEC-006).
  accessLevel: AccessLevel;
  ownershipContext: OwnershipContext;
}

export function IssueEditor({ accessLevel, ownershipContext }: IssueEditorProps) {
  // The helpers are pure, so they run directly in the client component — no hook needed.
  const permissionState = getPermissionState(
    "issues.update.reporting",
    accessLevel,
    ownershipContext
  );
  const deniedReason = permissionState.allowed
    ? undefined
    : getPermissionDeniedReason(
        "issues.update.reporting",
        accessLevel,
        ownershipContext
      );

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        disabled={!permissionState.allowed}
        placeholder="Edit issue title..."
        className="border p-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
        title={deniedReason}
      />
      {!permissionState.allowed && deniedReason && (
        <span className="text-xs text-destructive">{deniedReason}</span>
      )}
    </div>
  );
}
```

### OAuth Linking Action

OAuth linking must redirect through `/auth/callback?next=/settings` so that `exchangeCodeForSession` persists the link state:

```typescript
export async function linkProviderAction(rawKey: string): Promise<void> {
  const result = await runLinkProvider(rawKey);
  if (!result.ok) {
    redirect(`/settings?oauth_error=${encodeURIComponent(result.code)}`);
  }
  // Redirect to Supabase authorize url
  redirect(result.value.redirectUrl);
}
```

### Input Sanitization

Don't roll a new `sanitize-html` allowlist. The codebase has a shared config — `~/lib/sanitize-html-config` exports `NON_TEXT_TAGS`, the canonical set of raw-text tags that must be stripped (covered by the test in `sanitize-html-config.test.ts`). The shared config is consumed by `src/lib/markdown.ts`, `src/lib/tiptap/render.ts`, and `src/lib/notifications/channels/email-channel.ts`.

For the common cases:

- **Markdown-from-user-input → safe HTML**: call `renderMarkdownToHtml(...)` from `~/lib/markdown` (double-sanitizes after the markdown renderer runs).
- **TipTap ProseMirror JSON → safe HTML for display**: use the renderer in `~/lib/tiptap/render` (this is what `RichTextDisplay` uses; the comment there reads "Output is double-sanitized — the renderer escapes all text").
- **Raw HTML that genuinely needs sanitization in a new place**: import `sanitizeHtml` from `sanitize-html` AND `NON_TEXT_TAGS` from `~/lib/sanitize-html-config`, and pass `nonTextTags: NON_TEXT_TAGS` alongside whatever `allowedTags`/`allowedAttributes` you need. The shared `NON_TEXT_TAGS` constant is what keeps `<script>`, `<style>`, `<textarea>`, etc. from leaking through; replicating an inline allowlist that omits it is a footgun.

---

## Security Checklist

Before deploying or merging security-sensitive changes, verify:

- [ ] **Auth Checks**: `createClient()` is immediately followed by `auth.getUser()` (CORE-SSR-002) in all Server Actions/routes.
- [ ] **Authorization**: Every action is protected using the permissions matrix via `checkPermission()` (CORE-ARCH-008). No hardcoded role gates; `pnpm run check` (`audit:role-checks`) must pass.
- [ ] **`auth.users` discipline**: No application-code queries against `auth.users` outside the sanctioned exceptions (CORE-SSR-007).
- [ ] **Server→Client minimization**: Client Component props are minimal shapes, not raw ORM rows (CORE-SEC-006).
- [ ] **Email Privacy**: User email addresses are never displayed outside of admin views or settings (CORE-SEC-007).
- [ ] **Input Validation**: All form inputs are validated using Zod (CORE-SEC-002).
- [ ] **Sanitization**: Any new sanitize-html call uses `NON_TEXT_TAGS` from `~/lib/sanitize-html-config`; prefer the existing `renderMarkdownToHtml` / tiptap renderer over rolling a new allowlist.
- [ ] **Hostnames**: No hardcoded hostnames/ports used; local dev runs strictly on `localhost` (CORE-SEC-008).
- [ ] **CSP Config**: Dynamic CSP nonce generated via root `middleware.ts` (CORE-SEC-004); no `'unsafe-inline'` for script-src; new external hosts added to the production branch by default.
- [ ] **Middleware response**: `updateSession`'s response is returned as-is (CORE-SSR-005) — no rewrap, no header copy.
- [ ] **Identities Safeguard**: Manual unlinking verifies multiple identities remain via `canUnlinkIdentity`.
- [ ] **Drizzle Migrations**: Schema updates are managed via generated SQL migrations only (CORE-ARCH-009).

---

## References

- **Security Details**: `docs/SECURITY.md`
- **Core Guidelines**: `docs/NON_NEGOTIABLES.md` (specifically `CORE-SEC-*` and `CORE-SSR-*` rules)
- **Design System Rules**: `pinpoint-design-bible`
- **Database Schema**: `src/server/db/schema.ts`
