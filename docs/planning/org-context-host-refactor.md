# Org Context Host Refactor Plan

## Overview
- Date: 2025-09-27
- Owner: Codex agent (with Froehlich)
- Scope: Align network routing, authentication flows, and docs so that Supabase `app_metadata.organizationId` is the canonical organization context while host/subdomain hints drive UX and redirects.

## Objectives
- Preserve marketing landing pages on localhost and canonical apex domains.
- Ensure Vercel preview deployments work without subdomains by relying on metadata.
- Lock custom domains such as `pinpoint.austinpinballcollective.org` to a single organization.
- Remove stale docs + tests that assume automatic localhost→subdomain redirects.
- Expand integration coverage for middleware, auth actions, auth context, and host utilities.

## Guiding Principles
1. **Metadata First**: `app_metadata.organizationId` (set during auth) determines org scope. Hosts only influence selection before metadata exists.
2. **Host Classification (3 buckets)**: Shared helpers classify hosts as (a) alias (locked to an org), (b) subdomain‑capable (can prepend org, e.g., localhost/canonical), or (c) non‑subdomain‑capable (e.g., Vercel previews). Subdomain presence is then handled as a codepath under (b).
3. **Non-Destructive Middleware**: Middleware may set verified hint headers but never overrides metadata-only flows.
4. **Consistent Redirects**: Auth flows compute callback URLs using helpers so preview/apex hosts avoid imaginary subdomains.
5. **Documentation Truth**: Update design + security docs to match the new router/auth behavior.

## Behavioral Rules (Canonical)
- **Resolution Order**: `app_metadata.organizationId` → trusted alias/subdomain hint (only when metadata absent) → no-org.
- **Alias Domains** (e.g., `pinpoint.austinpinballcollective.org`): Locked to a single org. If user authenticates and has membership but metadata differs, update metadata to alias org in callback; if no membership, show no-access and do not switch org.
- **Subdomain Visits** (e.g., `apc.pinpoint.app`): Treat as a visit-context hint. Do not flip metadata during browsing. Only the auth callback may update metadata (with membership check) when metadata was absent.
- **Preview/Apex/Localhost**: No subdomain assumed. Marketing/selection flow uses metadata to scope app. Host hints only drive selection before metadata exists.
- **Subdomain ≠ Org ID**: Never treat a raw subdomain label as a database ID. Always resolve subdomain/alias → organization row → use the organization’s ID downstream.
- **Where Metadata Is Written**: Only in auth callback (and dev-auth) via admin client. Middleware never mutates metadata.

## Work Breakdown

### 1. Host Classification Utilities
- Add `src/lib/host-context.ts` (or similar) with pure functions:
  - `classifyHost(host: string): "alias" | "subdomain-capable" | "non-subdomain-capable"`.
  - `extractOrgSubdomain(host: string): string | null` (when host is subdomain‑capable and includes an org label).
  - `getOrgForAlias(host): string | null` (reuses `ORG_ALIAS_HOSTS`).
  - `buildOrgUrl({ kind, baseHost, orgSubdomain, path, protocol, port })` centralizes redirect construction for login/return URLs.
- Unit tests covering: canonical apex (subdomain‑capable), localhost(+port) (subdomain‑capable), preview `*.vercel.app` (non‑subdomain‑capable), APC alias (alias), unknown hosts.

### 2. Middleware Refinement (`middleware.ts`)
- Remove the localhost→subdomain redirect. Use classification instead:
  - **Alias**: set verified `x-subdomain` headers for the mapped org and pass through.
  - **Subdomain‑capable**:
    - If host already contains a recognized org subdomain, set verified headers and pass through.
    - If apex (no org label), do not set headers; show marketing/sign‑in page.
  - **Non‑subdomain‑capable** (e.g., preview): do not set headers; rely on app metadata.
- Add integration tests for each kind verifying whether headers are set and that no redirects are performed.

