---
paths:
  - "next.config.ts"
  - "docs/ENV_VARS.md"
  - ".env.example"
  - "**/*.config.ts"
  - ".github/workflows/**"
---

# Adding an env var, or writing a local URL

Full statements, severity, and do/don't: `docs/NON_NEGOTIABLES.md`.

- **Env vars: central registry + no secret coupling** (CORE-SEC-009): every
  production-required env var is declared in the `next.config.ts` build
  registry (`assertVercelDeploymentEnv`) so a missing value fails the Vercel
  build, not silently degrades. "Production-required" means **PinPoint is
  broken without it** — the registry is a deploy gate, so an optional surface's
  config goes in `docs/ENV_VARS.md` §4.2 instead, and a var you do register
  must be set in Vercel _before_ the PR merges. No secret reused as another's
  fallback; no secret prefixed `NEXT_PUBLIC_`. Catalog + scope matrix:
  `docs/ENV_VARS.md`.
- **`localhost`, never `127.0.0.1`** (CORE-SEC-008): cookie host isolation
  breaks Supabase SSR auth across the two. Use `localhost` in config, `.env*`,
  Playwright `baseURL`, and any local URL.

The registry is a deploy gate, and the membership test is narrower than it
looks: not "is it a secret", not "is it production-only", but "would users be
silently harmed if this were unset in prod right now". Registering something
that only makes an optional surface 401 has already hard-failed a production
build once (PP-ogzs).
