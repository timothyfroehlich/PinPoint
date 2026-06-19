# PinballMap Integration — Design

**Date:** 2026-06-18
**Status:** Approved — epic created
**Epic:** PP-o355 (children PP-o355.1–.10 — see §6)
**Branch:** `worktree-pinballmap`
**Wireframes:** `docs/superpowers/specs/2026-06-07-pinballmap-wireframes.html` (PinPoint-styled, open in a browser)

---

## 1. Goal & philosophy

Integrate PinPoint with [PinballMap.com](https://pinballmap.com) (PBM) for the Austin Pinball Collective location (PBM location id **26454**). The integration is **not lockstep**: PinPoint remains the source of truth for our machines; PBM is a public community map we keep roughly in sync via human-confirmed actions and surfaced CTAs, while pulling PBM's community comments into our machine timelines.

Core outcomes:

1. **Display** PBM listing status on the machine Info tab (status-only card).
2. **Surface CTAs** to update PBM when a machine's availability changes (presence transitions), without forcing it.
3. **Require** a PBM catalog link (or an explicit "not on PinballMap" flag) on every machine, pulling model metadata (manufacturer, year, OPDB/IPDB ids) on link.
4. **Tech/admin status page** showing bidirectional desync, a linking backlog, and map-side additions to import.
5. **Sync PBM comments** into machine timelines, with a one-shot "convert to issue" action and watcher notifications.
6. **Outbound writes to PBM** (add/remove, condition comments) — v1 in-app by Tim via a seeded operator token; **per-user account linking follows soon (bead F)** so members act as themselves (Tim's account is never used for others).
7. **Admin integrations config** (generic Integrations page).
8. **Respect PBM's `llms.txt`** API-conduct policy, with drift detection.

Out of scope (v1): PBM high scores (`machine_score_xrefs`), mirroring the location's LMX/condition data (the hourly snapshot covers that — §4.3; note the machine **catalog** mirror for linking IS in scope, per PBM's "cache locally" guidance), auto-posting comments on issue close (manual only; revisit later).

---

## 2. Key external facts (verified)

- **Location:** APC = PBM location **26454** (~98 machines).
- **Three id types:** `machine_id` (PBM catalog id for a title; carries `opdb_id`/`ipdb_id`), `lmx_id` (location_machine_xref = "this machine at this location"; **ephemeral** — remove+re-add yields a new one), `location_id` (ours, 26454).
- **No status field on PBM.** A machine is _present_ (LMX exists) or _absent_. "Update availability" = add/remove machine, optionally with a free-text condition comment.
- **Removing a machine deletes its PBM-side comment history.** Conditions are children of the LMX; soft-deleting the LMX strands them. Re-adding mints a new LMX. → PinPoint becomes the durable home for imported comments.
- **One cheap call gets everything:** `GET /api/v1/locations/26454.json` returns every LMX with its full `machine_conditions` array (each has stable `id`, `comment`, `username`, `created_at`). Serves snapshot, desync detection, and comment ingestion in a single unauthenticated request.
- **Auth:** reads need none; writes append `user_email` + `user_token` query params. No OAuth/app registration — every credential is a **personal account**. Token obtained once via `auth_details` (login+password) and reused.
- **`llms.txt` exists** and is an agent-conduct doc: "<10 calls at startup", "hundreds of requests = designed incorrectly", use bulk endpoints + filters, tiered rate limits (IP + per-endpoint), `no_details=1` to trim payloads.
- **`robots.txt` blocks AI crawlers** (`ClaudeBot`, `anthropic-ai`, etc.), Crawl-delay 3. → The **API is the sanctioned channel; crawling the site is not.** Agents must use the documented API.
- **Confirm endpoint:** `PUT /api/v1/locations/:id/confirm.json` — "this lineup is accurate as of today," no mutation.
- **Token handling (their guidance):** _"Store it; do not re-fetch the token on every request… Fetch the token once, store it, reuse it."_ **No token expiry, rotation, or refresh mechanism is documented** — a token is stable until the account password changes.
- **Caching is encouraged:** _"Fetch once at startup and cache locally"_; anti-pattern: _"Do not poll the API repeatedly… build your own sync schedule."_ A bulk `GET /api/v1/machines.json` (filters: `no_details`, `manufacturer`, `region_id`) returns the canonical machine catalog — suitable for a local mirror behind the linking picker.
- **PBM is open source — its RSpec suite is the contract.** `pinballmap/pbm` (`spec/requests/api/v1/*_controller_spec.rb`, actively maintained) documents exact request params, success bodies, and **every error path** — a better source than live probing (no auth, deterministic, covers failures). Two facts it pins down that the docs don't: (1) **failures come back as HTTP 200 + `{"errors":"…"}`**, not a 4xx (disabled account is the lone 401 + `{"error":"…"}` exception); (2) **`ic_toggle` is a toggle, not a setter** — it ignores params and flips state. The client seam is built against this contract; re-read it before changing integration code. (See `docs/external/README.md`.)

---

## 3. Decisions (locked during brainstorm)

### Sync semantics

- **"Should be listed on PBM" = presence is `on_the_floor`.** All other presence states (`off_the_floor`, `on_loan`, `pending_arrival`, `removed`) → should not be listed.
- On transitions **away** from `on_the_floor` to any non-`removed` state, the CTA shows **soft guidance**: _"consider leaving on PinballMap if the game is expected to return within a week"_ (churn is noisy for map users; removal also deletes PBM comment history).

### Linking & metadata

- **Machine create _and edit_ require** a PBM catalog link **or** an explicit `pinballmapExcluded` flag (for the one non-pinball machine). DB columns are nullable; validation lives at the create/edit form/action layer, but **the hard requirement is flag-gated and only enabled at full rollout** (§6.1) — flipped on _after_ the backfill session, so no existing machine is ever caught frozen. During build-out, linking is available but optional.
  - _Why require it (incl. on edit):_ PBM is open-editing — any APC guest can see a game and add it to the map themselves — so there's no downside to always keeping our machines linked; the link is low-cost and keeps our data complete.
  - **Backfill is a prod Claude session:** at rollout, before flipping the requirement on, Tim runs a Claude session to walk every existing game and link it (or mark it excluded), using the status page "Unlinked" tab + catalog search. Not a UI-only bulk tool.
- On link, **pull and store** model metadata from the PBM catalog: `manufacturer`, `year`, `opdb_id`, `ipdb_id`, plus `pinballmapMachineId`.
- **Manufacturer/year render in general machine info** (not a PBM-branded panel). **OPDB/IPDB are stored but never shown** in the GUI.
- The **catalog picker searches a local mirror** (`pinballmap_catalog`, §4.2; refreshed weekly), not a live per-keystroke API call — faster, and PBM's recommended "cache locally" pattern.
- The linked title can be **changed/re-linked** to correct a wrong model pick (via the machine Info card's edit modal).

### Surfaces

- **Machine Info card is status-only:** a Listed/Not-listed pill + a small ⚠ shown _only when desynced_ + 2–3 action buttons (Post comment, View on PinballMap ↗, Edit…). No metadata table, no ids.
- **All PBM-mutating edits funnel through one confirm modal** ("Edit…"): change linked title, toggle Insider Connected, mark excluded.
- **Status page (tech/admin):** bidirectional desync table (we-changed vs map-changed), counters, tabs (Desynced / Unlinked / Import from map / All linked), snooze/acknowledge, "Sync now," and **"Confirm line-up"** — a button showing the **last-confirmed time** that, before pushing PBM's `confirm.json`, **requires the user to confirm each still-out-of-sync machine is actually correct** (no blind-confirming over open desyncs). Menu/nav home **TBD** (see Open Questions).
- **Import map-side additions:** the "Import from map" tab lists machines on PBM unknown to PinPoint → "Create PinPoint machine" prefilled from PBM metadata, or "Ignore."
- **Public "View on PinballMap" link:** anyone (including unauthenticated visitors) can find a machine on PBM from its PinPoint page. The deep link is public; only the _actions_ (post/edit) are permission-gated.

### Comments → timeline

- Inbound PBM conditions become timeline events (sourceType `pinballmap`), rendered with **attribution + link-back** (reuse the existing `MachineAttributionLine` component; PBM terms require attribution).
- **Deduped** on PBM condition id.
- A **new notification category** fires for machine watchers on imported PBM comments.
- Each PBM comment item carries a **one-shot "Convert to issue"** action: prefills a new issue (title from the comment snippet; severity left to the human), records the conversion in `eventData` so the button disappears.

### Auth (outbound writes)

- **PBM has no service account / app registration** — auth is per personal account. Reads are always anonymous; writes append `user_email` + `user_token`. **Storing + reusing the token is exactly PBM's recommendation** (_"Fetch the token once, store it, reuse it"_); there is **no token expiry or rotation** mechanism (a token lives until the account password changes).
- **Tim does not want others posting through his account.** So:
  - **v1 in-app outbound = admin (Tim) only**, using a single **manually-seeded operator token** (`pinballmap_state.outboundEmail` + `outboundTokenVaultId`). This defers credential UI without letting anyone else write as Tim.
  - **Permitted-but-unlinked users** (owner/tech+ — see Permissions) get the **deep-link fallback** ("Open on PinballMap ↗") to act manually on PBM, until they can link their own account.
- **Per-user account linking ships early (bead F), not last.** Once it lands, owner/tech+ perform in-app outbound with **their own** token — never the seeded one. Linking offers two paths in one task: log in (exchange password→token via `auth_details`, store the **token only**, discard the password) **or** paste an existing token.
- **Token handling — Supabase Vault** (same pattern as the Discord bot token): the row holds a `*_vault_id` uuid pointing at `vault.secrets`; the raw token never sits in a table column. Vault `create_secret`/`update_secret`/`delete_secret` RPCs run **outside** transactions (CORE-ARCH-011 — the tripwire enforces this). Since PBM has no rotation API, **unlink/re-link** (delete + recreate the Vault secret) is the manual rotation; a rejected token is surfaced distinctly ("PinballMap rejected your credentials"); tokens are never logged. The seeded operator secret is deleted (or kept as an admin fallback) once Tim links his own account.

### Outbound

- **Manual condition-comment composer** only (no auto-post on issue close in v1), reached from the Info card. Open to **owner + technician + admin** — gated by usable creds (v1 in-app = Tim only; broadens after bead F).
- **Stern Insider Connected** toggle is an action (in the edit modal); **no desync tracking** for it (no PinPoint source-of-truth to diff against).

### Sync mechanics

- **Cadence:** hourly. **Reads are anonymous.** A manual "Sync now" button exists for tech+.
- **Scheduler: Vercel Cron** (Pro plan — upgraded/confirmed). Fallback if ever needed: Supabase `pg_cron` + `pg_net`. The sync route is a `CRON_SECRET`-authenticated `GET` and **scheduler-agnostic** — it ships with the manual "Sync now" trigger; the hourly Vercel Cron schedule is wired at rollout.

### Permissions (matrix entries)

- `machines.pinballmap.link` (set/change the catalog link, mark excluded) — follows machine-edit rules: member = `owner`, admin = true; else false.
- `machines.pinballmap.push` (write to PBM: post comment, add/remove, IC toggle, confirm) — **owner + technician + admin**. _Permission_ says who's allowed; _execution_ additionally requires usable creds, so **v1 in-app = admin only** (seeded token); others use the deep-link fallback until they link an account (bead F).
- `pinballmap.status.view` (status page): technician = true, admin = true; else false.
- `pinballmap.admin` (integration config): admin only.
- Convert-to-issue uses the existing issue-create permission.

---

## 4. Architecture

### 4.1 Client boundary (the seam everything depends on)

A single typed `PinballMapClient` interface wraps **all** PBM HTTP. Nothing else in the app knows PBM's wire format.

```
interface PinballMapClient {
  fetchLocation(id): LocationSnapshot          // anonymous read, full payload
  addMachine(locationId, machineId)             // write → { lmxId } (find-or-create)
  removeMachine(lmxId)                           // write
  postCondition(lmxId, comment)                  // write
  toggleInsiderConnected(lmxId): { icEnabled }   // write — toggle, not a setter (see below)
  confirmLineup(locationId)                      // write
  fetchCatalog(): CatalogMachine[]               // anonymous bulk read → populates local mirror
  authDetails(login, password): { token, username } // token exchange (bead F)
}
```

- **Live implementation:** real `fetch`, descriptive `User-Agent` identifying PinPoint + a contact URL, token reuse, backoff on `429`, serialized writes.
- **Mock implementation:** in-memory fake seeded from a committed fixture; simulates state (add/remove/comment/drift) so the dev server exercises the full flow with no network and no creds.
- Selected by `PINBALLMAP_MODE` env (`mock` default in dev, `live` opt-in).

**Error model (verified against PBM's RSpec contract — see `docs/external/README.md`).** PBM signals logical failures with **HTTP 200 and an `errors` string in the body** (e.g. `{"errors":"Failed to find machine"}`), _not_ a 4xx. The lone status-based exception is a disabled account (`401` + `{"error":"account_disabled"}`). The live client therefore classifies success/failure from the **body**, never `res.ok` alone, and a read that returns an `errors` body throws so sync records it. Write results are a discriminated union with a reason (`rate_limited | unauthorized | not_found | rejected | transient`) plus PBM's verbatim `message` when present; `rejected` covers domain refusals (e.g. machine not Insider-Connected eligible, blank condition).

**`addMachine` is find-or-create:** re-adding a machine already at the location updates its condition and returns the existing lmx (HTTP 200); a brand-new lmx returns HTTP 201; the lmx id is read from `{location_machine:{id}}`.

**`toggleInsiderConnected` flips IC state — it is not a setter.** PBM's `ic_toggle` endpoint ignores any desired-state param and inverts the current value, returning the new state. Callers wanting a _specific_ state must read the snapshot's `icEnabled` and only toggle when it differs (the "Edit…" confirm modal does this). This is why the method takes no `enabled` argument.

### 4.2 Data model

**New columns on `machines`** (all nullable):

- `pinballmapMachineId` (integer) — PBM catalog link.
- `pinballmapExcluded` (boolean, default false) — explicit opt-out.
- `manufacturer` (text), `year` (integer), `opdbId` (text), `ipdbId` (integer) — pulled on link.
- CHECK: not (`pinballmapMachineId` set AND `pinballmapExcluded` true).

**New table `pinballmap_state`** (singleton; mirrors the Discord-config pattern):

- Config: `enabled`, `locationId`.
- Snapshot: `snapshotJson` (raw location response), `lastSyncedAt`, `lastSyncStatus` (ok/error), `lastSyncError`.
- **Outbound creds (v1):** `outboundEmail` + `outboundTokenVaultId` (uuid → `vault.secrets`) — the single manually-seeded operator token, stored in Supabase Vault (Discord-bot-token pattern). The raw token is never in a column.
- Config + snapshot + creds share one row (all singleton).

**New table `pinballmap_catalog`** (local mirror of PBM's machine catalog, for the linking picker):

- `pinballmapMachineId` (PK), `name`, `manufacturer`, `year`, `opdbId`, `ipdbId`, `refreshedAt`.
- Populated by a bulk `GET /api/v1/machines.json` (with `no_details`), refreshed weekly. The picker searches this locally — PBM's recommended "cache locally" pattern, not live per-keystroke calls.

**New table `pinballmap_user_credentials`** (bead F — ships early, not deferred): `userId`, `pbmUsername`, `pbmTokenVaultId` (uuid → `vault.secrets`), `linkedAt`, `lastAuthStatus`. Per-user tokens live in Supabase Vault; this table only holds the reference. Replaces the shared seeded token for everyone but Tim.

**Migrations are per-bead** — each feature bead carries its own migration (machine columns; then `pinballmap_state`; then the timeline extension), rather than one upfront schema PR. Regenerate against latest `main` at implementation time (see §7).

**Timeline extension** (the 2026-05-17 timeline spec reserved this):

- Add `'pinballmap'` to `sourceType` (single type; `eventData` discriminates).
- `eventData` variants: `pbm_comment { conditionId, comment, username, commentedAt, convertedToIssueId? }`, `pbm_machine_added`/`pbm_machine_removed` `{ byUsername, direction: 'inbound' | 'outbound' }`.
- Orphan events insert with `machineId = null`; **promoted** on link via `eventData->>'pbmMachineId'`.
- **GIN index on `eventData`** for condition-id dedupe and orphan lookup.

### 4.3 Sync flow (snapshot + timeline dedupe — "Approach A")

Hourly (or manual): the cron route fetches the one location JSON via the live client, stores it whole in `pinballmap_state.snapshotJson` with `lastSyncedAt`. Everything downstream reads the **snapshot**, never the live API:

- **Status display** (Info card) and **desync detection** (status page) diff snapshot vs. our presence rule and our machine roster.
- **Comment ingestion** walks the snapshot's `machine_conditions`, skipping any PBM condition id already turned into a timeline event (GIN-indexed lookup), inserting the rest as `pbm_comment` events and firing watcher notifications.
- **LMX ids are resolved from the snapshot at action time**, never cached (they're PBM-ephemeral).

Rationale: pages never block on or get rate-limited by an external API; the desync view works offline with an honest "last synced N min ago"; one fetch serves all features; dedupe derives from data we already store. Rejected for the _location's_ LMX/condition data: a normalized mirror (the snapshot already covers it; mirroring would duplicate the timeline — YAGNI) and live-fetch-on-render (fragile, leans on PBM uptime for the page you use when something's already wrong). **The machine _catalog_ mirror (§4.2) is the deliberate exception** — PBM explicitly recommends caching it locally, and it powers the linking picker.

### 4.4 API conduct & policy compliance

- **Vendored policy files** under `docs/external/`: `pinballmap-llms.txt`, `pinballmap-robots.txt`, PBM API terms. These are the source of truth agents read.
- **Runtime politeness** (in the live client): 1 call/hour snapshot (full payload — `no_details=1` strips the conditions we need), descriptive User-Agent + contact URL, token reuse, `429` backoff, serialized writes, attribution + link-back in the UI.
- **Drift detection (standalone scheduled GHA):** daily, fetch live `llms.txt`, normalize, hash-diff the vendored copy; on change **open a plain GitHub issue** (no labels) titled "PinballMap llms.txt changed — re-review policy," diff in the body. Repo hygiene only — touches nothing in production. (Beads are not reachable from a GHA runner; the issue is triaged into a bead by hand if action is warranted. `pinpoint-briefing` will surface open GitHub issues — bead PP-42ov.)
- **Agent rule (documentation-only enforcement):** a new `CORE-*` non-negotiable + AGENTS.md §2.1 line: _"Respect PinballMap's llms.txt; use the documented API, never crawl the site."_ No edit-triggered hook.

---

## 5. Testing & dev harness

- **CORE-TEST-006 compliance:** tests must **never** reach `pinballmap.com` (a production third-party hostname in an E2E run is a class-J violation). All tests mock at the `PinballMapClient` boundary.
- **Fixtures:** real captured JSON from location 26454, recorded once, trimmed/sanitized — realistic without network.
- **Dev mock mode:** `PINBALLMAP_MODE=mock` (default in dev) serves the in-memory fake seeded from the fixture; simulates state transitions so CTAs, desync page, and comment import are all exercisable locally.
- **Fixture refresh script:** read-only, manual, re-captures the snapshot occasionally so the mock stays representative; the committed fixture remains the test source of truth.
- **Test layers** (per CORE-TEST-005): integration (PGlite + direct action) for sync ingestion, dedupe, orphan promotion, permission gating, desync computation; RTL unit for the Info card / form-state / modal logic; smoke E2E for "renders without 500." No PBM hostname in any E2E.

---

## 6. Epic breakdown

One bead = one PR. Each is a **vertical, individually-shippable slice** that leaves the app usable and carries its own migration where it needs one. Order respects dependencies; work is **not** lockstep.

**Beads:** A = `PP-o355.1`, B = `.2`, C = `.3`, D = `.4`, E = `.5`, F = `.6`, G = `.7`, H = `.8`, I = `.9`; rollout checklist = `PP-o355.10`. Only A is unblocked initially.

| Bead                                              | Ships (usable outcome)                                                                                                                                                                                                                                                                                                                                        | Depends on |
| :------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------- |
| **A. Client seam + dev harness + policy**         | `PinballMapClient` interface, live + mock impls, `PINBALLMAP_MODE`, captured fixtures, refresh script, vendored `docs/external/*`, API-conduct non-negotiable + AGENTS.md rule. _Foundation: testable, unblocks everything._                                                                                                                                  | —          |
| **B. Machine ↔ PBM linking**                      | _migration:_ machine columns + CHECK, `pinballmap_catalog` mirror. Weekly catalog fetch; create/edit picker searching the **local mirror**; metadata autofill (mfg/year/opdb/ipdb); exclude flag; re-link. Create **and edit** requirement implemented **behind a flag, OFF until rollout**. _After: machines capture PBM identity; mfg/year visible._        | A          |
| **C. Snapshot sync + status card**                | _migration:_ `pinballmap_state`. Scheduler-agnostic sync route + snapshot fetch/store, manual "Sync now," status-only Info card (listed/not, last comment, desync ⚠) + **public View-on-PinballMap deep link**. _After: per-machine PBM status, refreshable._                                                                                                 | A, B       |
| **D. Comments → timeline**                        | _migration:_ timeline `sourceType`/`eventData` + GIN index. Ingestion, attribution render, dedupe, orphan promotion, watcher notification category, **convert-to-issue**. _After: PBM comments flow into timelines + become issues._                                                                                                                          | A, C       |
| **E. Outbound writes (seeded token, admin-only)** | Seed `pinballmap_state` creds (token in **Vault**); outbound client methods (add/remove/postCondition/confirm/IC); `machines.pinballmap.push` perm (owner+tech+admin); **v1 in-app execution admin-only** + deep-link fallback for others; wire Info-card composer + presence-change CTA (+ soft guidance) + edit modal. _After: Tim can push to PBM in-app._ | A, B, C    |
| **F. Per-user account linking** _(moved up)_      | _migration:_ `pinballmap_user_credentials`. Profile-settings linking (login + paste-token), **Vault-backed** token storage, unlink/re-link, auth-failure surfacing; opens in-app outbound to owner/tech+ via **their own** token. _After: members act as themselves on PBM._                                                                                  | A, E       |
| **G. Status page**                                | Desync control room: bidirectional table, counters, tabs (Desynced/Unlinked/Import-from-map/All-linked), snooze/ack, Sync now, import-as-new, **Confirm line-up** (last-confirmed time + per-desync confirmation before push). _After: full drift management._                                                                                                | C, D, E    |
| **H. Admin Integrations refactor**                | Discord page → generic Admin → Integrations page; add PBM section (enable, locationId, sync health, run/log, link to status page). _Independent slice._                                                                                                                                                                                                       | C          |
| **I. Drift GHA**                                  | Daily `llms.txt` diff → GitHub issue (no labels). _Independent slice._                                                                                                                                                                                                                                                                                        | A          |

### 6.1 Prod rollout (checklist, not a build bead)

Tracked as a checklist at epic close, not a code PR:

1. Wire the hourly **Vercel Cron** schedule onto the sync route (Pro confirmed).
2. Create a Vault secret for Tim's PBM token (`vault.create_secret`), point `pinballmap_state.outboundTokenVaultId` at it, and set `outboundEmail` — by hand.
3. **Claude linking session:** walk all ~98 existing games, linking each to its PBM catalog title or marking it excluded.
4. **Enable the linking requirement — create _and_ edit** (flag on).
5. Enable the integration; confirm first sync + a test outbound write.
6. Announce **per-user account linking** (bead F) so members can act as themselves instead of via the deep-link fallback.

---

## 7. Coordination risks (in-flight neighbors)

- **Machine Settings tab** (`feat/machine-settings-tab-scaffold-PP-43q3`, PR #1388, PP-5r0p/PP-8a5r): inserts a Settings tab → final order **Info → Settings → Service → Timeline** (Service URL slug stays `maintenance`); adds **migration 0045**; touches `MachineTabStrip.tsx`. Our PBM card lives in Info-tab _content_ (no tab-strip change), but **our per-bead migrations must number after whatever has merged** (main is at 0043; their 0045 is unmerged). Regenerate each migration against latest `main` at implementation time.
- **Machine Info/Service redesign** (`worktree-machine-home-redo`, Claude-MachineTabsRedesign): redesigning the Info layout and leaving a slot for the compact PBM status card + general mfg/year fields. Our card must stay small and self-contained.

---

## 8. Open questions (non-blocking; resolve during implementation)

1. **Status-page nav home** — tech needs it, so a `/admin` route (admin-only) is wrong. Proposal: dedicated `/pinballmap` (tech+); the admin Integrations section links to it. Final menu entry TBD.
2. **Convert-to-issue prefill** — title from comment snippet; severity blank. Confirm in-app.
3. **Outbound on issue close** — kept manual-only for v1; revisit whether closing a notable issue should offer a prefilled composer.
4. **Desync table density** — one bidirectional table vs. split "we changed" / "map changed." Decide once seen in-app.
5. **Catalog refresh cadence** — weekly assumed; confirm in-app (new titles appear within a week).

---

## 9. References

- Wireframes: `docs/superpowers/specs/2026-06-07-pinballmap-wireframes.html`
- Timeline groundwork: `docs/superpowers/specs/2026-05-17-machine-timeline-design.md`
- Discord integration (pattern to follow + refactor): `src/app/(app)/admin/integrations/discord/`
- Existing cron pattern: `src/app/api/cron/cleanup-blobs/route.ts`
- Permissions matrix: `src/lib/permissions/matrix.ts`
- Attribution component: `src/components/machines/timeline/MachineAttributionLine.tsx`
