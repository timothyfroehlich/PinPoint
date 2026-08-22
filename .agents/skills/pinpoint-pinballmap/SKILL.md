---
name: pinpoint-pinballmap
description: PinballMap integration conduct and the PinPoint client seam. Use when changing PinballMap reads or writes; files under src/lib/pinballmap; PinballMap cron routes, actions, credentials, refresh behavior, fixtures, or attribution links; or reviewing PinballMap API compliance.
---

# PinPoint PinballMap

## Start with the current contract

Before changing the integration, read `docs/external/README.md` and the relevant vendored PinballMap contract files. They are the local record of PinballMap's external terms, API guidance, robots policy, and attribution requirement. Do not crawl or live-probe PinballMap as a development shortcut. For endpoint wire behavior, consult the PinballMap OSS RSpec request specs named by `docs/external/README.md`; notably, some logical errors arrive in a `200` response body and `ic_toggle` is a toggle operation.

`docs/NON_NEGOTIABLES.md` is the canonical `CORE-PBM-*` rule catalog. Feature requirements belong in `docs/feature-specs/pinballmap.md`, not here.

## Use the single server-side seam

All PinballMap access goes through `~/lib/pinballmap` and `getPinballMapClient`. Do not add raw `fetch`, browser calls, per-page reads, or hand-built API URLs. Only the live client makes real HTTP; outside Vercel production `PINBALLMAP_MODE` defaults to the mock client.

Keep API and operator credentials server-side, use the existing Vault-backed paths for write credentials, and never log credentialed URLs. Do not perform external HTTP inside a database transaction.

## Keep traffic polite and bounded

Render the stored location snapshot. Refresh it only through `syncLocationSnapshot`:

- The hourly cron is the single automated refresh path.
- Manual refreshes use the one shared global bucket: burst 3, then one token every 3 minutes, at most 20 attempts per hour. Failed attempts spend a token.
- Never bypass that bucket, poll, crawl, issue N+1 reads, or fetch on page render. Use documented bulk JSON endpoints and the established descriptive user agent.

A Server Action or route invoked when a page opens is automated, not a manual refresh; it must not call `syncLocationSnapshot`.

Preserve the live client's serialized writes and bounded `429` handling. Reuse stored tokens rather than obtaining credentials again per request.

## Attribute and test correctly

When showing data for a specific PinballMap location, use `pinballmapLocationUrl` for the required location-listing attribution; do not construct the URL or link only to the homepage.

Unit and E2E tests must use the mock client at the seam and committed captured fixtures. The fixture-refresh script is a deliberate manual GET-only operation, never test setup or a routine live call.
