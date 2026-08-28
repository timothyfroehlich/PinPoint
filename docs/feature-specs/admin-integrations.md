# Admin Integrations — Feature Spec

**Status: approved.**

**What this document is.** The requirements for PinPoint's Admin Integrations
page — the one admin surface that configures PinPoint's connections to
third-party services. This spec covers the **page**: its structure and the
rules shared across every section. Each integration's own behavior lives in that
integration's spec, not here. It describes the intended final state only; what
the code does or used to do lives solely in the Known divergences table. Each
requirement is numbered for citation. When code and spec disagree, either the
code is wrong or this document gets amended — never silently neither.

**Related records.** `docs/feature-specs/discord.md` (the Discord section),
`docs/feature-specs/pinballmap.md` §10 (the Pinball Map section — location
tracking, sync health, location change) and
`docs/feature-specs/pinballmap-region-alerts.md` (the region-alert channel,
configured in the same section).

---

## 1. Concepts

- **Integration** — a third-party service PinPoint connects to. Two exist:
  **Discord** (bot notifications) and **Pinball Map** (public-lineup sync and
  region alerts). Each integration owns exactly one section on the page.
- **Section** — one integration's configuration surface on the page. A section
  is self-contained: it reads and writes only its own integration's settings,
  and it saves independently of every other section (§2).

## 2. The page

- **2.1** A single admin page lists every integration as a section, one section
  per integration, on one route. There is no per-integration page.
- **2.2** The page is admin-only: it requires the manage-integrations capability
  (§4), an admin-tier grant. A member, technician, or guest never reaches it.
- **2.3** Each section saves and resets on its own. Editing and saving one
  section never touches another's fields, dirty state, or stored settings. A
  section with unsaved edits warns before the page is abandoned.
- **2.4** Sections render in a fixed order with the same visual frame, so a new
  integration is added as another section without restructuring the page.

## 3. The sections

- **3.1** The **Discord** section implements the credential-entry card defined
  by the Discord spec (`docs/feature-specs/discord.md` §2–§3): fields,
  validation, connection status, and sending. It has no enable toggle — the
  required configuration's presence and validation determine its state — and it
  links to the Discord help page.
- **3.2** The **Pinball Map** section configures the Pinball Map integration:
  the tracked location, its sync health, and an on-demand refresh
  (`docs/feature-specs/pinballmap.md` §10), and the region-alert channel
  (`docs/feature-specs/pinballmap-region-alerts.md`). Its behavior — the
  configuration-presence state model, validate-then-commit location changes, and
  the location-change safety rules — lives in those specs, not here.
- **3.3** Per-user credentials are not configured here: per-operator Pinball Map
  write credentials belong to a person's own settings (PP-o355.5 / PP-o355.6),
  and Discord login is a separate system from Discord notifications
  (`discord.md`).

## 4. Permissions

- **4.1** Configuring any integration on this page requires the
  manage-integrations capability — an admin-tier grant. The same capability
  gates the whole page (§2.2) and every section's save.
- **4.2** This is deliberately a single admin capability, not a per-integration
  one: the page is admin-only, and Pinball Map's finer-grained per-machine
  grants (linking, pushing, refreshing — pinballmap spec §8) gate the machine
  surfaces, not this configuration surface.

---

## Known divergences (code vs spec)

| Spec                               | Code today                                                               | Resolution                    |
| :--------------------------------- | :----------------------------------------------------------------------- | :---------------------------- |
| §2 one combined page               | One Discord-only page at `/admin/integrations/discord`; no combined page | PP-o355.51.5 and PP-o355.51.6 |
| §2.3 per-section save              | Only the Discord form exists, with its own save                          | PP-o355.51.5 and PP-o355.51.6 |
| §3.1 Discord credential-entry card | The standalone card has per-field validation                             | PP-o355.51.5                  |
| §3.2 Pinball Map section           | No Pinball Map section anywhere in admin                                 | PP-o355.51.6                  |

---

## Changelog

Changes to this document. Divergence-table rows are working state and are not
logged here.

| Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| :--------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-27 | Slimmed to a page-level spec. The Pinball Map section's behavior — the sync-health readout and Sync now (was §4), the configuration-presence state model (was §5), and the location-change rules (was §6) — moved to `pinballmap.md` §10. The page spec now states only the page structure (§2), the sections and where each one's behavior lives (§3), and the shared admin capability (§4). No behavior changed; this is a relocation (PP-o355.51.3).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-08-23 | Replaced the distinct Pinball Map enable flag with configuration presence: a stored location means configured and clearing it means Not configured. Defined reversible dormant-state retention, shared throttling for location validation, and validate-then-commit behavior for initial configuration, resumption, and location replacement. Clarified that this state governs location tracking, not the separately configured region-alert feature. Updated the Discord section to follow its approved credential-entry spec.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-08-17 | Created. Combined Admin Integrations page (§2), Discord section preserved (§3), Pinball Map section with enable toggle / editable location / sync health / sync now / link-out (§4–§5), location-change behavior keeping matches and intents (§6), single admin capability (§7). Then, after a §6 review: §2.2 stated admin-only explicitly; §5.1 clarified seeds still set the initial enabled value; §6 rewritten to validate-before-wipe, forbid wrapping the fetch in a transaction (CORE-ARCH-011), keep the abandoned-listing rows (6.4), leave the refresh allowance untouched (6.5), guard against a concurrent sync (6.6), defer the refresh when disabled (6.7), and name both Missing and Lingering in the confirmation (6.8). Then closed a destructive bug the review surfaced: keeping the old rows exposed the entry-removal re-mint recovery, which re-resolves a title against the _current_ lineup and would delete a live entry at the new location — so abandoned records are now location-stamped, reconciled only same-location (6.4), and removed by stored lmx with re-mint recovery suppressed cross-location (6.9). |
