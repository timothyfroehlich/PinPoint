# PinballMap API — conduct & attribution (distilled)

Our working summary of how PinPoint must behave toward PinballMap. Authoritative
sources: the vendored `pinballmap-llms.txt` (API guidance) and PBM's
[FAQ](https://pinballmap.com/faq). When this summary and `pinballmap-llms.txt`
disagree, **`pinballmap-llms.txt` wins** — fix this file.

## API token — mandatory from July 30 2026 (blog 2026-07-16)

PBM is closing its previously-open API behind a required `api_token`. Once their
`REQUIRE_API_TOKEN` gate flips on (**July 30 2026**), **every v1 endpoint — reads
included — requires the token.** Two-layer auth model (confirmed from the pbm
`Api::V1::BaseController` source):

- **`api_token`** — the blanket access gate for **reads and writes**. Sent as the
  `X-Api-Token` header (or `?api_token=` query param; we use the header). Tied to
  an approved, revocable user account. **Global limit: 120 requests/min per
  token.** Requested once at pinballmap.com/api_token with a use-plan; there is no
  rotation API.
- **Operator write creds** (`user_email` + `user_token`) — writes **also** still
  need the per-operator identity as query params (the `auth_details` token). This
  is a distinct layer from the access gate.

→ We inject `X-Api-Token` on **every** request in the live client
(`createLiveClient(apiToken)`). The token is stored in Supabase Vault
(`pinballmap_state.api_token_vault_id`) and decrypted via the
`get_pinballmap_api_token()` service-role RPC. Header is omitted only while the
integration is unprovisioned (token null). Never log the token.

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
