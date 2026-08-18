# Brainstorm mockups — PBM details pane + manual model (2026-08-11/14)

Static HTML mockups from the brainstorm session behind the machine edit page's
Pinball Map area. Records, not live components — open them in a browser.

They cover two threads:

- **Details pane / listing status** (`details-pane-v2`, `details-pane-v3`,
  `chip-copy`, `chip-copy-v2`, `abandoned-placement`) — the listing control and
  status copy that shipped in **PP-o355.21** (PR #1875).
- **Manual model** (`manual-model`, `manual-model-v2`) — hand-entered
  manufacturer/year/title for games not on Pinball Map, tracked separately as
  **PP-3bbr**. `manual-model-v2.html` is the decision screen: it lays out
  layouts A/B/C and the two questions (is Title a field; catalog-match
  precedence).

## Decisions settled 2026-08-14 (recorded on PP-3bbr)

- Title is a real field, defaulting to the machine's Name and overridable.
- The "Not on Pinball Map" select option becomes a toggle
  (roughly "add game that's not listed").
- Precedence, field validation, the `use catalog` column question, and which
  layout (A/B/C) are still open. See PP-3bbr.
