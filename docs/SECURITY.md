# PinPoint Security — recorded decisions

The security headers themselves are not documented here. `next.config.ts` sets
the static headers (HSTS, `X-Frame-Options`, `X-Content-Type-Options`,
`Referrer-Policy`, `Permissions-Policy`); the root `middleware.ts` builds the
Content-Security-Policy and the per-request nonce. Read those files for the
current values — a table here would only drift from them. How to author a CSP
change (production-branch-first, what is already allowlisted, the `x-nonce`
contract) is in the `pinpoint-security` skill; the enforced rules are
`CORE-SEC-*` and `CORE-SSR-*` in `docs/NON_NEGOTIABLES.md`.

What follows is the part that lives nowhere else: choices made against a
specific threat, and the gaps we know we have.

## script-src 'strict-dynamic'

The `'strict-dynamic'` directive allows scripts loaded by nonce'd scripts to execute without their own nonce. This is necessary for:

- Next.js dynamic imports
- Third-party scripts loaded by trusted code
- Client-side routing and code splitting

**Trade-off**: Slightly relaxes CSP but required for modern JavaScript frameworks. The initial script must still have a valid nonce.

## Authentication CAPTCHA (Turnstile fail-open)

PinPoint's four auth actions (login, signup, forgot-password, reset-password)
verify a Cloudflare Turnstile token **fail-open** in `verifyTurnstileFailOpen`
(`src/lib/security/turnstile.ts`): the gate always allows the submission through,
even when the token is missing, rejected, or unverifiable. This is an intentional,
Tim-signed-off tradeoff (PP-20yy): availability > strict captcha enforcement,
because a fail-closed gate repeatedly locked real users out when the Turnstile
widget failed transiently. IP + account rate limiting is the real abuse backstop;
captcha here is best-effort deterrence.

### Invariant: Supabase project-level captcha MUST stay disabled

Because PinPoint verifies Turnstile itself (fail-open) instead of delegating to
Supabase's built-in captcha protection, **Supabase Auth captcha protection must
remain disabled** for the project. If it were enabled, Supabase would reject the
tokenless submissions the fail-open gate is designed to let through — upstream of
our check — silently breaking auth for every user whose widget fails, and it would
double-spend the single-use token we already consume.

This precondition is enforced only by convention today (a code comment in
`verifyTurnstileFailOpen` and a `NOTE` at each call site in
`src/app/(auth)/actions.ts`); there is **no runtime assertion**. A startup
assertion was deliberately deferred (PP-vo43) because reading the setting requires
a Supabase Management API call on the boot path, which could break startup. The
durable enforcement is the documented invariant plus a manual dashboard check —
see the monitoring runbook: `docs/runbooks/turnstile-fail-open-monitoring.md`.

### Monitoring: fail-open spike

Every fail-open path emits a structured log line (`event: "turnstile_fail_open"`)
and a Sentry message (`turnstile.fail_open`, tagged with `action` and
`turnstileOutcome`). A sustained spike may indicate bot abuse exploiting the
weakened gate (or a Turnstile outage). The alert threshold (**> 50/hour → security
channel**) and the spike action plan (triage by outcome → tighten rate limits →
last-resort re-enable Supabase captcha + fail-closed gate in tandem) are documented
in `docs/runbooks/turnstile-fail-open-monitoring.md`. Creating the Sentry alert
rule and verifying the live Supabase setting are manual dashboard actions tracked
there as follow-ups.

## Threat Model

### Not Protected Against

- **CSRF**: Requires additional token-based protection (not yet implemented)
- **SQL Injection**: Prevented by Drizzle ORM parameterization (separate concern)
- **Abuse on non-auth surfaces**: Rate limiting is not comprehensive across the
  app. Auth actions _are_ protected — IP + account rate limiting via
  `~/lib/rate-limit`, plus the best-effort fail-open Turnstile gate (see
  "Authentication CAPTCHA (Turnstile fail-open)" above) — but other surfaces are
  not comprehensively rate-limited.
- **DDoS**: Requires infrastructure-level protection
