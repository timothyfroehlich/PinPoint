# Single-Org Alpha Simplification Plan

**Status**: Ready to implement
**Date**: 2025-10-27
**Target**: Alpha launch with APC as single organization
**Branch Strategy**: New branch from `main` (not from `fix-e2e`)

## Overview

Simplify PinPoint to single-org mode for alpha launch. Remove all subdomain/multi-tenant complexity while preserving the strong foundation of metadata-first authentication and RLS-based security.

## Goals

1. **Single Organization**: All users belong to APC org, no org selection needed
2. **Simple Deployment**: One URL per environment (preview vs prod)
3. **Environment Separation**: Different Supabase projects for preview/prod
4. **Metadata Foundation**: Keep `app_metadata.organizationId` as source of truth
5. **Zero Subdomain Logic**: Remove all host classification, subdomain extraction, etc.

## What We're Keeping

✅ **Metadata-first authentication** - `user.app_metadata.organizationId` is canonical
✅ **RLS security** - All queries scoped by organizationId
✅ **Auth context resolver** - Simplified version, no host hints
✅ **Discriminated union types** - `AuthContext` with kind-based discrimination
✅ **Doc cleanup** - Deletion of old baseline/lessons-learned/patterns docs
✅ **Test fix** - Single-threaded vitest execution

## What We're Removing

❌ Host classification logic (`src/lib/host-context.ts`)
❌ Subdomain verification/extraction
❌ Middleware subdomain handling
❌ Org selection UI in sign-in form
❌ Org-specific callback URL building in auth actions
❌ Host hint resolution in auth context
❌ All subdomain-related tests

## Implementation Steps

### Phase 1: Branch Setup (5 minutes)

```bash
# 1. Ensure fix-e2e is committed and pushed (for archival)
git checkout fix-e2e
git status  # Should be clean
git push origin fix-e2e  # Preserve for future reference

# 2. Create new branch from main
git checkout main
git pull origin main
git checkout -b feat/single-org-alpha

# 3. Cherry-pick the vitest fix from fix-e2e
git cherry-pick d26f961 -- package.json  # Just the test script change
# Or manually apply:
# In package.json, change:
# "test": "vitest run --reporter=dot --pool=threads --poolOptions.threads.maxThreads=1"

# 4. Cherry-pick doc deletions from fix-e2e
git show 5ae9f00 --name-only | grep "^D" | grep "docs/" | while read -r file; do
  git rm "$file" 2>/dev/null || true
done

# 5. Commit the cherry-picks
git commit -m "chore: apply vitest single-thread fix and doc cleanup from fix-e2e"
```

### Phase 2: Environment Configuration (10 minutes)

**2.1. Add Hardcoded Org ID** (`src/env.js`):

```typescript
// Add to server schema
server: {
  // ... existing vars ...

  // Alpha: Hardcoded org ID for single-tenant mode
  ALPHA_ORG_ID: z.string().default("test-org-pinpoint"),

  // Alpha: Hardcoded org subdomain for URL construction
  ALPHA_ORG_SUBDOMAIN: z.string().default("apc"),
}
```

**2.2. Update `.env.example`**:

```bash
# Alpha Configuration (Single-Org Mode)
# These will be removed when multi-tenant support is added post-alpha
ALPHA_ORG_ID="test-org-pinpoint"  # APC org ID from seed data
ALPHA_ORG_SUBDOMAIN="apc"         # APC subdomain
```

**2.3. Update `.env.test`**:

```bash
# Alpha Configuration
ALPHA_ORG_ID="test-org-pinpoint"
ALPHA_ORG_SUBDOMAIN="apc"
```

**2.4. Local `.env.local`** (add locally):

```bash
ALPHA_ORG_ID="test-org-pinpoint"
ALPHA_ORG_SUBDOMAIN="apc"
```

### Phase 3: Simplify Auth Context (15 minutes)

**3.1. Update `src/server/auth/context.ts`**:

