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

## Threat Model

### Not Protected Against

- **CSRF**: Requires additional token-based protection (not yet implemented)
- **SQL Injection**: Prevented by Drizzle ORM parameterization (separate concern)
- **Abuse on non-auth surfaces**: Rate limiting is not comprehensive across the
  app. Auth actions _are_ protected — IP + account rate limiting via
  `~/lib/rate-limit` — but other surfaces are not comprehensively rate-limited.
- **DDoS**: Requires infrastructure-level protection
- **CSS injection**: `style-src` keeps `'unsafe-inline'` for CSS-in-JS and
  Next.js server-rendered styles, so inline styles are permitted. This is a
  deliberate weakening, not an oversight; tightening it to a nonce would mean
  proving every component's inline styles carry one first.
