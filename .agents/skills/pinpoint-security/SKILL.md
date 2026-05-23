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

1. **Permissions Go Through the Matrix (CORE-ARCH-008)**: All permission checks MUST go through `checkPermission()` (server-side) or `usePermission()` (client-side) from `~/lib/permissions/helpers` and `hooks`. Hardcoded role checks (e.g., `role === 'admin'`) are strictly forbidden. The matrix at `src/lib/permissions/matrix.ts` is the single source of truth and must remain perfectly synced with actual enforcement.
2. **Supabase SSR Contract (CORE-SSR-001/002)**: Use `~/lib/supabase/server`'s `createClient()`. Always call `await supabase.auth.getUser()` immediately after client creation, with **no logic in between**. Never import from `@supabase/supabase-js` directly on the server.
3. **Validate ALL Inputs (CORE-SEC-002)**: Use Zod for all form data and user inputs. Never trust `FormData` or query parameters without validation.
4. **CSP with Nonces (CORE-SEC-003/004)**: Dynamic nonces are generated via `middleware.ts` for script execution. Do not use `'unsafe-inline'` or `'unsafe-eval'` for scripts. Static security headers are set in `next.config.ts`.
5. **PII and Email Privacy (CORE-SEC-007)**: Email addresses are PII. Display user emails only in admin views and the user's own settings page. Everywhere else: names, "Anonymous", or roles.
6. **Host Consistency (CORE-SEC-008)**: Use `localhost` for all local URLs, config, `.env*`, and Playwright `baseURL`. Mixing `localhost` and `127.0.0.1` breaks cookies and SSR auth.

---

## 1. Authentication & Supabase SSR

### Server Client Creation (CORE-SSR-001)

Always import and use the custom client creator from `~/lib/supabase/server` (never from `@supabase/ssr` directly in app code, except in the callback route where custom cookies are written to responses).

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

### Middleware Token Refresh (CORE-SSR-003)

Token refresh is managed automatically in `middleware.ts` via `updateSession(request)` (implemented in `src/lib/supabase/middleware.ts`). This function invokes `supabase.auth.getUser()` to refresh expired tokens and updates response cookies for the browser.

### Auth Callback Route (CORE-SSR-004)

The OAuth flow redirects through `src/app/(auth)/auth/callback/route.ts` which handles the code-to-session exchange (`exchangeCodeForSession`) and OTP verification (`verifyOtp`).

### Database Profile Trigger (CORE-SSR-006)

Never create user profiles manually in Server Actions. Profiles are created atomically via the `handle_new_user` SQL trigger on `auth.users` insert, ensuring compatibility with all auth methods including OAuth.

---

## 2. Authorization & Permissions Framework (CORE-ARCH-008)

The permissions system is defined in `src/lib/permissions/matrix.ts` (single source of truth) and checked via helpers in `src/lib/permissions/helpers.ts` or React hooks in `src/lib/permissions/hooks.ts`.

### Named Role Helpers

Always use the following functions for security and role auditing:

- **Server Helpers (`src/lib/permissions/helpers.ts`)**:
  - `getAccessLevel(role)`: Resolves a database role string (or null) to an `AccessLevel` ("unauthenticated", "guest", "member", "technician", "admin").
  - `checkPermission(permissionId, accessLevel, context)`: Checks if a permission is granted. Handles conditional permissions (`'own'`, `'owner'`) using `OwnershipContext`.
  - `checkPermissions(permissionIds, accessLevel, context)`: Returns true if all permissions are granted.
  - `checkAnyPermission(permissionIds, accessLevel, context)`: Returns true if any of the permissions are granted.
  - `getGrantedPermissions(accessLevel, context)`: Retrieves list of granted permission IDs.
  - `getPermissionState(permissionId, accessLevel, context)`: Returns detailed state (`allowed: boolean`, `reason: "unauthenticated" | "role" | "ownership"`).
  - `getPermissionDeniedReason(permissionId, accessLevel, context)`: Returns a human-readable tooltip string for disabled actions.
  - `isConditionalPermission(permissionId, accessLevel)`: Checks if permission requires ownership context.
- **Client React Hooks (`src/lib/permissions/hooks.ts`)**:
  - `usePermission(permissionId, user, context)`
  - `usePermissionState(permissionId, user, context)`
  - `usePermissions(permissionIds, user, context)`
  - `usePermissionStates(permissionIds, user, context)`
  - `useAccessLevel(user)`
  - `useIsAuthenticated(user)`
  - `useIsConditionalPermission(permissionId, user)`
  - `useRawPermission(permissionId, user)`

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
  identities: UserIdentity[],
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
  severity: z.enum(["minor", "playable", "unplayable"]),
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

### Client Component with Hooks

```typescript
"use client";

import { usePermissionState, type PermissionUser, type IssueContext } from "~/lib/permissions/hooks";

interface IssueEditorProps {
  user: PermissionUser;
  issue: IssueContext;
}

export function IssueEditor({ user, issue }: IssueEditorProps) {
  // Check permission state with tooltip reason if denied
  const { allowed, reason } = usePermissionState("issues.update.reporting", user, {
    issue,
  });

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        disabled={!allowed}
        placeholder="Edit issue title..."
        className="border p-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
        title={reason ?? undefined}
      />
      {!allowed && reason && (
        <span className="text-xs text-destructive">{reason}</span>
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

```typescript
import sanitizeHtml from "sanitize-html";

export async function createComment(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const rawContent = formData.get("content");
  if (typeof rawContent !== "string") {
    throw new Error("Invalid content");
  }

  // Sanitize HTML to prevent XSS
  const sanitizedContent = sanitizeHtml(rawContent, {
    allowedTags: ["b", "i", "em", "strong", "a", "p"],
    allowedAttributes: {
      a: ["href"],
    },
  });

  await db.insert(comments).values({
    userId: user.id,
    content: sanitizedContent,
  });
}
```

---

## Security Checklist

Before deploying or merging security-sensitive changes, verify:

- [ ] **Auth Checks**: `createClient()` is immediately followed by `auth.getUser()` (CORE-SSR-002) in all Server Actions/routes.
- [ ] **Authorization**: Every action is protected using the permissions matrix via `checkPermission()` (CORE-ARCH-008). No hardcoded checks.
- [ ] **Email Privacy**: User email addresses are never displayed outside of admin views or settings (CORE-SEC-007).
- [ ] **Input Validation**: All form inputs are validated using Zod (CORE-SEC-002).
- [ ] **Hostnames**: No hardcoded hostnames/ports used; local dev runs strictly on `localhost` (CORE-SEC-008).
- [ ] **CSP Config**: Dynamic CSP nonce generated via `middleware.ts` (CORE-SEC-004), no `'unsafe-inline'` for script-src.
- [ ] **Identities Safeguard**: Manual unlinking verifies multiple identities remain via `canUnlinkIdentity`.
- [ ] **Drizzle Migrations**: Schema updates are managed via generated SQL migrations only (CORE-ARCH-009).

---

## References

- **Security Details**: `docs/SECURITY.md`
- **Core Guidelines**: `docs/NON_NEGOTIABLES.md` (specifically `CORE-SEC-*` and `CORE-SSR-*` rules)
- **Design System Rules**: `pinpoint-design-bible`
- **Database Schema**: `src/server/db/schema.ts`
