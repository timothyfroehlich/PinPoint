---
applyTo: "**/*auth*.ts,**/middleware.ts,src/lib/supabase/**/*.ts,src/app/(auth)/**"
---

# Authentication (Supabase SSR, single-tenant)

## Required pattern (CORE-SSR-001, CORE-SSR-002)

- Server code gets a Supabase client from the `createClient()` wrapper in `src/lib/supabase/server.ts`, then calls `supabase.auth.getUser()` **immediately**. Flag any logic inserted between `createClient()` and `auth.getUser()`.
- Flag direct `@supabase/supabase-js` usage in Server Components — go through the wrapper. Flag deprecated `@supabase/auth-helpers-nextjs`.
- Middleware refreshes the session token only. Flag middleware that injects a custom response body or runs business logic.

## Forms & actions

- Login / signup / logout are Server Actions driven by `<form action={…}>`, with Zod validation of `FormData`. Core submit must work without JS.
- The OAuth callback route redirects on success; flag business logic added there.

## Single-tenant

- Flag any org-scoping, multi-tenant context, or RLS/permission enforcement added to auth — permissions live in the matrix (`~/lib/permissions`), and there is no tenant isolation layer.
