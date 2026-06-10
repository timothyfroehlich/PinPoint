# Runbook: Vercel Log Drain → Sentry (platform kill observability)

## Why this matters

Vercel 504 timeouts, SIGKILL (OOM), and function cold-start failures are
platform-level events that happen outside the Node.js process. They never
reach `onRequestError` or the Sentry SDK — they only appear in the ephemeral
Vercel runtime log stream, which is not retained or alertable by default.

Wiring a Vercel Log Drain to Sentry makes those events observable:

- Function timeout / `504 FUNCTION_INVOCATION_TIMEOUT`
- OOM / SIGKILL (`FUNCTION_INVOCATION_CRASHED`)
- Cold-start failures
- Edge middleware rejections

### What `enableLogs: true` does — and does NOT — do

PP-2053.12 set `enableLogs: true` in the server, edge, and client Sentry
configs. This only **opens Sentry's Logs ingestion channel** — it does not by
itself forward any application logs. Nothing emits into that channel yet:

- There are no `Sentry.logger.*` calls in the codebase.
- `consoleLoggingIntegration` is not enabled.
- The app's pino logger writes only to stdout; it is **not** wired to Sentry.

So `enableLogs: true` is a prerequisite toggle, not a working log pipeline.
Two separate, still-pending pieces of work close the actual gaps:

1. **Platform kills (this runbook): the Vercel Log Drain is the real
   mechanism.** 504/SIGKILL/OOM events live in Vercel's runtime log stream,
   outside the Node.js process, and can never reach the Sentry SDK. The drain
   below is what makes them observable.
2. **In-process app-log forwarding (FOLLOW-UP, tracked as PP-2ta0).** Routing
   pino logs (or `console.*`) into Sentry's Logs channel — via
   `consoleLoggingIntegration` or a pino transport — plus a `beforeSendLog`
   PII/noise scrubber (touches CORE-SEC-007 email privacy). **Not done here.**

This runbook covers item 1 only.

---

## Decision: Vercel → Sentry via HTTP log drain

Vercel supports two drain types: **HTTP** and **Datadog**. Sentry does not
have a native Vercel integration that accepts a drain directly, so the
correct approach is an HTTP drain that POSTs NDJSON log lines to a small
Vercel Serverless Function (or Edge Function) acting as a forwarder.

### Architecture

```
Vercel runtime logs
       │  HTTP POST (NDJSON)
       ▼
/api/log-drain  (Vercel Serverless Function, same project)
       │  Sentry.captureEvent / Sentry.captureMessage
       ▼
Sentry project
```

The forwarder function:

1. Verifies the Vercel signature header (`x-vercel-signature`) using
   `VERCEL_DRAIN_SECRET`.
2. Parses each NDJSON line.
3. Filters to actionable severities (`error`, `fatal`, and Vercel system
   events like `FUNCTION_INVOCATION_TIMEOUT`).
4. Maps each log line to a Sentry event and calls `Sentry.captureEvent`.

---

## Step-by-step wiring

### 1. Create the forwarder function

Add `src/app/api/log-drain/route.ts` (or a standalone serverless function).
It must be excluded from middleware auth — add its path to the public-routes
list in `middleware.ts`.

Key implementation points:

- Read `VERCEL_DRAIN_SECRET` from env and verify the HMAC-SHA1 signature on
  the `x-vercel-signature` header before processing any payload.
- Parse the body as NDJSON (one JSON object per line).
- Each line has at minimum: `{ type, source, deploymentId, timestamp, message }`.
- System events (`type: "lambda"` with fatal signals) carry a `proxy` object
  with `statusCode` and `region`.
- Emit to Sentry with appropriate level (`error` or `fatal`) and tag
  `source: "vercel-log-drain"` so they can be filtered in Sentry.

### 2. Add the env variable

```
VERCEL_DRAIN_SECRET=<random 32-byte hex string>
```

Add to Vercel project env vars (all environments: Production, Preview,
Development). Generate with: `openssl rand -hex 32`.

### 3. Register the log drain in Vercel

**Via Vercel Dashboard:**

1. Project → Settings → Log Drains → Add Drain.
2. URL: `https://<your-production-domain>/api/log-drain`.
3. Sources: check **Build**, **Edge**, **Lambda**, and **Static** — at
   minimum Lambda is required for function kills.
4. Delivery format: **NDJSON**.
5. Secret: paste `VERCEL_DRAIN_SECRET`.
6. Save. Vercel will send a test request; check the function logs to confirm
   the signature check passes.

**Via Vercel CLI** (alternative):

```sh
vercel log-drains add \
  --url https://<production-domain>/api/log-drain \
  --sources lambda,edge,build \
  --delivery-format ndjson \
  --secret "$VERCEL_DRAIN_SECRET"
```

### 4. Deploy and verify

1. Deploy the forwarder function to production.
2. Trigger a deliberate timeout (e.g. a test route with a 35s sleep) on a
   preview environment if you have one, or watch existing Vercel logs for
   the next natural occurrence.
3. Confirm a Sentry event appears tagged `source: vercel-log-drain` within
   seconds.

---

## Filtering recommendations (Sentry side)

Create a Sentry alert rule:

- Condition: `source:vercel-log-drain level:error` OR `level:fatal`
- Action: notify on-call channel (Discord webhook or email)

Exclude noisy cold-start noise by adding the existing `beforeSend` filter
(or a server-side inbound filter in Sentry project settings) for the
`"Tenant or user not found"` pattern that already covers preview cold-starts.

---

## Cost considerations

Vercel charges for log drain egress on Pro/Enterprise plans; Lambda log
volume on PinPoint is low (beta-scale), so cost impact is negligible. The
forwarder function invocations are also negligible — they are billed at
the same rate as any other serverless function.

Sentry event quota: system log lines are low-frequency (kills are rare). If
quota becomes a concern, filter to `fatal` and `FUNCTION_INVOCATION_TIMEOUT`
only inside the forwarder before calling `captureEvent`.

---

## Reference

- Vercel log drain docs: https://vercel.com/docs/observability/log-drains
- Sentry `captureEvent` API: https://docs.sentry.io/platforms/javascript/usage/#capturing-events
- HMAC signature verification: https://vercel.com/docs/observability/log-drains/log-drains-reference#secure-log-drains