### 3. Authentication Flows
- Update `src/lib/actions/auth-actions.ts`:
  - Use host helpers + request headers to build callback URLs.
  - Always include `organizationId` in Supabase `options.data`.
  - For **subdomain‑capable** hosts: compute callback on `org.base` when user selects an org; for apex, stay apex during selection and redirect after auth.
  - For **non‑subdomain‑capable** hosts: keep callbacks on the same host (cannot prepend org).
- Update `src/lib/auth/dev-auth.ts` to redirect using the helpers instead of hardcoded `/dashboard` assumptions; ensure selected org persists in metadata before redirect.
- Extend integration/unit tests for magic link + OAuth actions verifying callback URL construction for: localhost, canonical apex, preview, APC alias.

### 4. Auth Callback Route (`src/app/auth/callback/route.ts`)
- Prioritize resolving org from `organizationId` query param → app metadata → alias/subdomain hint.
- If metadata is missing and host hint provides org, set metadata via `updateUserOrganization`.
- Redirect logic uses host helpers:
  - **Alias**: remain on alias host.
  - **Subdomain‑capable**: redirect to `org.base` (or stay on apex if UX dictates, then push to org route on next page).
  - **Non‑subdomain‑capable**: remain on same host.
- Extend integration tests with cases for each classification and metadata‑first behavior.

### 5. Auth Context Resolver (`src/server/auth/context.ts`)
- Resolve org context by reading `user.app_metadata.organizationId` first.
- Use host hints (alias/subdomain) only when metadata is absent (first login).
- Cache result via `cache()` as today; ensure returned `org` comes from DB via ID when metadata present.
- Add/adjust integration tests verifying:
  - Metadata-only path (no headers) returns correct org.
  - Alias host with metadata mismatch does **not** switch org.
  - First-login scenario without metadata uses host hint then gracefully handles missing org membership.

### 6. Sign-In Experience (`src/app/auth/sign-in/components/SignInForm.tsx`)
- Remove debug logging.
- Use host classification to determine UI:
  - **Alias** → locked org (no dropdown).
  - **Subdomain‑capable (apex or with org)** → marketing/sign‑in with dropdown when apex; if org in host, hide dropdown.
  - **Non‑subdomain‑capable** → marketing/sign‑in with dropdown; stay on same host for auth.
- Ensure selection triggers server actions with org ID (persisted in metadata) and redirects computed via helpers.
- Update any related tests (existing component tests if present, or add focused unit tests for host-driven state).

### 7. Documentation Updates
- Rewrite the following to match new behavior:
- `docs/design-docs/subdomain-development-setup.md`
- `docs/security/organization-access-patterns.md`
- `docs/security/organization-vulnerabilities.md`
- `docs/architecture/permissions-roles-implementation.md` (context resolution order)
- `docs/deployment/environment-management.md`
- Any other doc referencing localhost redirect or `DEFAULT_ORG_SUBDOMAIN` fallback.
- Emphasize metadata-first model, preview behavior, APC lock-in, and marketing landing flows.

### 8. Test Matrix & QA
- Vitest integration suites covering middleware, auth actions, auth context, auth callback.
- Unit suites for host helpers.
- Run `npm test`, `npm run lint`, `npm run typecheck`.
- Manual QA checklist:
  - Visit `http://localhost:3000` → marketing landing, sign-in dropdown, login to chosen org and verify redirect + metadata.
  - Visit preview host (simulate via host header) → same behavior without subdomains.
  - Visit `https://pinpoint.austinpinballcollective.org` → immediate org-scoped experience, no marketing page.
  - Confirm Supabase user metadata updates (`organizationId`) after sign-in.

### 9. Open Questions
- Confirm canonical apex domain (`pinpoint.app` vs `pinpoint.com`) before finalizing constants/docs.
- Determine whether previews should expose marketing page or auto-redirect once logged in.
- Validate that dev auth should always push users to `/dashboard` or respect `next` parameter.

## Tracking
- Use this document to check off sections as commits land.
- Update with decision notes / answers to open questions as they’re resolved.