Remove all host hint logic, keep metadata-only resolution:

```typescript
/**
 * Canonical Authentication Context Resolver - Alpha Single-Org Mode
 * Single deterministic, cached request-scoped authentication resolution
 *
 * Alpha Simplification: No host hints, metadata-only org resolution
 */

import { cache } from "react";
import { createClient } from "~/lib/supabase/server";
import {
  getPublicOrganizationById,
  getUserMembershipPublic,
} from "~/lib/dal/public-organizations";
import { METADATA_KEYS } from "~/lib/constants/entity-ui";
import { env } from "~/env";

// ... BaseUser, Org, Membership types unchanged ...

export type AuthContext =
  | { kind: "unauthenticated" }
  | { kind: "no-membership"; user: BaseUser; orgId: string }
  | { kind: "authorized"; user: BaseUser; org: Org; membership: Membership };

const resolveAuthContext = async (): Promise<AuthContext> => {
  try {
    // 1. Session Layer: Read cookies + Supabase session
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { kind: "unauthenticated" };
    }

    // 2. Identity Layer: Normalize user
    const userName = user.user_metadata["name"] as string | undefined;
    const baseUser: BaseUser = {
      id: user.id,
      email: user.email ?? "",
      ...(userName && { name: userName }),
    };

    // 3. Org Context Layer: Metadata-only (Alpha Single-Org)
    const metadataOrgId = user.app_metadata[METADATA_KEYS.ORGANIZATION_ID] as string | undefined;

    // Alpha: If no metadata, use hardcoded org ID
    const orgId = metadataOrgId ?? env.ALPHA_ORG_ID;

    let org = null;
    try {
      org = await getPublicOrganizationById(orgId);
    } catch {
      org = null;
    }

    if (!org) {
      return { kind: "no-membership", user: baseUser, orgId };
    }

    // 4. Authorization Layer: Fetch membership
    const membership = await getUserMembershipPublic(user.id, org.id);
    if (!membership) {
      return { kind: "no-membership", user: baseUser, orgId: org.id };
    }

    // Success: Full authorization
    return {
      kind: "authorized",
      user: baseUser,
      org: {
        id: org.id,
        name: org.name,
        subdomain: org.subdomain,
      },
      membership: {
        id: membership.id,
        role: {
          id: membership.role.id,
          name: membership.role.name,
        },
        userId: membership.user_id,
        organizationId: membership.organization_id,
      },
    };
  } catch (error) {
    console.error("[AUTH-CONTEXT] Unexpected error during resolution:", error);
    return { kind: "unauthenticated" };
  }
};

// Cache and export unchanged
let cachedAuthContextResolver = cache(resolveAuthContext);

export const getRequestAuthContext = async (): Promise<AuthContext> =>
  cachedAuthContextResolver();

export function __resetAuthContextCache(): void {
  cachedAuthContextResolver = cache(resolveAuthContext);
}

// Helper functions unchanged
export async function requireAuthorized(): Promise<Extract<AuthContext, { kind: "authorized" }>> {
  const ctx = await getRequestAuthContext();
  if (ctx.kind !== "authorized") {
    throw new Error("Member access required");
  }
  return ctx;
}

export function isAuthorized(ctx: AuthContext): ctx is Extract<AuthContext, { kind: "authorized" }> {
  return ctx.kind === "authorized";
}

export function isAuthenticated(ctx: AuthContext): ctx is Exclude<AuthContext, { kind: "unauthenticated" }> {
  return ctx.kind !== "unauthenticated";
}
```

**3.2. Update `src/server/auth/context.integration.test.ts`**:

Remove host hint tests, keep metadata tests:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getRequestAuthContext, __resetAuthContextCache } from "./context";

