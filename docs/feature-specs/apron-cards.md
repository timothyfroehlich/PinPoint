# Apron Cards — Feature Spec

**Status: draft.**

**What this document is.** The requirements for PinPoint's printed apron cards: what the card shows, what data it draws on, and how that data is authored. No implementation detail — design records and code carry that. It describes the intended final state only; what the code does or used to do lives solely in the Known divergences table. Each requirement is numbered for citation. When code and spec disagree, either the code is wrong or this document gets amended — never silently neither.

**Related records.** [apron-cards-mockup.html](apron-cards-mockup.html) (card face, both size variants). [apron-cards-editor-mockup.html](apron-cards-editor-mockup.html) (authoring surface — Service/Manage entry points, overflow handling, Export menu, mobile). Bead PP-esta (build tracking); PP-esta.1 (edition-name parsing survey, informs §7).

---

## 1. Concepts

- **Card** — the printed artifact mounted in a machine's apron card holder. One card renders one machine. Once printed, it is the machine's sole on-cabinet entry point for reporting an issue or posting a score, replacing the existing iScored QR sticker.
- **Apron size** — which physical dimensions a card renders at. Stern/SPIKE (140×75mm) and WPC (6×3.25in) are the two sizes supported at launch; more may be added later as new cabinet families need them. Stored per machine, independent of card content — the same title, edition, description, and tip render at any size a machine supports.
- **Card description** — an optional override of the card's description text, distinct from the machine's main description. A machine keeps at most one.
- **Tip** — an optional second block of card text, shown under Description. Carries its own enabled/disabled toggle, independent of whether it has content.
- **Edition** — the "<X> Edition" line shown under the title. Sourced only from Pinball Map's grouped-family data (PP-esta.1); PinPoint never derives an edition by parsing an ungrouped Pinball Map name.
- **Scan target** — the URL the card's QR code encodes: the machine's PinPoint page, tagged with an `apron` source so that traffic is distinguishable from other QR sources.
- **Title fit** — the rule that sizes and wraps a machine's name to the card's identity panel: shrink from a maximum size until the single longest word fits the panel on one line, keep shrinking until the full title wraps to three lines or fewer, down to a floor size below which the title may still exceed three lines rather than shrink further. Never breaks a word mid-word.

## 2. Data inputs

- **2.1** A card face renders one machine, drawing on: name, manufacturer, year, owner display name, apron size, an edition line when one applies (§7), a description, and a tip when enabled.
- **2.2** A card uses the card description when one is set, and falls back to the machine's main description when it is not.
- **2.3** Apron size affects only which physical layout a card renders at — content (title, edition, owner, description, tip) is identical across a machine's size variants.

## 3. Authoring card content

- **3.1** Card description and tip are authored in one editing surface reached two ways: an "Apron card" entry point on the Service tab (the primary path — where the machine's on-cabinet QR workflow lives today) and a matching row on the Manage tab. Both open the same surface; there are not two independent editors.
- **3.2** The editor offers an explicit choice for description: use the machine's main description (read-only there — edited on the Info tab), or write a custom one just for the card. Switching back to the main description discards nothing — the custom text is kept, only unused.
- **3.3** Tip has an enabled/disabled toggle, independent of its saved text. When disabled, the card shows a single Description block and no Tip heading, regardless of saved tip content.
- **3.4** The editor renders a live preview of the card face as description and tip are typed. Description and tip share one flowing region on the card rather than two independently sized boxes: growing one narrows the room available to the other in the preview, matching what the printed card will do.
- **3.5** Description and tip are checked as one combined region, not measured line by line: PinPoint knows only whether the combined content still fits the card, not how many lines over it runs. While it does not fit, the card can be neither saved nor exported (§9), and the state renders as one card-level notice rather than a per-field message.

## 4. Apron size

- **4.1** Apron size is a field stored per machine, drawn from the supported set (§1) — Stern/SPIKE and WPC at launch.
- **4.2** When a machine's Pinball Map match implies a size, PinPoint fills the field automatically; a person can always override it.
- **4.3** An unmatched machine's apron size is set directly, with no default. A machine with no apron size set cannot generate a card; its card entry point says why.

## 5. Layout

- **5.1** A card face is two regions side by side: a dark identity panel (title, edition, manufacturer · year, owner, APC logo) and a light action-and-description column.
- **5.2** The action column's top portion holds a "Scan this machine" header and two action rows (report a problem, post a score) on the left, with the QR code to their right. A divider separates this from the description (and tip, when enabled) below.
- **5.3** Card copy names both destinations reachable through the QR: reporting an issue, and posting a score via iScored — in that order.

## 6. Title fit

- **6.1** The title uses the fit rule (§1) to size and wrap the machine's name within the identity panel.
- **6.2** The edition line, when present, renders under the title at a fixed size — it does not participate in the title's shrink rule.

## 7. Edition

- **7.1** The edition line renders only when Pinball Map's grouped-family data supplies one for the machine's match. PinPoint never invents an edition by parsing an ungrouped Pinball Map name (PP-esta.1).

## 8. Scan target

- **8.1** The QR code encodes the machine's PinPoint page, tagged with an `apron` source.
- **8.2** The card is the machine's sole on-cabinet entry point once printed; it replaces the existing iScored sticker. The landing experience the QR opens is separate scope, tracked elsewhere.

## 9. Export

- **9.1** A card can be exported once it is saved and has an apron size; export is unavailable while either is missing, rather than offered against unsaved or unsized content.
- **9.2** At least one export format renders the card at its exact physical dimensions (§1's apron size), suitable for printing at 100% with no fit-to-page scaling. Export may offer more than one format; adding a format does not change the authoring flow in §3.

## Known divergences

_None — nothing has been built against this spec yet._

## Changelog

| Date | Change |
| :-- | :-- |
| 2026-09-15 | Initial draft: card content, apron size, description/tip authoring, title fit, edition sourcing, scan target. |
| 2026-09-18 | Authoring surface is reached from Service and Manage (was Manage-only); description/tip overflow is a combined-region check that blocks save and export (§3.5, new); added §9 Export — exact-size format required, extensible. |
