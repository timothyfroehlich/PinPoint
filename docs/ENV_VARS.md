# Environment Variables — Catalog, Scope Matrix & Required-Secret Registry

> **Canonical reference for every env var PinPoint reads.** When you add a new
> env var, update this file _and_ — if it is production-required — the registry
> in `next.config.ts` (see [CORE-SEC-009](./NON_NEGOTIABLES.md#security)).
>
> Audit origin: PP-b3v (triggered by PP-7xt / #1307, the unsubscribe-secret
> coupling). Last full sweep: 2026-06-20.

## 1. The problem this prevents

Two real failure modes motivated this catalog:

1. **Secret coupling.** The unsubscribe HMAC secret once reused
   `SUPABASE_SERVICE_ROLE_KEY`, so rotating the Supabase key would have silently
   invalidated every outstanding unsubscribe link in users' inboxes. (Fixed in
   #1307 — `UNSUBSCRIBE_SIGNING_SECRET` is now independent.)
2. **Silent degradation in production.** A missing required secret that only
   _logs_ or _degrades_ (instead of failing loudly) ships a broken feature to
   prod undetected — a CAN-SPAM risk for the unsubscribe case.

The countermeasure is **CORE-SEC-009**: every production-required env var is
declared in a central registry that **fails the Vercel build** when missing,
and no secret is reused as a fallback for another purpose.

## 2. Validation strategy (the decision)

**Chosen: formalize the build-time registry in `next.config.ts`.** Considered
and rejected: adopting `@t3-oss/env-nextjs`.

| Option                                                                    | Verdict        | Why                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Expand the `next.config.ts` build assertion into a per-scope registry** | ✅ **Adopted** | Already the right shape — it runs in the Vercel build and can _fail the deploy_, which is the exact guarantee we want. Zero new deps. Naturally expresses "required in Production / Preview / both".                                                                                                                                                                                                                  |
| Migrate to `@t3-oss/env-nextjs` (Zod schema + type-safe `env.X`)          | ❌ Not now     | Validates at module import (all-or-nothing), which fights our "required in prod, optional in dev/CI, gracefully degrading" reality; would need conditional Zod per var. Doesn't add the Vercel-build-scope gating we already have. Type-safe access is a nice-to-have, not a correctness fix — revisit only if we specifically want typed `env.X` access; it would be its own code migration, not part of this audit. |
| A second bespoke centralized helper                                       | ❌ Redundant   | Duplicates what `next.config.ts` + `src/lib/supabase/env.ts` already do.                                                                                                                                                                                                                                                                                                                                              |

The registry lives in `next.config.ts` (`assertVercelDeploymentEnv`). It is a
list of **groups**; a group is satisfied if **any** of its alias names is set
(models the Supabase-docs-vs-Vercel-integration naming pairs). Two tiers:

- **`REQUIRED_ALL_DEPLOYMENTS`** — must be present in Production _and_ Preview.
- **`REQUIRED_PRODUCTION_ONLY`** — Production only (Preview resolves these
  another way, e.g. `NEXT_PUBLIC_SITE_URL` → `VERCEL_URL`).

The assertion is a no-op unless `VERCEL_ENV ∈ {production, preview}`, so local
and CI builds are unaffected.

## 3. Vercel scope guide ("which scope does my var go in?")

Vercel has four environment scopes. Map each new var like so:

| Scope           | What runs there                   | Rule of thumb                                                                                                                                                                                               |
| --------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Production**  | `main` → live deploy              | Every var the app needs to function for real users. Secrets live here.                                                                                                                                      |
| **Preview**     | PR preview deploys                | Tim **mirrors prod secrets** here so previews behave like prod. Env-_specific_ public config (e.g. canonical URL) is **not** mirrored — preview derives it from `VERCEL_URL`.                               |
| **Development** | `vercel dev` / local `.env.local` | Local stack values (local Supabase, Mailpit ports, dev autologin). Never real prod secrets.                                                                                                                 |
| **CI**          | GitHub Actions build/test         | Dummy/build-time values from `.env.ci`. `VERCEL_ENV` is unset, so the registry assertion does not fire. Real CI _operations_ secrets (Supabase/Vercel tokens) are GitHub Actions secrets, not app env vars. |

**Sensitivity rule (CORE-SEC-009):** a secret (key, token, password,
connection string, signing secret) must **never** be prefixed `NEXT_PUBLIC_` —
that prefix inlines the value into the client bundle.

**No-coupling rule (CORE-SEC-009):** never reuse one secret as the fallback for
a different purpose. Alias _names for the same value_ (below) are fine;
_borrowing a different secret_ is not.

## 4. Full catalog

Legend — Required: ✅ required · ⭕ recommended · ⚪ optional / degrades · 🔁 resolved via fallback · — n/a · 🚫 must be absent.
Sensitivity: 🔴 secret · 🟢 public config.

### 4.1 Production-required secrets (in the build registry)

| Var (aliases)                                                            | Sens. | Prod | Preview        | Dev | CI        | Owner module                                      | Runtime guard                                  |
| ------------------------------------------------------------------------ | ----- | ---- | -------------- | --- | --------- | ------------------------------------------------- | ---------------------------------------------- |
| `POSTGRES_URL`                                                           | 🔴    | ✅   | ✅             | ✅  | ✅(dummy) | `src/server/db/index.ts`, `drizzle.config.ts`     | throws at module load                          |
| `SUPABASE_SERVICE_ROLE_KEY` (`SUPABASE_SECRET_KEY`)                      | 🔴    | ✅   | ✅             | ✅  | ✅(dummy) | `src/lib/supabase/admin.ts`                       | throws when admin client built                 |
| `UNSUBSCRIBE_SIGNING_SECRET`                                             | 🔴    | ✅   | ✅             | ⚪  | ⚪        | `src/lib/notifications/channels/email-channel.ts` | warns once in prod if absent                   |
| `NEXT_PUBLIC_SUPABASE_URL` (`SUPABASE_URL`)                              | 🟢    | ✅   | ✅             | ✅  | ✅        | `src/lib/supabase/env.ts`                         | throws in `getSupabaseEnv()`                   |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) | 🟢    | ✅   | ✅             | ✅  | ✅        | `src/lib/supabase/env.ts`                         | throws in `getSupabaseEnv()`                   |
| `NEXT_PUBLIC_SITE_URL`                                                   | 🟢    | ✅   | 🔁`VERCEL_URL` | ⚪  | ✅        | `src/lib/url.ts`                                  | `requireSiteUrl()` throws in prod if localhost |

> `NEXT_PUBLIC_SUPABASE_*` are public (anon/publishable) keys — safe to expose —
> but still **required** for the app to boot, so they're in the registry.

> **What belongs here.** Membership is decided by "PinPoint cannot run correctly
> without this", not by "this is a secret" or "this only matters in production".
> A var that configures an **optional surface** belongs in §4.2 even when that
> surface is production-only — gating the build on it converts an unconfigured
> feature into a failed deploy. See the MCP vars in §4.2 for the worked example.

### 4.2 Production-relevant but not build-gated (degrade or feature-gate)

These intentionally **degrade gracefully** rather than fail the build. Listed so
the degradation is a known, documented choice — not an oversight.

| Var (aliases)                                             | Sens. | Prod                | Owner module                              | Behavior when absent                                                                                                                                                                                                                                                                |
| --------------------------------------------------------- | ----- | ------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POSTGRES_URL_NON_POOLING`                                | 🔴    | ✅(migrations)      | `drizzle.config.ts`                       | throws at migrate time if `POSTGRES_URL` is pooled                                                                                                                                                                                                                                  |
| `UPSTASH_REDIS_REST_URL` (`KV_REST_API_URL`)              | 🔴    | ⭕                  | `src/lib/rate-limit.ts`                   | rate limiting disabled; prod logs; non-prod degrades silently                                                                                                                                                                                                                       |
| `UPSTASH_REDIS_REST_TOKEN` (`KV_REST_API_TOKEN`)          | 🔴    | ⭕                  | `src/lib/rate-limit.ts`                   | as above                                                                                                                                                                                                                                                                            |
| `CRON_SECRET`                                             | 🔴    | ⭕                  | `src/app/api/cron/cleanup-blobs/route.ts` | cron endpoint logs error (unprotected)                                                                                                                                                                                                                                              |
| `BLOB_READ_WRITE_TOKEN`                                   | 🔴    | ✅(Vercel-injected) | `src/lib/blob/client.ts`                  | non-prod uses mock storage                                                                                                                                                                                                                                                          |
| `RESEND_API_KEY`                                          | 🔴    | ⚪                  | `src/lib/email/client.ts`                 | falls back to SMTP; auth emails go via Supabase SMTP regardless                                                                                                                                                                                                                     |
| `TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | 🔴/🟢 | ⚪                  | `src/lib/security/turnstile.ts`           | CAPTCHA skipped (widget hidden, server verify passes); prod logs                                                                                                                                                                                                                    |
| `DISCORD_CLIENT_ID` + `DISCORD_CLIENT_SECRET`             | 🔴    | ⚪                  | `src/lib/auth/providers.ts`               | Discord OAuth hidden end-to-end                                                                                                                                                                                                                                                     |
| `PINBALLMAP_API_TOKEN`                                    | 🔴    | ⭕                  | `supabase/seed-pinballmap-token.mjs`      | seed-time only (→ Vault, `pinballmap_state.api_token_vault_id`, read via `get_pinballmap_api_token()` RPC / `api-token.ts`); absent → PBM `X-Api-Token` omitted, live reads/writes fail once PBM's REQUIRE_API_TOKEN gate flips (July 30 2026). Never `NEXT_PUBLIC_`, never reused. |
| `NEXT_PUBLIC_SENTRY_DSN`                                  | 🟢    | ⭕                  | `src/components/SentryInitializer.tsx`    | Sentry not initialized                                                                                                                                                                                                                                                              |
| `MCP_BEARER_TOKEN`                                        | 🔴    | ⚪                  | `src/lib/mcp/verify-token.ts`             | MCP auth fails closed — `/api/mcp/mcp` 401s, warns `reason: "not_configured"`. Rest of PinPoint unaffected.                                                                                                                                                                         |
| `MCP_ADMIN_USER_ID`                                       | 🔴    | ⚪                  | `src/lib/mcp/verify-token.ts`             | as above                                                                                                                                                                                                                                                                            |

> **MCP remote admin (PP-u4ab).** `MCP_BEARER_TOKEN` is the shared secret a
> client presents as `Authorization: Bearer …` to `/api/mcp/mcp`; generate it
> with `openssl rand -hex 32` (minimum 32 chars — shorter values are rejected).
> `MCP_ADMIN_USER_ID` is the Supabase user UUID every MCP tool call acts as; it
> must resolve to an `admin` access level, re-checked on every request. Neither
> is `NEXT_PUBLIC_`; neither is reused as another var's fallback. Rotate by
> changing `MCP_BEARER_TOKEN`.
>
> **Deliberately not build-gated.** These are required for **MCP** to work, not
> for **PinPoint** to work. Both are unset → the MCP endpoint 401s and every
> other surface is untouched, which is the correct degraded state for an
> optional single-user admin tool. They were briefly added to the §4.1 registry
> and the first production deploy after that change hard-failed at `next build`
> with the vars simply not yet set — an optional feature taking prod deploys
> down with it. Don't put them back (PP-ogzs).

### 4.3 Local / CI / test-only config

| Var (aliases)                                                                   | Sens.         | Scope    | Owner module                               | Notes                                                                          |
| ------------------------------------------------------------------------------- | ------------- | -------- | ------------------------------------------ | ------------------------------------------------------------------------------ |
| `PORT`                                                                          | 🟢            | Dev      | `src/lib/url.ts`, `src/lib/blob/client.ts` | default `3000`                                                                 |
| `EMAIL_TRANSPORT`                                                               | 🟢            | Dev/CI   | `src/lib/email/client.ts`                  | `smtp` → Mailpit; unset → Resend                                               |
| `MAILPIT_PORT` / `MAILPIT_SMTP_PORT` (`INBUCKET_PORT` / `INBUCKET_SMTP_PORT`)   | 🟢            | Dev/CI   | `src/lib/email/client.ts`                  | per-worktree test mail ports                                                   |
| `DEV_AUTOLOGIN_ENABLED` / `_EMAIL` / `_PASSWORD`                                | 🔴(dev creds) | Dev      | `src/lib/supabase/middleware.ts`           | 🚫 must be absent/`false` in prod                                              |
| `DEV_ALLOWED_ORIGINS`                                                           | 🟢            | Dev      | `next.config.ts`                           | comma-sep origins for cross-machine `next dev`; ignored by `next build`/Vercel |
| `PINBALLMAP_MODE`                                                               | 🟢            | All      | `src/lib/pinballmap/config.ts`             | `live` in prod, `mock` elsewhere by default                                    |
| `MOCK_BLOB_STORAGE`                                                             | 🟢            | Dev/test | `src/lib/blob/client.ts`                   | feature flag                                                                   |
| `DRIZZLE_FORCE_PRODUCTION`                                                      | 🟢            | Ops      | `drizzle.config.ts`                        | explicit opt-in guard for prod DDL                                             |
| `LOG_LEVEL` / `PINPOINT_LOG_DIR`                                                | 🟢            | All      | `src/lib/logger.ts`                        | defaults: `info` / `<cwd>/logs`                                                |
| `SKIP_SUPABASE_RESET`, `E2E_DOCKER_READY_ATTEMPTS`, `E2E_DOCKER_READY_DELAY_MS` | 🟢            | CI/test  | `e2e/global-setup.ts`                      | E2E harness tuning                                                             |

### 4.4 Platform-set (do not manage manually)

`NODE_ENV`, `VERCEL_ENV`, `VERCEL_URL`, `NEXT_RUNTIME`, `CI`, `PLAYWRIGHT_*` —
injected by Next.js / Vercel / GitHub Actions / Playwright. Read-only inputs.

### 4.5 CI operations secrets (GitHub Actions, not app runtime)

Stored as GitHub Actions secrets, consumed only by workflows (preview branch
lifecycle, deploys) — never read by the app:
`GITHUB_TOKEN`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`, `VERCEL_TOKEN`,
`VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

## 5. Alias pairs (same value, two accepted names)

These are **dual _names_ for one value** (Supabase docs vs Vercel integration
naming) — not coupling. The registry treats each pair as "any one satisfies":

- `NEXT_PUBLIC_SUPABASE_URL` ⇄ `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ⇄ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` ⇄ `SUPABASE_SECRET_KEY`
- `UPSTASH_REDIS_REST_URL` ⇄ `KV_REST_API_URL`
- `UPSTASH_REDIS_REST_TOKEN` ⇄ `KV_REST_API_TOKEN`
- `MAILPIT_PORT` ⇄ `INBUCKET_PORT`, `MAILPIT_SMTP_PORT` ⇄ `INBUCKET_SMTP_PORT`
- `POSTGRES_URL_NON_POOLING` is a **distinct** value (session pooler), not an
  alias of `POSTGRES_URL` (transaction pooler) — see AGENTS.md §7.

**Audit result:** no _dangerous_ couplings remain. The historical
`UNSUBSCRIBE_SIGNING_SECRET` ↔ `SUPABASE_SERVICE_ROLE_KEY` reuse is fixed; all
remaining fallbacks are benign same-value aliases.

## 6. Adding a new env var — checklist

1. **Pick the scope(s)** using §3. Default to deny — only the scopes that need it.
2. **Sensitivity:** secret → never `NEXT_PUBLIC_`; public config → `NEXT_PUBLIC_` only if the browser truly needs it (it ends up in page source).
3. **No coupling:** give it its own value; never borrow another secret as a fallback (alias _names_ for the same value are fine).
4. **If production-required:** add it to the registry in `next.config.ts`
   (`REQUIRED_ALL_DEPLOYMENTS` or `REQUIRED_PRODUCTION_ONLY`), so a missing value
   fails the build instead of degrading silently.
5. **Document it here** (the right §4 table) and add it to `.env.example` (and
   `.env.ci` if the CI build reads it).
6. **Set it in Vercel** for each chosen scope (Project Settings → Environment
   Variables).