describe("Auth Context Resolver (Alpha Single-Org)", () => {
  beforeEach(() => {
    __resetAuthContextCache();
    vi.clearAllMocks();
  });

  describe("Metadata-only resolution", () => {
    it("should resolve org from metadata when present", async () => {
      // Mock user with metadata
      // Mock getPublicOrganizationById to return org
      // Mock getUserMembershipPublic to return membership
      // Assert: kind === "authorized"
    });

    it("should use ALPHA_ORG_ID when metadata absent", async () => {
      // Mock user without metadata
      // Mock getPublicOrganizationById to return org for ALPHA_ORG_ID
      // Mock getUserMembershipPublic to return membership
      // Assert: kind === "authorized" with ALPHA_ORG_ID org
    });

    it("should return no-membership when user lacks membership", async () => {
      // Mock user with metadata
      // Mock getPublicOrganizationById to return org
      // Mock getUserMembershipPublic to return null
      // Assert: kind === "no-membership"
    });

    it("should return unauthenticated when session invalid", async () => {
      // Mock supabase.auth.getUser() to return error
      // Assert: kind === "unauthenticated"
    });
  });
});
```

### Phase 4: Simplify Auth Actions (15 minutes)

**4.1. Update `src/lib/actions/auth-actions.ts`**:

Remove all host classification and callback URL building:

```typescript
"use server";

import { createClient } from "~/lib/supabase/server";
import { env } from "~/env";
import { METADATA_KEYS } from "~/lib/constants/entity-ui";

/**
 * Send magic link for authentication
 * Alpha: Always sets metadata to ALPHA_ORG_ID
 */
export async function sendMagicLink(email: string) {
  const supabase = await createClient();

  // Alpha: Simple callback URL, no subdomain routing
  const baseUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const callbackUrl = `${baseUrl}/auth/callback`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl,
      data: {
        [METADATA_KEYS.ORGANIZATION_ID]: env.ALPHA_ORG_ID,
      },
    },
  });

  if (error) {
    throw new Error(`Failed to send magic link: ${error.message}`);
  }

  return { success: true };
}

/**
 * Sign in with OAuth provider
 * Alpha: Always sets metadata to ALPHA_ORG_ID
 */
export async function signInWithOAuth(provider: "google" | "github") {
  const supabase = await createClient();

  const baseUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const callbackUrl = `${baseUrl}/auth/callback`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: callbackUrl,
      data: {
        [METADATA_KEYS.ORGANIZATION_ID]: env.ALPHA_ORG_ID,
      },
    },
  });

  if (error) {
    throw new Error(`OAuth sign-in failed: ${error.message}`);
  }

  return { url: data.url };
}

// Remove signInWithOrganization - not needed in single-org mode
```

**4.2. Update or remove `src/lib/actions/auth-actions.integration.test.ts`**:

Simplify to test basic auth flows without host handling:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendMagicLink, signInWithOAuth } from "./auth-actions";

describe("Auth Actions (Alpha Single-Org)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendMagicLink", () => {
    it("should send magic link with ALPHA_ORG_ID in metadata", async () => {
      // Mock createClient
      // Mock signInWithOtp
      // Call sendMagicLink
      // Assert: options.data contains ALPHA_ORG_ID
      // Assert: redirectTo is simple callback URL
    });
  });

  describe("signInWithOAuth", () => {
    it("should initiate OAuth with ALPHA_ORG_ID in metadata", async () => {
      // Mock createClient
      // Mock signInWithOAuth
      // Call signInWithOAuth
      // Assert: options.data contains ALPHA_ORG_ID
      // Assert: redirectTo is simple callback URL
    });
  });
});
```

### Phase 5: Simplify Middleware (10 minutes)

**5.1. Update `middleware.ts`**:

Keep only Supabase session refresh, remove subdomain handling:

