# Subdomain Multi-Tenancy Implementation (Archived)

**Status**: Shelved
**Date Archived**: 2025-10-27
**Reason**: Deferred until post-alpha with known hosting platform and confirmed multi-tenant requirements
**Original Branch**: `fix-e2e` (commits d26f961, 5ae9f00, 8a91e13)

## Context

This document preserves the subdomain-based multi-tenancy implementation that was developed but shelved before alpha launch. The implementation was technically sound and fully tested (439 passing tests), but was determined to be premature optimization for a single-tenant alpha.

### Why This Was Built

The goal was to support multiple organizations with subdomain routing:
- `apc.pinpoint.app` → Austin Pinball Collective
- `other-org.pinpoint.app` → Other organizations (future)
- `pinpoint.austinpinballcollective.org` → Custom domain locked to APC

### Why This Was Shelved

1. **Alpha Scope**: Single organization (APC) doesn't need multi-tenant routing
2. **Unknown Hosting Platform**: Planned migration off Vercel in 1-2 months; subdomain implementation is platform-specific
3. **Mental Overhead**: Real bugs observed in state management (org selection, login dropdown visibility, homepage behavior)
4. **Testing Complexity**: Requires production-like environments to properly validate
5. **Opportunity Cost**: Time better spent on APC member-facing features

## Architecture Overview

### Host Classification System

Three host types were defined:

1. **Alias** - Custom domains locked to specific orgs (e.g., `pinpoint.austinpinballcollective.org` → `apc`)
2. **Subdomain-Capable** - Domains that support org prefixes (e.g., `localhost`, `pinpoint.app`)
3. **Non-Subdomain-Capable** - Environments without subdomain support (e.g., `*.vercel.app` preview deployments)

### Metadata-First Resolution

**Priority Order**:
1. `user.app_metadata.organizationId` (canonical source of truth)
2. Trusted subdomain/alias hint from middleware (only when metadata absent)
3. No-org state (marketing/selection flow)

### Key Components

#### 1. Host Context Utilities ([src/lib/host-context.ts](../../src/lib/host-context.ts))

```typescript
// Host classification
type HostKind = "alias" | "subdomain-capable" | "non-subdomain-capable";

function classifyHost(host: string): HostKind {
  if (getOrgForAlias(hostname)) return "alias";
  if (isVercelPreview(hostname)) return "non-subdomain-capable";
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return "subdomain-capable";
  return "subdomain-capable"; // Default for production domains
}

// Subdomain extraction
function extractOrgSubdomain(host: string): string | null {
  // Returns org label from subdomain (e.g., "apc" from "apc.pinpoint.app")
  // Returns null for apex domains, preview environments, or when not applicable
}

// Alias mapping
function getOrgForAlias(host: string): string | null {
  // Maps custom domains to org subdomains
  // e.g., "pinpoint.austinpinballcollective.org" → "apc"
}

// URL construction for redirects
function buildOrgUrl({ kind, baseHost, orgSubdomain, path, protocol, port }): string {
  // Builds correct redirect URLs based on host classification
  // Handles subdomain prefixing for subdomain-capable hosts
  // Preserves host for non-subdomain-capable environments
}
```

**Testing**: [src/lib/host-context.unit.test.ts](../../src/lib/host-context.unit.test.ts) (105 lines)

#### 2. Middleware Subdomain Verification ([middleware.ts](../../middleware.ts))

```typescript
export function middleware(request: NextRequest): NextResponse {
  const host = request.nextUrl.hostname;
  const kind = classifyHost(host);

  let resolvedSubdomain: string | null = null;
  if (kind === "alias") {
    resolvedSubdomain = getOrgForAlias(host);
  } else if (kind === "subdomain-capable") {
    resolvedSubdomain = extractOrgSubdomain(host);
  }

  if (!resolvedSubdomain) {
    return NextResponse.next(); // Apex domain, show marketing/selection
  }

  // Set verified headers for downstream consumption
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-subdomain", resolvedSubdomain);
  requestHeaders.set("x-subdomain-verified", "1");

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-subdomain", resolvedSubdomain);
  response.headers.set("x-subdomain-verified", "1");

  return response;
}
```

**Security Model**:
- Middleware sets `x-subdomain` + `x-subdomain-verified` headers
- Downstream code only trusts `x-subdomain` when verification header present
- Prevents header injection attacks

**Testing**: [src/middleware/middleware.integration.test.ts](../../src/middleware/middleware.integration.test.ts) (57 lines)

#### 3. Auth Context Resolver ([src/server/auth/context.ts](../../src/server/auth/context.ts))

