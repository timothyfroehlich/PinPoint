---
paths:
  - "src/lib/pinballmap/**"
  - "src/lib/cron/**"
  - "docs/external/pinballmap-*"
---

# Touching the PinballMap integration

Full statement, severity, and do/don't: `docs/NON_NEGOTIABLES.md`.

- **Respect PinballMap API conduct** (CORE-PBM-001): all PBM access goes
  through the `~/lib/pinballmap` client seam using the documented JSON API —
  cron does one automated sync call/hour, manual refreshes are throttled at the
  `syncLocationSnapshot` seam to ≤20/hour (one per 3 min, against last attempt
  — PP-hbi0), store+reuse tokens (`api_token` from the `PINBALLMAP_API_TOKEN`
  env var, per-operator write creds in Vault), descriptive User-Agent, 429
  backoff, attribution + a **location-specific** link-back
  (`pinballmapLocationUrl()`, never a hand-written URL) when rendering PBM data.
  Never crawl pinballmap.com or reach it from tests. Re-read
  `docs/external/pinballmap-*` before changing integration code.

This is a conduct commitment to someone else's service, not an internal
preference — the vendored terms and `llms.txt` in `docs/external/` are the
source, and they are why this rule loads on that directory too.