```typescript
import { type NextRequest } from "next/server";
import { updateSession } from "~/utils/supabase/middleware";

/**
 * Alpha Single-Org Middleware
 * Only handles Supabase session refresh
 * No subdomain routing or org resolution
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

**5.2. Remove `src/middleware/middleware.integration.test.ts`**:

```bash
git rm src/middleware/middleware.integration.test.ts
```

### Phase 6: Simplify Sign-In Form (10 minutes)

**6.1. Update `src/app/auth/sign-in/components/SignInForm.tsx`**:

Remove org selection dropdown, single hardcoded org:

```typescript
"use client";

import { useState } from "react";
import { sendMagicLink, signInWithOAuth } from "~/lib/actions/auth-actions";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await sendMagicLink(email);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send magic link");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: "google" | "github") => {
    setLoading(true);
    setError(null);

    try {
      const { url } = await signInWithOAuth(provider);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "OAuth sign-in failed");
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold">Check your email</h2>
        <p className="mt-2 text-gray-600">
          We sent a magic link to {email}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Sign in to PinPoint</h1>
        <p className="mt-2 text-gray-600">Austin Pinball Collective</p>
      </div>

      {error && (
        <div className="rounded bg-red-50 p-3 text-red-800">
          {error}
        </div>
      )}

      <form onSubmit={handleMagicLink} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 w-full rounded border px-3 py-2"
            placeholder="you@example.com"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Sending..." : "Send magic link"}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-2 text-gray-500">Or continue with</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => handleOAuth("google")}
          disabled={loading}
          className="rounded border px-4 py-2 hover:bg-gray-50 disabled:opacity-50"
        >
          Google
        </button>
        <button
          onClick={() => handleOAuth("github")}
          disabled={loading}
          className="rounded border px-4 py-2 hover:bg-gray-50 disabled:opacity-50"
        >
          GitHub
        </button>
      </div>
    </div>
  );
}
```

### Phase 7: Update Auth Callback (10 minutes)

**7.1. Simplify `src/app/auth/callback/route.ts`**:

Keep the route mostly as-is since it already prioritizes metadata, but remove any host-based org resolution:

```typescript
// In the org resolution section, simplify to:
const orgId =
  params.get("organizationId") ||           // Query param (if provided)
  user.app_metadata[METADATA_KEYS.ORGANIZATION_ID] ||  // Metadata
  env.ALPHA_ORG_ID;                         // Alpha fallback

// Remove any extractTrustedSubdomain or resolveOrgSubdomainFromHost calls
```

**7.2. Update `src/app/auth/callback/route.integration.test.ts`**:

Simplify tests to focus on metadata-first without host scenarios.

### Phase 8: Delete Subdomain Files (5 minutes)

```bash
# Delete subdomain-related files
git rm src/lib/host-context.ts
git rm src/lib/host-context.unit.test.ts
git rm src/lib/subdomain-verification.ts
git rm src/lib/subdomain-verification.unit.test.ts

# Update imports in any remaining files that reference these
# (Should be none after above changes, but check)
```

### Phase 9: Update Documentation (15 minutes)

**9.1. Update `docs/design-docs/subdomain-development-setup.md`**:

Replace with alpha single-org setup:

```markdown
# Alpha Development Setup (Single-Org Mode)

## Overview

PinPoint alpha runs in single-org mode with all users belonging to APC.
No subdomain routing or org selection needed.

## Local Development

1. Start Supabase: `npm run sb:reset`
2. Start Next.js: `npm run dev`
3. Visit: `http://localhost:3000`
4. Sign in (any method) - automatically assigned to APC org

## Environment Variables

```bash
ALPHA_ORG_ID="test-org-pinpoint"  # Hardcoded for alpha
ALPHA_ORG_SUBDOMAIN="apc"         # Hardcoded for alpha
```

## Preview Environment

- URL: Vercel preview deployment (e.g., `project-name-git-branch.vercel.app`)
- Database: Separate Supabase project (preview DB with test data)
- Same single-org behavior as local

## Production Environment

- URL: `pinpoint.austinpinballcollective.org` (or similar)
- Database: Production Supabase project
- Same single-org behavior

## Post-Alpha Multi-Tenant

