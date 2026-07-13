# Runbook: Turnstile Fail-Open Monitoring & Supabase-Captcha Invariant

## Why this matters

PinPoint's four auth actions (login, signup, forgot-password, reset-password)
verify a Cloudflare Turnstile token **fail-open**: `verifyTurnstileFailOpen`
(`src/lib/security/turnstile.ts`) always returns `{ allowed: true }`, even when
the token is missing, rejected, or unverifiable. This is an intentional,
Tim-signed-off tradeoff (PP-20yy, 2026-07-10): availability > strict captcha
enforcement, with IP + account rate limiting as the real abuse backstop. Turnstile
here is best-effort deterrence, not a hard boundary.

That design is **not** in question. What this runbook covers is its operational
durability — the two things that keep the fail-open gate safe to run:

1. A silent precondition (Supabase project-level captcha **must stay disabled**)
   that, if broken, silently breaks production auth.
2. A monitoring + action plan for a sustained fail-open spike (which would
   indicate bot abuse exploiting the weakened gate, or a Turnstile outage).

## Invariant: Supabase project-level captcha MUST stay disabled

**Rule:** Supabase Auth captcha protection must remain **disabled** for the
project while the fail-open gate is in place.

**Why:** PinPoint verifies Turnstile itself (fail-open) instead of delegating to
Supabase's built-in captcha protection. If Supabase captcha were enabled:

- Supabase would reject the very **tokenless** submissions this fail-open gate is
  designed to let through — upstream of our check — silently breaking auth for
  every user whose Turnstile widget fails (slow/blocked script, challenge
  timeout, network blip, ad-blocker interference). These users would be locked
  out with no way forward, which is exactly the lockout PP-20yy set out to end.
- Supabase would also **double-spend** the single-use Turnstile token we already
  consume in `verifyTurnstileFailOpen`, so even token-bearing submissions could
  fail.

This precondition is currently enforced only by convention: a code comment in
`verifyTurnstileFailOpen` and a `NOTE` at each auth-action call site
(`src/app/(auth)/actions.ts`). There is **no runtime assertion** — a future
security-hardening pass that re-enables Supabase captcha would break production
auth silently. See "Why there is no startup assertion" and the "Follow-ups"
section below.

### Manual verification (external — Tim only)

The Supabase captcha setting lives in the project's Auth config, not in any
PinPoint env var or code, so it can only be verified from the Supabase dashboard:

1. Supabase dashboard → **`PinPoint-Prod`** project (Advacar org) →
   **Authentication** → **Attack Protection** (formerly "Bot and Abuse
   Protection").
2. Confirm **"Enable Captcha protection"** is **OFF**.
3. If it is ON, PinPoint auth is currently broken for tokenless users — turn it
   OFF, or coordinate a full revert of the fail-open design (see the client
   `useTurnstileGate` gate + `verifyTurnstileFailOpen`; both sides must flip
   together).

Re-check this whenever anyone touches Supabase Auth settings, and as part of the
weekly security review routine.

**Last verified: 2026-07-13 — OFF (correct state), by Claude via browser
automation.** (PP-fy4v)

### Why there is no startup assertion (design note)

The obvious enforcement — a startup assertion that reads the Supabase Auth
captcha setting and errors if it is enabled — was considered and deliberately
deferred (PP-vo43). Reading that setting requires a **Supabase Management API**
network call with a management/admin token at boot. That would:

- add a network dependency to app startup (a failed/slow call could break boot),
  and
- put a third-party admin API on the boot path.

Neither is acceptable for a precondition that changes only when a human edits a
dashboard setting. The durable enforcement is therefore this documented invariant
plus the weekly-review check, not runtime code. See the follow-up below if we
later want a cheap out-of-band assertion (e.g. a scheduled cloud routine that
polls the Management API and posts to the security channel, off the boot path).

## Monitoring: fail-open spike

Every fail-open path emits both a structured log line
(`event: "turnstile_fail_open"`) and a Sentry message:

```ts
Sentry.captureMessage("turnstile.fail_open", {
  level: "warning",
  tags: { action, turnstileOutcome: outcome.kind },
  extra: detail,
});
```

`action` is one of `login | signup | forgot-password | reset-password`;
`turnstileOutcome` is `missing-token | invalid-token | unverifiable`.

A **sustained spike** in these events is the signal to act. A low background rate
is expected and healthy (real Turnstile flakiness is why fail-open exists) — only
a sustained elevation above the threshold warrants investigation.

### Sentry alert rule (external — Tim only)

Create an Issue/Metric alert in **Alerts** on the `turnstile.fail_open` message
event rate:

| Field       | Value                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------- |
| Name        | `Turnstile fail-open spike`                                                               |
| Environment | `vercel-production`                                                                       |
| Condition   | `message` **contains** `turnstile.fail_open`, and the issue has **> 50 events in 1 hour** |
| Action      | Notify **Tim Froehlich directly** (interim — no Slack security channel yet)               |
| Frequency   | 1 hour (action throttle)                                                                  |

> In the Sentry UI (Monitors & Alerts → New Alert), this maps to: an IF filter
> "The event's `message` attribute `contains` `turnstile.fail_open`" combined
> (via "Filter by frequency" → "Number of events") with "Number of events in an
> issue is more than `50` in `one hour`". Environment on this org is tagged
> `vercel-production`, not `production`.

**Created: 2026-07-13, by Claude via browser automation** (PP-fy4v) —
[`pinpoint-nc.sentry.io/monitors/alerts/3700455`](https://pinpoint-nc.sentry.io/monitors/alerts/3700455/?project=4510484045692928).
No Slack integration is connected to this Sentry org yet, so the action
currently notifies **Tim Froehlich directly** (Notify → Member) rather than a
dedicated security channel — add a Slack integration and repoint the action
if/when a `#alerts-security` channel exists.

### Action plan on a sustained spike

When the alert fires (or you spot a sustained spike manually):

1. **Triage the cause.** Break down `turnstile.fail_open` events by
   `turnstileOutcome` tag:
   - Mostly `unverifiable` (esp. `reason: http-*` / `fetch-error`) → likely a
     **Cloudflare/Turnstile outage or a misconfigured/missing prod secret**, not
     abuse. Check Cloudflare status and that `TURNSTILE_SECRET_KEY` /
     `NEXT_PUBLIC_TURNSTILE_SITE_KEY` are set in prod. No security action needed;
     the gate is doing its job (keeping auth up during an outage).
   - Mostly `missing-token` / `invalid-token` concentrated on `signup` /
     `forgot-password`, correlated with a burst from few IPs/accounts → likely
     **bot abuse** exploiting the weakened gate. Proceed to remediation.

2. **Confirm the rate-limit backstop is holding.** IP + account rate limiting
   (the `checkLoginIpLimit` / `checkLoginAccountLimit` / `checkSignupLimit` /
   email-based limit calls in `src/app/(auth)/actions.ts`, from `~/lib/rate-limit`)
   is the real abuse backstop. Check whether abusive traffic is already being
   turned away with `RATE_LIMIT`. If it is, the spike may be noisy but contained.

3. **Remediate if the backstop is insufficient.** Two levers, in order of
   preference:
   - **Tighten Supabase Auth rate limits** (dashboard → Authentication → Rate
     Limits) and/or the app-level limits. This is the availability-preserving
     option and should be tried first.
   - **Last resort — re-enable Supabase captcha AND disable the fail-open gate in
     tandem.** These two changes MUST ship together (never one without the
     other), because Supabase captcha rejects the tokenless submissions the
     fail-open gate lets through. Flip the client `useTurnstileGate` back to
     fail-closed, change `verifyTurnstileFailOpen` callers to
     `verifyTurnstileToken` (fail-closed), and enable Supabase captcha. This
     re-introduces the lockout risk PP-20yy fixed, so treat it as a temporary
     incident measure, not a permanent reversal — and coordinate with Tim.

## Follow-ups

These were **manual dashboard actions that cannot be executed from code**,
tracked as follow-ups to PP-vo43 and completed via PP-fy4v (2026-07-13):

1. ~~**Create the Sentry alert rule** on `turnstile.fail_open` event rate
   (> 50/hour → security channel), per the table above.~~ Done — see "Sentry
   alert rule" above. Notifies Tim directly pending a Slack integration.
2. ~~**Verify the live Supabase Auth captcha setting is disabled** on
   `PinPoint-Prod`.~~ Done — confirmed OFF, see "Manual verification" above.
   Re-verify whenever anyone touches Supabase Auth settings.
3. **(Optional) Out-of-band captcha-setting assertion.** If we want automated
   enforcement of the invariant without a boot-path dependency, add a scheduled
   cloud routine (off the request/boot path) that polls the Supabase Management
   API for the captcha setting and posts to the security channel if it is
   enabled. Deferred as lower value than this documented invariant + weekly check.

## Related

- `src/lib/security/turnstile.ts` — `verifyTurnstileFailOpen` and the outcome model
- `src/app/(auth)/actions.ts` — the four auth actions and their `NOTE` comments
- `docs/SECURITY.md` — "Authentication CAPTCHA (Turnstile fail-open)" section
- `docs/runbooks/sentry-alert-best-effort.md` — the other PinPoint Sentry alert rules
- PP-20yy — the fail-open design decision; PP-vo43 — this operational-durability work
