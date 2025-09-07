@INDEX.md

Last Reviewed: 2025-09-06

Environments & Domains (Brief)
- Local: `org.localhost:3000` (org-scoped) and `localhost:3000` (global). Supabase CLI local.
- Preview: `pin-point-git-<branch>-advacar.vercel.app` with `<org>.…` subdomains. Shares prod DB for now.
- Production: `pinpoint-tracker.vercel.app`, `pin-point-advacar.vercel.app`, `pin-point-git-main-advacar.vercel.app` (no subdomains on .vercel.app).
- APC Alias: `pinpoint.austinpinballcollective.org` → APC only. No generic landing. Login has no org dropdown.

Routing Rules
- Generic hosts: root `/` shows landing; `<org>.host` scopes to that org (custom domains only).
- APC alias: always APC; `/` redirects to `/auth/sign-in`.

Code Pointers
- Mapping: `src/lib/domain-org-mapping.ts` (host → org; APC alias → `apc`).
- Middleware: `middleware.ts` sets trusted `x-subdomain` headers from mapping.
- Login: `src/app/auth/sign-in/components/SignInForm.tsx` hides org selector when host locks org.
- Home: `src/app/page.tsx` redirects to sign-in on org-scoped hosts.

Note: Preview and prod share Supabase DB until open beta split.