When multi-tenant support is added:
- See `docs/archive/subdomain-multitenancy-implementation.md`
- Will add subdomain routing, org selection, custom domain support
```

**9.2. Update `docs/security/organization-access-patterns.md`**:

Simplify to reflect single-org alpha mode.

**9.3. Update `NON_NEGOTIABLES.md`** if needed:

Note the alpha single-org mode and reference the archive for future multi-tenant.

### Phase 10: Testing & Validation (20 minutes)

**10.1. Run test suite**:

```bash
npm test
npm run test:rls
npm run lint
npm run typecheck
```

**10.2. Manual testing checklist**:

- [ ] Local dev: Visit `localhost:3000`, sign in, see dashboard
- [ ] Local dev: User automatically assigned to APC org
- [ ] Local dev: Can view machines, issues, etc.
- [ ] Auth context resolves correctly (check logs)
- [ ] No subdomain logic executing (check middleware logs)

**10.3. Fix any failing tests**:

- Auth context tests may need updates for simplified logic
- Auth action tests should be simpler now
- Remove any tests that were subdomain-specific

### Phase 11: Deployment Configuration (10 minutes)

**11.1. Vercel Environment Variables** (for preview & prod):

```bash
# Preview Environment
ALPHA_ORG_ID="test-org-pinpoint"
ALPHA_ORG_SUBDOMAIN="apc"
DATABASE_URL=[preview-supabase-connection-string]
NEXT_PUBLIC_SUPABASE_URL=[preview-supabase-url]
NEXT_PUBLIC_SUPABASE_ANON_KEY=[preview-supabase-anon-key]

# Production Environment
ALPHA_ORG_ID="test-org-pinpoint"  # Or real prod org ID
ALPHA_ORG_SUBDOMAIN="apc"
DATABASE_URL=[prod-supabase-connection-string]
NEXT_PUBLIC_SUPABASE_URL=[prod-supabase-url]
NEXT_PUBLIC_SUPABASE_ANON_KEY=[prod-supabase-anon-key]
```

**11.2. Custom Domain** (if using pinpoint.austinpinballcollective.org):

- Add custom domain in Vercel dashboard
- Point DNS to Vercel
- No special subdomain configuration needed

## Success Criteria

✅ All tests passing (unit, integration, RLS)
✅ Local dev works without subdomain logic
✅ Sign-in flow works without org selection
✅ Users automatically assigned to APC org
✅ Auth context resolves from metadata only
✅ No host classification or subdomain extraction code running
✅ Deployment to preview/prod environments works
✅ Code is simpler and easier to understand

## Rollback Plan

If issues arise, the `fix-e2e` branch preserves the full subdomain implementation:

```bash
git checkout fix-e2e
# Or cherry-pick specific commits back if needed
```

## Post-Alpha Migration Path

When ready to add multi-tenant support:
1. Read `docs/archive/subdomain-multitenancy-implementation.md`
2. Know your hosting platform's subdomain support
3. Restore files from `fix-e2e` branch
4. Adapt for new hosting platform
5. Add org selection UX
6. Test thoroughly in production-like environments

## Time Estimate

- **Phase 1-2** (Branch + Env): 15 minutes
- **Phase 3-7** (Code Changes): 60 minutes
- **Phase 8-9** (Cleanup + Docs): 20 minutes
- **Phase 10** (Testing): 20 minutes
- **Phase 11** (Deployment): 10 minutes

**Total**: ~2 hours of focused work

## Questions Before Starting

- [ ] Confirm ALPHA_ORG_ID should be "test-org-pinpoint" (matches seed data)
- [ ] Confirm ALPHA_ORG_SUBDOMAIN should be "apc"
- [ ] Confirm custom domain is pinpoint.austinpinballcollective.org (or TBD)
- [ ] Confirm preview DB is separate Supabase project (or same with env flag)

---

Ready to implement? Let's ship alpha! 🚀
