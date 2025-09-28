# Org Context Host Refactor — Test Specification

Status: Draft (TDD source of truth)
Owner: Codex agent (with Froehlich)

## Goals
- Validate metadata‑first org context with minimal surface area.
- Prefer unit tests; use integration tests at clear boundaries (middleware, auth actions, auth callback, auth context resolver).
- Avoid Playwright; keep to Vitest + Next request/response objects.

## Units

### A. Host Classification (`src/lib/host-context.ts`)
- classifyHost
  - alias → returns "alias" for `pinpoint.austinpinballcollective.org`
  - subdomain‑capable → returns for `localhost[:port]`, `pinpoint.app`
  - non‑subdomain‑capable → returns for `*.vercel.app`
- extractOrgSubdomain
  - `apc.pinpoint.app` → `apc`
  - `apc.localhost` and `apc.localhost:3000` → `apc`
  - apex `pinpoint.app`, `localhost[:port]`, previews → `null`
- getOrgForAlias
  - Maps alias host to `apc`; unknown → `null`
- buildOrgUrl
  - subdomain‑capable: `apc.pinpoint.app/path`
  - non‑subdomain‑capable: `preview.vercel.app/path` (no prefix)
  - preserves protocol and port when provided

### B. Domain Utilities (`src/lib/utils/domain.ts`)
- getCookieDomain
  - `org.domain.com[:port]` → `.domain.com`
  - `localhost[:port]` → `.localhost`
- getProductionUrl, getCurrentDomain basic paths (ensure no regressions)

### C. Subdomain Verification (`src/lib/subdomain-verification.ts`)
- isSubdomainHeaderTrusted/extractTrustedSubdomain unchanged; ensure coverage remains green

## Integration

### D. Middleware (`middleware.ts`)
- Alias host → sets `x-subdomain` + `x-subdomain-verified`, no redirect
- Subdomain‑capable with `apc.pinpoint.app` → sets headers, no redirect
- Subdomain‑capable apex `pinpoint.app` → does not set headers, no redirect
- Localhost `localhost:3000` → does not set headers, no redirect
- Non‑subdomain‑capable `*.vercel.app` → does not set headers, no redirect

Approach: Create mocked `NextRequest` objects with `host` header; call exported `middleware`; assert `NextResponse` headers and `status`.

### E. Auth Actions (`src/lib/actions/auth-actions.ts`)
- sendMagicLink
  - includes `options.data.organizationId`
  - callback URL:
    - alias: stays on alias host
    - subdomain‑capable apex: builds `org.apex` callback
    - subdomain host present: builds `org.host` callback
    - non‑subdomain‑capable (preview): stays on same host
- signInWithOAuth mirrors above URL decisions

Approach: Module‑mock `~/lib/supabase/server` client, validate parameters to `signInWithOtp`/`signInWithOAuth`. Use `headers()` mock to inject host.

### F. Auth Callback (`src/app/auth/callback/route.ts`)
- Rate limit path (existing tests remain)
- Metadata‑first:
  - with metadata present → no metadata write, redirect as per host classification
- First login:
  - no metadata, alias host with membership → writes metadata to alias org
  - no metadata, subdomain host with membership → writes metadata to that org
  - no metadata, preview/apex with `organizationId` query → writes metadata to that org
  - membership missing → does not write metadata; redirects with no‑access indicator

Approach: Extend existing `route.integration.test.ts`. Mock: supabase client, `updateUserOrganization`, `getOrganizationBySubdomain`, `getUserMembershipPublic`, `extractTrustedSubdomain`, host.

### G. Auth Context Resolver (`src/server/auth/context.ts`)
- With metadata only → returns authorized when membership exists; no host dependence
- When metadata absent, trusted alias/subdomain hint present → resolves org by hint; returns `no-membership` when membership missing
- Alias host with conflicting metadata → metadata wins; verify no change to returned org id (unless we’re modeling callback behavior, which belongs to E)

Approach: New `context.integration.test.ts` co‑located or under `src/server/auth/`. Mock same dependencies used in callback tests.

## Existing Tests to Update
- `src/app/auth/callback/route.integration.test.ts`
  - Add cases for alias/subdomain/preview/apex per above; update expectations for redirect targets and metadata write conditions.
- `src/lib/domain-org-mapping.unit.test.ts`
  - Keep alias mapping tests; update any commentary implying subdomain label is an org ID to assert that it’s a hint that resolves to an org row.
- `src/app/auth/sign-in/components/SignInForm` (if tests exist)
  - Adjust for no localhost auto‑redirect; verify dropdown visibility under apex/preview, locked under alias.

## Non-Goals / Out of Scope
- Playwright/E2E changes (may be revisited later to mirror new flows, but not required for this refactor).
- Database migrations (not used in this project; no migration files). Schema changes are allowed sparingly via `db:push` with resets and updated seeds/tests.

## Commands
- Unit/integration: `npm test`
- Watch: `npm run test:watch`
- Lint/type: `npm run lint && npm run typecheck`
