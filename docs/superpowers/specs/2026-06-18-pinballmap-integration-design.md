# PinballMap Integration — Design

**Date:** 2026-06-18
**Status:** Design (brainstorm complete, pending review)
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
6. **Per-user PBM auth** so outbound writes are attributed to the real person.
7. **Admin integrations config** (generic Integrations page).
8. **Respect PBM's `llms.txt`** API-conduct policy, with drift detection.

Out of scope (v1): PBM high scores (`machine_score_xrefs`), normalized mirror tables, auto-posting comments on issue close (manual only; revisit later).

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

---

## 3. Decisions (locked during brainstorm)

### Sync semantics

- **"Should be listed on PBM" = presence is `on_the_floor`.** All other presence states (`off_the_floor`, `on_loan`, `pending_arrival`, `removed`) → should not be listed.
- On transitions **away** from `on_the_floor` to any non-`removed` state, the CTA shows **soft guidance**: _"consider leaving on PinballMap if the game is expected to return within a week"_ (churn is noisy for map users; removal also deletes PBM comment history).

### Linking & metadata

- **Machine create/edit requires** a PBM catalog link **or** an explicit `pinballmapExcluded` flag (for the one non-pinball machine). DB columns are nullable; enforcement is at the form/action validation layer.
  - **Rollout sequencing:** create-time enforcement ships immediately; **edit-time enforcement is enabled only after the bulk linking session** clears the existing ~98 machines (via the status page "Unlinked" tab), so existing machines aren't frozen.