```typescript
// Discriminated union return type
type AuthContext =
  | { kind: "unauthenticated" }
  | { kind: "no-membership"; user: BaseUser; orgId: string }
  | { kind: "authorized"; user: BaseUser; org: Org; membership: Membership };

const resolveAuthContext = async (): Promise<AuthContext> => {
  // 1. Session Layer: Read Supabase session
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { kind: "unauthenticated" };

  // 2. Identity Layer: Normalize user
  const baseUser: BaseUser = { id: user.id, email: user.email ?? "", ... };

  // 3. Org Context Layer: Resolve org (metadata-first)
  const metadataOrgId = user.app_metadata[METADATA_KEYS.ORGANIZATION_ID];
  const subdomain = extractTrustedSubdomain(headers) ?? resolveOrgSubdomainFromHost(host);

  let orgId: string | null = null;
  let org = null;

  if (metadataOrgId) {
    // CANONICAL: Use metadata
    orgId = metadataOrgId;
    org = await getPublicOrganizationById(orgId);
  } else if (subdomain && subdomain !== "www" && subdomain !== "api") {
    // FALLBACK: Use host hint (first login only)
    orgId = subdomain;
    org = await getOrganizationBySubdomain(subdomain);
  }

  if (!orgId) return { kind: "unauthenticated" };
  if (!org) return { kind: "no-membership", user: baseUser, orgId };

  // 4. Authorization Layer: Fetch membership
  const membership = await getUserMembershipPublic(user.id, org.id);
  if (!membership) return { kind: "no-membership", user: baseUser, orgId: org.id };

  return { kind: "authorized", user: baseUser, org, membership };
};
```

**Testing**: [src/server/auth/context.integration.test.ts](../../src/server/auth/context.integration.test.ts) (172 lines)

#### 4. Auth Actions with Org-Specific Callbacks ([src/lib/actions/auth-actions.ts](../../src/lib/actions/auth-actions.ts))

```typescript
export async function sendMagicLink(email: string, organizationId: string) {
  const headersList = await headers();
  const host = headersList.get("host") ?? "";
  const kind = classifyHost(host);

  // Build callback URL based on host classification
  const callbackUrl = buildOrgUrl({
    kind,
    baseHost: host,
    orgSubdomain: organizationId, // Assume orgId is subdomain for simplicity
    path: "/auth/callback",
    protocol: process.env.NODE_ENV === "production" ? "https" : "http",
  });

  const supabase = await createClient();
  await supabase.auth.signInWithOtp({
    email,
    options: {
      data: { organizationId }, // Include org in metadata
      emailRedirectTo: callbackUrl,
    },
  });
}
```

**Behavior by Host Type**:
- **Alias**: Callback stays on alias domain (e.g., `pinpoint.austinpinballcollective.org/auth/callback`)
- **Subdomain-Capable**: Callback to org subdomain (e.g., `apc.pinpoint.app/auth/callback`)
- **Non-Subdomain-Capable**: Callback to same preview host (e.g., `preview-abc.vercel.app/auth/callback`)

**Testing**: [src/lib/actions/auth-actions.integration.test.ts](../../src/lib/actions/auth-actions.integration.test.ts) (204 lines)

#### 5. Sign-In Form with Org Selection ([src/app/auth/sign-in/components/SignInForm.tsx](../../src/app/auth/sign-in/components/SignInForm.tsx))

```typescript
// UI Behavior:
// - Alias host: Hide org dropdown (locked to alias org)
// - Subdomain-capable apex: Show org dropdown
// - Subdomain-capable with org: Hide dropdown (locked by subdomain)
// - Non-subdomain-capable: Show org dropdown

const SignInForm = () => {
  const host = window.location.hostname;
  const kind = classifyHost(host);
  const subdomain = kind === "subdomain-capable" ? extractOrgSubdomain(host) : null;

  const showOrgDropdown =
    kind !== "alias" &&                    // Not locked by alias
    (kind === "non-subdomain-capable" ||   // Preview needs dropdown
     (!subdomain && kind === "subdomain-capable")); // Apex needs dropdown

  // ... form logic
};
```

## Domain Mapping

**Alias Configuration** ([src/lib/domain-org-mapping.ts](../../src/lib/domain-org-mapping.ts)):

```typescript
export const ORG_ALIAS_HOSTS: Record<string, string> = {
  "pinpoint.austinpinballcollective.org": "apc",
  // Future custom domains would be added here
};
```

## Testing Strategy

### Test Coverage Achieved

