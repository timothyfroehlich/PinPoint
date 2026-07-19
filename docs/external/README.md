# Vendored external references — PinballMap

Verbatim copies of PinballMap's published API-conduct documents, plus a short
terms summary. These are the **source of truth** any agent or developer should
read before touching the PinballMap integration (`src/lib/pinballmap/`).

| File                      | What                                                                                   | Provenance                                                             |
| :------------------------ | :------------------------------------------------------------------------------------- | :--------------------------------------------------------------------- |
| `pinballmap-llms.txt`     | PBM's own API guidance for AI assistants — auth, rate limits, anti-patterns, endpoints | Fetched verbatim from `https://pinballmap.com/llms.txt` (2026-07-18)   |
| `pinballmap-robots.txt`   | PBM's robots policy — blocks AI crawlers from the site                                 | Fetched verbatim from `https://pinballmap.com/robots.txt` (2026-07-18) |
| `pinballmap-api-terms.md` | Our distilled conduct + attribution notes, with sources                                | Authored by us, cites llms.txt + FAQ                                   |

> **2026-07-18 refresh — mandatory `api_token` incoming.** PBM is closing its
> previously-public read API behind a required `api_token` **on 2026-07-30**
> (blog `2026/07/16/api-tokens`; enforcement in their
> `Api::V1::BaseController#require_api_token`, gated by `ENV["REQUIRE_API_TOKEN"]`).
> Once live, **every** request — GET reads included — needs the token (the lone
> exception is `location_machine_xrefs/most_recent_by_lat_lon`). Supply it as the
> `X-Api-Token` header (the source also accepts an `api_token=` query param, but
> we keep the secret out of URLs). Writes **additionally** need the existing
> `user_email` + `user_token` identity — two separate layers. Obtaining + wiring
> the token is tracked in bead **PP-uusr** (blocks rollout `PP-o355.10`).

## Why these are vendored

1. **Compliance is a moving target.** These copies must stay **byte-identical**
   to what PBM serves, or our conduct posture silently drifts from the current
   policy. The weekly chores routine
   (`.agents/skills/pinpoint-chores/SKILL.md`) diffs the live `llms.txt` and
   `robots.txt` against the vendored copies here and refreshes them on drift —
   there is no automated drift GHA. Do not edit these by hand; refresh from
   source.
2. **The API is the sanctioned channel; the website is not.** `robots.txt`
   blocks `ClaudeBot`/`anthropic-ai`/etc. from crawling pinballmap.com. Always
   use the documented JSON API (per `llms.txt`), never scrape the site.

## API contract source (request/response shapes & error behavior)

`llms.txt` documents conduct, not exact wire shapes. For those — request params,
success bodies, status codes, and **every error path** — the authoritative source
is PinballMap's own open-source test suite:

> `pinballmap/pbm` → `spec/requests/api/v1/*_controller_spec.rb`
> (controllers: `app/controllers/api/v1/*_controller.rb`, and
> `app/controllers/application_controller.rb` for shared constants like
> `AUTH_REQUIRED_MSG`). Actively maintained; read the spec, don't probe live.

Two behaviors the client seam (`src/lib/pinballmap/client-live.ts`) is built
against, which are easy to get wrong:

- **Logical failures return HTTP `200` with `{"errors":"<message>"}`** — not a
  4xx. (`"Failed to find machine"`, the `AUTH_REQUIRED_MSG`, `"Incorrect
password"`, `"Could not update Insider Connected for this machine"`, …) The
  **one** status-based exception is a disabled account: `401` + singular
  `{"error":"account_disabled"}`. Classify on the body, never on `res.ok` alone,
  or failed writes look like successes.
- **`ic_toggle` is a toggle, not a setter** — it ignores any state param and
  inverts the current value, returning the new state.

If you change integration code, re-derive the contract from that spec suite (or
extend `scripts/pinballmap/refresh-fixture.ts`, which is GET-only). Never reach
pinballmap.com from tests (CORE-TEST-006).

See `docs/NON_NEGOTIABLES.md` (CORE-PBM-001) and the integration spec
`docs/superpowers/specs/2026-06-18-pinballmap-integration-design.md`.