- On link, **pull and store** model metadata from the PBM catalog: `manufacturer`, `year`, `opdb_id`, `ipdb_id`, plus `pinballmapMachineId`.
- **Manufacturer/year render in general machine info** (not a PBM-branded panel). **OPDB/IPDB are stored but never shown** in the GUI.
- The linked title can be **changed/re-linked** to correct a wrong model pick (via the machine Info card's edit modal).

### Surfaces

- **Machine Info card is status-only:** a Listed/Not-listed pill + a small ⚠ shown _only when desynced_ + 2–3 action buttons (Post comment, View on PinballMap ↗, Edit…). No metadata table, no ids.
- **All PBM-mutating edits funnel through one confirm modal** ("Edit…"): change linked title, toggle Insider Connected, mark excluded.
- **Status page (tech/admin):** bidirectional desync table (we-changed vs map-changed), counters, tabs (Desynced / Unlinked / Import from map / All linked), snooze/acknowledge, "Sync now," and **"Confirm line-up"** (PBM `confirm.json`). Menu/nav home **TBD** (see Open Questions).
- **Import map-side additions:** the "Import from map" tab lists machines on PBM unknown to PinPoint → "Create PinPoint machine" prefilled from PBM metadata, or "Ignore."

### Comments → timeline

- Inbound PBM conditions become timeline events (sourceType `pinballmap`), rendered with **attribution + link-back** (reuse the existing `MachineAttributionLine` component; PBM terms require attribution).
- **Deduped** on PBM condition id.
- A **new notification category** fires for machine watchers on imported PBM comments.
- Each PBM comment item carries a **one-shot "Convert to issue"** action: prefills a new issue (title from the comment snippet; severity left to the human), records the conversion in `eventData` so the button disappears.

### Auth (per-user)

- **No service account.** Each user links **their own** PBM account in profile settings. Two paths in **one task**: (a) log in — we exchange password→token via `auth_details`, store the **token only**, discard the password; (b) paste an existing token.
- Tokens stored **server-side only, encrypted at rest**. Outbound CTAs require a linked account.
- **Unlinked users** get a deep-link fallback ("Open on PinballMap ↗" + "Link your account for one-click"). Nothing is blocked.
- **Stale/rejected tokens** are surfaced distinctly ("PinballMap rejected your credentials"), not as generic sync errors.

### Outbound

- **Manual condition-comment composer** only (tech+), reached from the Info card. No auto-post on issue close in v1.
- **Stern Insider Connected** toggle is an action (in the edit modal); **no desync tracking** for it (no PinPoint source-of-truth to diff against).

### Sync mechanics

- **Cadence:** hourly. **Reads are anonymous.** A manual "Sync now" button exists for tech+.
- **Scheduler:** Vercel Cron (requires Vercel Pro). Documented fallback: Supabase `pg_cron` + `pg_net` (the sync route is identical either way — a `CRON_SECRET`-authenticated `GET`).

### Permissions (matrix entries)

- `machines.pinballmap.push` (post comment, add/remove, edit link, IC toggle): member = `owner` (owns the machine), technician = true, admin = true; else false. → "owners and tech+."
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
  addMachine(locationId, machineId, opts)       // write
  removeMachine(lmxId)                           // write
  postCondition(lmxId, comment)                  // write
  confirmLineup(locationId)                      // write
  searchCatalog(query): CatalogMachine[]         // anonymous read
  authDetails(login, password): { token, username } // one-time token exchange
}
```

- **Live implementation:** real `fetch`, descriptive `User-Agent` identifying PinPoint + a contact URL, token reuse, backoff on `429`, serialized writes.
- **Mock implementation:** in-memory fake seeded from a committed fixture; simulates state (add/remove/comment/drift) so the dev server exercises the full flow with no network and no creds.
- Selected by `PINBALLMAP_MODE` env (`mock` default in dev, `live` opt-in).

### 4.2 Data model

**New columns on `machines`** (all nullable):

- `pinballmapMachineId` (integer) — PBM catalog link.
- `pinballmapExcluded` (boolean, default false) — explicit opt-out.
- `manufacturer` (text), `year` (integer), `opdbId` (text), `ipdbId` (integer) — pulled on link.
- CHECK: not (`pinballmapMachineId` set AND `pinballmapExcluded` true).

**New table `pinballmap_state`** (singleton; mirrors the Discord-config pattern):

- Config: `enabled`, `locationId`.
- Snapshot: `snapshotJson` (raw location response), `lastSyncedAt`, `lastSyncStatus` (ok/error), `lastSyncError`.
- Config + snapshot share one row (1:1, both singleton). **No service credentials** (per-user auth lives elsewhere).

**New table `pinballmap_user_credentials`** (per-user):

- `userId` (FK), `pbmUsername`, `pbmTokenEncrypted`, `linkedAt`, `lastAuthStatus`.

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

Rationale: pages never block on or get rate-limited by an external API; the desync view works offline with an honest "last synced N min ago"; one fetch serves all features; dedupe derives from data we already store. Rejected alternatives: normalized mirror tables (duplicates the timeline; YAGNI), live-fetch-on-render (fragile, leans on PBM uptime for the page you use when something's already wrong).

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

One bead = one PR; each ships complete. Suggested order respects dependencies; work is **not** lockstep.

| Bead                                          | Scope                                                                                                                                                                                                               | Depends on |
| :-------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------- |
| **A. Client boundary + dev harness + policy** | `PinballMapClient` interface, live+mock impls, `PINBALLMAP_MODE`, captured fixtures, refresh script, vendored `docs/external/*`, the API-conduct non-negotiable + AGENTS.md rule                                    | —          |
| **B. Schema & migration**                     | machine columns (+ CHECK), `pinballmap_state`, `pinballmap_user_credentials`, timeline `sourceType`/`eventData` extension, GIN index                                                                                | —          |
| **C. Sync engine**                            | cron route (`/api/cron/pinballmap-sync`, `CRON_SECRET`), snapshot fetch, comment→timeline ingestion (attribution render + **convert-to-issue**), orphan promotion, watcher notification category, manual "Sync now" | A, B       |
| **D. Machine linking**                        | create/edit PBM catalog picker (search), block validation (create now / edit post-rollout), metadata autofill, exclude flag, re-link                                                                                | A, B       |
| **E. Machine Info PBM card + edit modal**     | status-only card, desync ⚠, edit modal (change title, IC toggle, exclude), View on PinballMap                                                                                                                       | B, C, D    |
| **F. Status page**                            | bidirectional desync, counters, tabs (Desynced/Unlinked/Import-from-map/All-linked), snooze/ack, Sync now, Confirm line-up, import-as-new, unlinked-linking surface                                                 | B, C, D    |
| **G. Per-user account linking**               | profile settings: login (`auth_details`) + paste-token, encrypted token storage, auth-failure surfacing                                                                                                             | A          |
| **H. Outbound actions**                       | presence-change CTA (+ soft guidance), manual comment composer, deep-link fallback, permission entries, timeline mirroring of outbound writes                                                                       | D, E, G    |
| **I. Admin Integrations refactor**            | Discord page → generic Admin → Integrations page; add PBM section (enable, locationId, sync health, run/log, link to status page)                                                                                   | B          |
| **J. Drift GHA**                              | daily `llms.txt` diff → GitHub issue (no labels)                                                                                                                                                                    | A          |
| **K. Prod rollout**                           | Vercel Pro/cron decision, bulk linking session (clear the ~98), enable edit-time enforcement, per-user account setup guidance                                                                                       | all        |

---

## 7. Coordination risks (in-flight neighbors)

- **Machine Settings tab** (`feat/machine-settings-tab-scaffold-PP-43q3`, PR #1388, PP-5r0p/PP-8a5r): inserts a Settings tab → final order **Info → Settings → Service → Timeline** (Service URL slug stays `maintenance`); adds **migration 0045**; touches `MachineTabStrip.tsx`. Our PBM card lives in Info-tab _content_ (no tab-strip change), but **our migration must number after theirs** (main is at 0043; their 0045 is unmerged). Regenerate against latest main at implementation time.
- **Machine Info/Service redesign** (`worktree-machine-home-redo`, Claude-MachineTabsRedesign): redesigning the Info layout and leaving a slot for the compact PBM status card + general mfg/year fields. Our card must stay small and self-contained.

---

## 8. Open questions (non-blocking; resolve during implementation)

1. **Status-page nav home** — tech needs it, so a `/admin` route (admin-only) is wrong. Proposal: dedicated `/pinballmap` (tech+); the admin Integrations section links to it. Final menu entry TBD.
2. **Convert-to-issue prefill** — title from comment snippet; severity blank. Confirm in-app.
3. **Outbound on issue close** — kept manual-only for v1; revisit whether closing a notable issue should offer a prefilled composer.
4. **Desync table density** — one bidirectional table vs. split "we changed" / "map changed." Decide once seen in-app.
5. **Confirm-line-up auto-prompt** — offer after all desyncs cleared?

---

## 9. References

- Wireframes: `docs/superpowers/specs/2026-06-07-pinballmap-wireframes.html`
- Timeline groundwork: `docs/superpowers/specs/2026-05-17-machine-timeline-design.md`
- Discord integration (pattern to follow + refactor): `src/app/(app)/admin/integrations/discord/`
- Existing cron pattern: `src/app/api/cron/cleanup-blobs/route.ts`
- Permissions matrix: `src/lib/permissions/matrix.ts`
- Attribution component: `src/components/machines/timeline/MachineAttributionLine.tsx`