- **Unit Tests**: Host classification, subdomain extraction, alias mapping, URL building (105 lines)
- **Integration Tests**:
  - Middleware header setting (57 lines)
  - Auth actions callback URL construction (204 lines)
  - Auth context resolver with metadata + hints (172 lines)
  - Auth callback route org resolution (extended existing tests)

### Test Scenarios Covered

1. **Host Classification**:
   - ✅ Alias domains correctly identified
   - ✅ Subdomain-capable domains (localhost, production apex, with org prefix)
   - ✅ Non-subdomain-capable (Vercel preview URLs)

2. **Middleware**:
   - ✅ Alias: Sets verified headers
   - ✅ Subdomain with org: Sets verified headers
   - ✅ Apex domain: No headers set
   - ✅ Preview: No headers set

3. **Auth Context**:
   - ✅ Metadata-only path (no host hint needed)
   - ✅ First login with host hint
   - ✅ Metadata mismatch with alias (metadata wins)
   - ✅ No membership in resolved org

4. **Auth Actions**:
   - ✅ Callback URL construction for each host type
   - ✅ Metadata inclusion in auth options

## Known Issues & Observations

### Bugs Encountered During Development

1. **Org Selection State**: Complex logic for showing/hiding dropdown based on host type and subdomain presence
2. **Homepage Routing**: Unclear behavior when unauthenticated user visits apex vs org subdomain vs alias
3. **Active Org Confusion**: Users could have metadata pointing to one org while visiting a different org's subdomain

### What Wasn't Fully Solved

- **Cross-subdomain navigation**: No clear UX for switching between orgs
- **Metadata conflicts**: What happens when user with org A metadata visits org B subdomain?
- **Preview environment org selection**: How to let developers test different orgs in preview

## Migration Back (When Needed)

### Prerequisites

1. **Confirmed hosting platform** with known subdomain support
2. **Multiple organizations** actually need to be supported
3. **Time allocated** for UX design and testing

### Implementation Steps

1. **Restore core files**:
   - `src/lib/host-context.ts` + tests
   - Middleware subdomain logic
   - Auth actions callback URL building
   - Auth context host hint logic

2. **Update for new platform**:
   - Adjust `classifyHost()` for new hosting environment
   - Update `ORG_ALIAS_HOSTS` with production domains
   - Configure wildcard DNS/SSL certificates

3. **Resolve UX questions**:
   - Design cross-org navigation flow
   - Handle metadata/subdomain conflicts
   - Test all host types in real environments

4. **Testing checklist**:
   - [ ] Localhost development (with and without org subdomains)
   - [ ] Preview deployments (org selection works)
   - [ ] Production apex domain (marketing/selection flow)
   - [ ] Production org subdomains (locked behavior)
   - [ ] Production alias domains (locked behavior)
   - [ ] Cross-subdomain navigation
   - [ ] Metadata conflicts resolved correctly

## Related Documentation

- **Original Plan**: [docs/planning/org-context-host-refactor.md](../planning/org-context-host-refactor.md)
- **Test Specification**: [docs/planning/org-context-host-refactor.test-spec.md](../planning/org-context-host-refactor.test-spec.md)
- **Security Patterns**: [docs/security/organization-access-patterns.md](../security/organization-access-patterns.md)

## Code Preservation

All implementation code and tests remain on the `fix-e2e` branch:
- Branch: `fix-e2e`
- Latest commit: `d26f961` ("feat: add host classification and metadata-first auth flow")
- Test status: 439 passing tests
- Can be retrieved with: `git checkout fix-e2e -- <file>`

## Lessons Learned

### What Worked Well

1. **Metadata-First Architecture**: The decision to make `app_metadata.organizationId` canonical was correct and should be preserved even in simplified single-org architecture
2. **Host Classification Abstraction**: Clean separation of concerns between host types
3. **Discriminated Unions**: Auth context as discriminated union prevented many potential bugs
4. **Security Model**: Verified headers prevent injection attacks
5. **Test Coverage**: Comprehensive integration tests caught many edge cases

### What Would Change Next Time

1. **UX First**: Design the cross-org navigation UX before implementing routing
2. **Platform-Specific**: Build for the actual hosting platform, not generically
3. **Incremental**: Could have started with just alias support, added subdomain support later
4. **State Machine**: Org selection state could be modeled as explicit state machine
5. **Feature Flag**: Could have shipped behind feature flag to test in production

### Key Insights

- Subdomain routing is deceptively complex due to environment variations (local, preview, prod)
- The real complexity isn't the routing—it's the state management and UX
- Testing requires production-like environments; mocks miss environment-specific issues
- Single-tenant is a valid architectural choice; multi-tenant can be added later
- YAGNI applies even when you've already built it—don't ship what you don't need
