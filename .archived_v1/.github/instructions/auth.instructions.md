---
applyTo: "**/*auth*.ts,**/middleware.ts,app/auth/**/*.ts,src/lib/supabase/**/*.ts"
---

# Authentication Layer Review Instructions

## Supabase SSR Patterns

When reviewing authentication code, strictly enforce:

### Required Patterns (CORE-SSR-001 through CORE-SSR-005)

- MUST use `~/lib/supabase/server` createClient(), never direct supabase-js imports
- MUST call `supabase.auth.getUser()` immediately after creating SSR client
- MUST use getAll()/setAll() cookie contract, never individual cookie operations
- MUST preserve Next.js middleware for token refresh
- MUST maintain `/auth/callback/route.ts` for OAuth flows

### Forbidden Patterns

- Direct imports from `@supabase/supabase-js` on server-side
- Modifying Supabase response object
- Logic between client creation and `getUser()` call
- Deprecated `@supabase/auth-helpers-nextjs` imports

### Context Resolution

- Server Components MUST use `requireAuthContext()` or `getServerAuthContext()`
- Organization context required unless in global/root pages
- Proper error boundaries for authentication failures

### Global Context Clarification

- Pages/routes rendered at the root domain (no subdomain) operate in global context
- These must not invoke org-scoped fetchers or attempt org membership resolution
- Org-scoped functions must assert presence of `organizationId` and fail loudly if absent

### Session Management

- Use structured error types for authentication failures
- Security-first error messaging (no information disclosure)
- Proper session cleanup and token refresh handling

### Server Component Authentication

- MUST receive organization context unless in global context
- Pass/derive `organizationId` for Server Components via context/props
- Bind RLS at the boundary for proper multi-tenant isolation

### API Protection (CORE-SEC-002)

- Use protected procedures in tRPC routers
- Mask errors to prevent information disclosure
- Never expose sensitive routes as public
- Validate permissions at API boundaries
