---
paths:
  - "src/lib/supabase/**"
  - "src/lib/auth/**"
  - "src/app/(auth)/**"
  - "middleware.ts"
---

# Creating a Supabase client or an auth check

Full statements, severity, and do/don't: `docs/NON_NEGOTIABLES.md`.

- **Supabase SSR** (CORE-SSR-001, CORE-SSR-002): `createClient()` →
  `auth.getUser()` immediately. No logic between.

Which modules may import `@supabase/ssr` directly, the multi-provider OAuth
registry and unlink guard, and the `~/lib/url` seam that makes hand-rolled
`process.env` URL building a bug: `pinpoint-security` skill. Recorded
threat-model decisions: `docs/SECURITY.md`.
