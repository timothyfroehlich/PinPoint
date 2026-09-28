# Machine Editing — Feature Spec

**Status: draft.**

**What this document is.** The requirements for how a person enters and edits a machine's own data: the New Machine page and the machine's Manage tab. No implementation detail — design records and code carry that. It describes the intended final state only; what the code does or used to do lives solely in the Known divergences table. Each requirement is numbered for citation. When code and spec disagree, either the code is wrong or this document gets amended — never silently neither.

**Related records.** [Design canvas](https://claude.ai/artifact/LNqgevh2dRh7UXup3eLXJ3) (Manage tab and New Machine, desktop and phone). [pinballmap.md](pinballmap.md) (matching, the manual model, the listing control). [apron-cards.md](apron-cards.md) (card content). [iscored.md](iscored.md) (iScored link). [collections-and-tags.md](collections-and-tags.md) (tags fed by the model fields). Bead PP-wqit.14.

---

## 1. Concepts

- **Machine form** — the one set of fields for a machine's editable data. The New Machine page shows it to create a machine; the machine's Manage tab shows it to edit one.
- **Section** — a titled group of fields within the machine form: Model Details, Integrations, and Apron card.
- **Source** — where a machine's model identity comes from: a Pinball Map catalog title, or Manual Entry for an uncataloged machine (pinballmap §1, §2.4).

## 2. One form, two pages

- **2.1** The New Machine page and the Manage tab show the same fields, in the same order and the same sections, except as 2.2 and 2.3 state.
- **2.2** Only the New Machine page asks for Initials, which cannot change after creation, and Owner.
- **2.3** Only the Manage tab carries the actions that need a machine to exist: Pinball Map pushes and Refresh (pinballmap §4), apron card export (apron-cards §9), and owner transfer, in a Danger zone after the form.
- **2.4** Every field of a machine's own data that a person can edit is editable on the Manage tab, except the machine's game settings, which stay on the Settings tab.
- **2.5** The form's order is: machine name and availability; Model Details; Description; Owner's Requirements; Integrations; Apron card.
- **2.6** Owner's Requirements shows only to people permitted to view it, and stays editable on the Service tab as well.

## 3. Sections

- **3.1** Model Details, Integrations, and Apron card each render as a bordered box, with the section title above the box.
- **3.2** Model Details starts with the Source choice, followed by that source's fields: Model and Edition for a catalog title; model name, manufacturer, year, type, display, player count, designers, and artists for Manual Entry.
- **3.3** Manual Entry fields sit on a shared column grid so their edges line up from row to row. On a phone the grid has half as many columns.
- **3.4** Type and Display are chosen from their tag vocabularies (collections-and-tags §9.3–9.4), each with a not-set choice. Player count accepts only a positive whole number.
- **3.5** Designers and artists are each entered as an ordered list of names, added one name at a time and removable one at a time. PinPoint never splits an entered name on punctuation.
- **3.6** Integrations holds the iScored game (iscored §2) and the machine's Pinball Map controls (pinballmap §4, §4.11). For an uncataloged machine, the Pinball Map entry reads as unavailable and says why.
- **3.7** Apron card holds apron size, the Design and Art credit display settings, the card-text choice with the card description, the tip toggle with the tip (apron-cards §3), and Preview. On the Manage tab it also holds Export.

## 4. Saving

- **4.1** On the Manage tab, one Save action saves every field in the form. Cancel discards unsaved changes after confirming.
- **4.2** Pinball Map intent, Insider Connected, pushes, Refresh, and owner transfer act immediately, as their own requirements state, and are unavailable while the form has unsaved changes, with a note saying why.
- **4.3** The New Machine page creates the machine with every value entered, in one action.
- **4.4** On a phone, Cancel and Save (or Create) stay pinned to the bottom of the screen, above the app's tab bar.

## 5. Finding a section

- **5.1** On desktop, the Manage tab lists its sections beside the form. The list stays in view while scrolling, marks the section in view, and jumps to a section when chosen.
- **5.2** On a phone, one pinned control under the app header names the section in view and opens the list of sections.

## 6. Permissions

- **6.1** Editing the machine form requires the machine-management capability: machine owner, technician, or administrator. The Pinball Map controls follow pinballmap §8, and card export follows apron-cards §9.3.

---

## Known divergences

| Requirement | Divergence | Resolution |
| :-- | :-- | :-- |
| §2–§5 | The New Machine page and the Manage tab use separate forms with different fields; no sections, section list, or pinned phone buttons exist; apron card settings are edited in a separate dialog. | PP-wqit.14 |

---

## Changelog

| Date | Change |
| :-- | :-- |
| 2026-09-27 | Created: one machine form shared by the New Machine page and the Manage tab, with Model Details, Integrations, and Apron card sections, one Save on the Manage tab, pinned phone buttons, and a section list. |
