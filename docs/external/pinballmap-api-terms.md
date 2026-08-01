# PinballMap API — conduct & attribution (distilled)

Our working summary of how PinPoint must behave toward PinballMap. Authoritative
sources: the vendored `pinballmap-llms.txt` (API guidance) and PBM's
[FAQ](https://pinballmap.com/faq). When this summary and `pinballmap-llms.txt`
disagree, **`pinballmap-llms.txt` wins** — fix this file.

## Authentication (llms.txt — changed 2026-07-18)

**As of 2026-07-30, every request requires an `api_token`** — including
read-only GETs, which were previously public. (Lone exception:
`location_machine_xrefs/most_recent_by_lat_lon`, which PBM does not gate.)

- **Request the token now** at <https://pinballmap.com/api_token> (needs a
  Pinball Map account; approval is manual). "Request a token now, even if you
  don't need it yet — do not wait until requests start failing."
- Send it as the **`X-Api-Token` header** on every request. PBM's `llms.txt`
  documents an `api_token=` query param, and their source accepts both; we use
  the header to keep the credential out of URLs and logs.
- **Writes need a second, separate credential** on top of the `api_token`: the
  `user_email` + `user_token` identity (obtained once via `auth_details`, then
  stored — never re-fetched per request). So a write carries **both** layers.
- Store the `api_token` in Vault; it is app-level and revocable.

→ Obtaining + wiring the token is tracked in bead **PP-uusr** (blocks the prod
rollout `PP-o355.10`).

## Attribution (FAQ)

> Users must include attribution and a link back to this site when using
> Pinball Map data.

→ Anywhere we render PBM-sourced data (imported condition comments, listing
status), show attribution and a link back to pinballmap.com. The imported-comment
timeline item carries "via PinballMap" + a link to the machine on PBM.

## Request volume & polling (llms.txt)

- "If your app is making hundreds of requests, it is almost certainly designed
  incorrectly." A well-designed client makes **fewer than ~10 calls** at startup.
- Use **bulk endpoints with filters**, never N+1 loops over individual records.
- **"Do not poll the API repeatedly to detect changes… build your own sync
  schedule with reasonable intervals."** → our snapshot sync is **one location
  call per hour**.
- "Fetch the token once, store it, reuse it." → never call `auth_details` per
  request. There is **no token expiry/rotation** mechanism.

## Rate limits (llms.txt — HTTP 429 on exceed)

Relevant to our writes:

| Operation                                             | Limit               |
| :---------------------------------------------------- | :------------------ |
| `POST /location_machine_xrefs` (add machine)          | no controller limit |
| `PUT /location_machine_xrefs/:id` (update condition)  | 50 / 10 min         |
| `DELETE /location_machine_xrefs/:id` (remove machine) | 100 / 10 min        |
| `PUT /machine_conditions/:id`                         | 50 / 5 min          |
| `GET /users/auth_details`                             | 40 / 5 min          |

→ The live client serializes writes and backs off on 429 within a small budget,
then reports `rate_limited`. We are nowhere near these limits in normal use.

## Sanctioned channel (robots.txt)

PBM's `robots.txt` blocks AI crawlers (`ClaudeBot`, `anthropic-ai`, etc.) from
the website. The **documented JSON API is the sanctioned channel** — use it (per
`llms.txt`); never scrape pinballmap.com HTML. Identify our traffic with a
descriptive User-Agent that includes a contact URL.
