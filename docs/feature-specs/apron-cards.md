# Apron Cards — Feature Spec

**Status: draft.**

**What this document is.** The requirements for PinPoint's printed apron cards: what the card shows, what data it draws on, and how that data is authored. No implementation detail — design records and code carry that. It describes the intended final state only; what the code does or used to do lives solely in the Known divergences table. Each requirement is numbered for citation. When code and spec disagree, either the code is wrong or this document gets amended — never silently neither.

**Related records.** [apron-cards-mockup.html](apron-cards-mockup.html) (card face, both size variants). [apron-cards-editor-mockup.html](apron-cards-editor-mockup.html) (authoring surface — Service/Manage entry points, overflow handling, Export menu, mobile). Bead PP-esta (build tracking); PP-esta.1 (edition-name parsing survey, informs §7). [Credits placement canvas](https://claude.ai/artifact/XJMscXb6HAoHvpMTiKpbCy) (option A, both sizes); bead PP-tv2u (credits). [Card templates canvas](https://claude.ai/artifact/NLAnYXFFC4j3748otKxoPq) (Side rail is option A, Header band option B); bead PP-s3fa (templates).

---

## 1. Concepts

- **Card** — the printed artifact mounted in a machine's apron card holder. One card renders one machine. Once printed, it is the machine's sole on-cabinet entry point for reporting an issue or posting a score, replacing the existing iScored QR sticker.
- **Saved card** — one complete, named set of card settings: apron size, template, card text choice, card description, tip, and credit display settings. A machine keeps zero or more saved cards, listed in the order they were created.
- **Apron size** — which physical dimensions a card renders at. The supported sizes are Stern / Data East / Sega (140×75mm), Williams / WPC (6×3.25in), Bally solid state (5.5×3.25in), Bally EM (5.5×3.75in), Gottlieb EM (6×3in), and Williams EM (6×3.5in); more may be added as new cabinet families need them. Stored per saved card, independent of card content — the same title, edition, description, and tip render at any size a machine supports.
- **Template** — which layout a card face uses: Standard, Side rail, or Header band. Stored per saved card, independent of apron size and content; every template renders at every supported apron size. Side rail and Header band give the description and tip more room than Standard.
- **Card description** — an optional override of the card's description text, distinct from the machine's main description. A saved card keeps at most one. It is rich text limited to bold, italic, and lists.
- **Tip** — an optional second block of card text, shown under Description. Carries its own enabled/disabled toggle, independent of whether it has content. It is rich text limited to bold, italic, and lists.
- **Credits** — the people credited for a machine's game, in two roles: design and art. They come from the Open Pinball Database (OPDB), or are entered by hand for an uncataloged machine. Each role has its own per-card display setting.
- **Edition** — the "<X> Edition" line shown under the title. Sourced only from Pinball Map's grouped-family data (PP-esta.1); PinPoint never derives an edition by parsing an ungrouped Pinball Map name.
- **Scan target** — the URL the card's QR code encodes: the machine's scan hub, tagged with an `apron` source so that traffic is distinguishable from other QR sources.
- **Title fit** — the rule that sizes and wraps a machine's name to the card's identity panel: shrink from a maximum size until the single longest word fits the panel on one line, keep shrinking until the full title wraps to three lines or fewer, then keep shrinking until everything in the identity panel fits above the APC logo, down to a floor size below which the title may still exceed three lines rather than shrink further. A line may break at a space, after a hyphen, or after an ellipsis, and nowhere else; a word is the text between those break points, so Lights...Camera...Action! is three words and Harley-Davidson two. Never breaks a word mid-word.

## 2. Data inputs

- **2.1** A card face renders one machine, drawing on: name, manufacturer, year, owner display name, apron size, an edition line when one applies (§7), design and art credits (§10), a description, and a tip when enabled.
- **2.2** A card uses the card description when one is set, and falls back to the machine's main description when it is not.
- **2.3** Apron size and template affect only how a card is laid out — content (title, edition, owner, description, tip) is identical across them. Only the Standard template shows credits (§10.2).

## 3. Authoring card content

- **3.1** Saved cards and their settings (apron size, template, credit display settings, card description, tip) are edited on the machine's Apron card tab, which has its own Save. There is no other card editor, and the New Machine page has none: cards are added once the machine exists.
- **3.2** The Apron card tab offers an explicit choice for the card text: the machine's main description (edited on the Manage tab; the card uses its saved value), or a card description just for the card. Switching back to the main description discards nothing — the card description is kept, only unused.
- **3.3** Tip has an enabled/disabled toggle, independent of its saved text. When disabled, the card shows a single Description block and no Tip heading, regardless of saved tip content.
- **3.4** Preview shows the card face rendered from the tab's current values, including unsaved ones. Description and tip share one flowing region on the card rather than two independently sized boxes: growing one narrows the room available to the other in the preview, matching what the printed card will do.
- **3.5** Description and tip are checked as one combined region, not measured line by line: PinPoint knows only whether the combined content still fits the card, not how many lines over it runs. While it does not fit, the Apron card tab shows one card-level notice rather than a per-field message, and exporting it requires the override in §9.5. The card can still be saved.
- **3.6** Changing apron size, template, card description, tip, or a credit display setting requires the machine-management capability: machine owner, technician, or administrator.
- **3.7** The card description and tip offer bold, italic, bulleted lists, and numbered lists, and the card prints that formatting. When the card uses the machine's main description, it prints bold, italic, and lists, and prints headings and links as plain text.
- **3.8** Every signed-in member sees the Apron card tab. A member without the machine-management capability sees each saved card's Preview and Export and no editing controls.

## 4. Apron size

- **4.1** Apron size is a field stored per saved card, drawn from the supported set (§1).
- **4.2** When a machine's Pinball Map match implies a size, PinPoint fills it for each new saved card; a person can always override it.
- **4.3** An unmatched machine's apron size is set directly, with no default. Every saved card has an apron size; a card without one cannot be saved. A machine with no saved cards has no card to export; its card entry point says so.

## 5. Layout

- **5.1** On the Standard template, a card face is two regions side by side: a dark identity panel (title, edition, manufacturer · year, design and art credits, owner, APC logo) and a light action-and-description column.
- **5.2** On the Standard template, the action column's top portion holds a "Scan this machine" header and up to three action rows (report a problem, post a score, playing tips) on the left, with the QR code to their right. A divider separates this from the description (and tip, when enabled) below.
- **5.3** In every template, card copy names every destination reachable through the QR: reporting an issue, posting a score via iScored, and reading playing tips — in that order.
- **5.4** The playing tips row appears only when the machine has tips (pintips §3.6).
- **5.5** Every saved card has a template (§1). A new saved card starts on Standard; a person can change it at any time without losing any of the card's content.
- **5.6** On the Side rail template, a card face is a narrower dark identity panel (title, edition, manufacturer · year, owner, APC logo) beside a light column. The QR code sits at the column's top right with the destinations named as short captions beneath it, and the description and tip fill the rest of the column, wrapping around the QR.
- **5.7** On the Header band template, a dark band across the top holds the title, then edition, manufacturer · year, and owner on one line, with the APC logo at its right end. Below it, the description and tip flow through two columns beside a column holding the QR code, with the destinations named as short captions beneath it.

## 6. Title fit

- **6.1** The title uses the fit rule (§1) to size and wrap the machine's name within the identity panel.
- **6.2** The edition line, when present, renders under the title at a fixed size — it does not participate in the title's shrink rule.
- **6.3** The APC logo keeps its place at the bottom of the identity panel. When the panel's other content would reach it, the title shrinks further (§1) instead.
- **6.4** When the identity panel's content still reaches the logo with the title at its floor size, the card does not fit: as with description and tip (§3.5), the same card-level notice shows and exporting it requires the override in §9.5.
- **6.5** On the Header band template, the fit rule sizes the title to the band's width with a two-line limit in place of three, and the band's own content must fit beside the logo; a title that still does not fit at its floor size makes the card not fit (§6.4).

## 7. Edition

- **7.1** The edition line renders only when Pinball Map's grouped-family data supplies one for the machine's match. PinPoint never invents an edition by parsing an ungrouped Pinball Map name (PP-esta.1).

## 8. Scan target

- **8.1** The QR code encodes the machine's scan hub (`/m/<initials>/hub`), tagged with an `apron` source.
- **8.2** The card is the machine's sole on-cabinet entry point once printed; it replaces the existing iScored sticker. The landing experience is the scan hub, specified in `machine-scan-hub.md`.

## 9. Export

- **9.1** A saved card can be exported once it is saved; export is unavailable against unsaved content.
- **9.2** At least one export format renders the card at its exact physical dimensions (§1's apron size), suitable for printing at 100% with no fit-to-page scaling. Export may offer more than one format; adding a format does not change the authoring flow in §3.
- **9.3** Exporting a saved card requires signed-in membership. A member who cannot edit the machine can export its card but cannot change its size or content.
- **9.4** Export offers every saved card and marks each card that does not fit.
- **9.5** Exporting a card that does not fit requires ticking an explicit override in the export menu each time; the override is not saved.

## 10. Credits

- **10.1** A machine linked to a Pinball Map catalog title takes its credits from that title's OPDB record, read from the copy of OPDB's published data that PinPoint stores and refreshes on a schedule (collections-and-tags §9.1). A machine declared uncataloged uses its hand-entered designers and artists (pinballmap §2.4). Rendering a card never contacts OPDB.
- **10.2** On the Standard template, the card shows credits as two rows in the identity panel, Design then Art, below manufacturer · year and above the owner line.
- **10.3** A row lists the role's names in their source's order, comma-separated. When a role has more than two names, the row shows the first two followed by a count of the rest.
- **10.4** A role with no credits shows "Unknown". This includes both roles for a machine that is neither linked nor uncataloged, or whose catalog title has no OPDB record.
- **10.5** Each role's row has its own per-card display setting, on by default for every machine, including machines with no credits. Turning a setting off removes that row from the card. The Side rail and Header band templates show no credits; a card keeps its display settings while it uses one of them, and the Apron card tab hides those settings there.
- **10.6** While any credit row shows, the APC logo renders smaller to give the identity panel room.

## 11. Saved cards

- **11.1** A machine starts with no saved cards.
- **11.2** Each saved card has a name, unique within its machine.
- **11.3** A person can add a saved card; it starts blank apart from the apron size PinPoint fills (§4.2).
- **11.4** While editing a saved card, a person can copy the card description and tip from another of the same machine's saved cards.
- **11.5** A person can rename or delete any saved card, including a machine's only one.
- **11.6** The Apron card tab shows one saved card at a time, with a control to switch between them. Switching keeps unsaved edits to every card; saving the tab saves all of them.
- **11.7** Adding, renaming, or deleting a saved card requires the machine-management capability (§3.6).

## 12. Batch printing

- **12.1** A member can open a Print apron cards page from the Machines list. It requires the same signed-in membership as exporting one card (§9.3).
- **12.2** The page lists every saved card of every machine that is not Removed, grouped by apron size. A person selects cards one at a time or a whole size group at once, and can narrow the list by machine name.
- **12.3** A card that does not fit is listed and marked. It can be selected only while an explicit override on the page is ticked; the override is not saved (§9.5).
- **12.4** The page shows, for each apron size with a selected card, the number of selected cards, cards per sheet, sheets, and empty positions, and the total number of files and sheets.
- **12.5** Downloading produces one print file per apron size with a selected card. Every sheet in a file holds only that size's cards in the same grid, so the file's printed stack can be cut together. Cards print at their exact dimensions (§9.2).
- **12.6** A person chooses the paper, 11 × 17 in (the default) or 8.5 × 11 in, and the printer's edge margin, 4 mm (the default) or ¼ in. Cards per sheet follow from the paper, the margin, and the apron size.
- **12.7** Neighbouring cards on a sheet sit edge to edge and share one cut wherever their touching edges print the same; a card may print upside down to make that happen. Cards are separated by a gap only where one card's bleed would otherwise print onto its neighbour.
- **12.8** Empty positions on a file's last sheet are filled with spare copies of that file's cards, unless the person turns spares off.
- **12.9** Each sheet prints a short mark at the sheet edge on every cut line, and a line outside the cards naming the apron size and the sheet's number in its file.
- **12.10** Downloading also offers an order sheet for the print shop: the paper, full color, single-sided, actual-size printing with no fit-to-page, and for each file its sheet count, card count, and cut positions measured from the sheet's left and top edges, in cutting order.

## Known divergences

| Requirement | Current implementation gap |
| :-- | :-- |
| §4.2 | Automatic apron-size fill from a Pinball Map match is intentionally deferred. Editors choose a size manually for now; unmatched machines still have no default. |

## Changelog

| Date | Change |
| :-- | :-- |
| 2026-10-04 | Added §12 Batch printing: a Print apron cards page selects saved cards across machines and downloads one N-up print file per apron size, plus an order sheet for the print shop. |
| 2026-10-04 | Apron sizes: Stern/SPIKE becomes Stern / Data East / Sega and WPC becomes Williams / WPC; adds Bally solid state, Bally EM, Gottlieb EM, and Williams EM (§1, §4.1). |
| 2026-10-03 | Card templates: each saved card chooses Standard, Side rail, or Header band; the two new templates give description and tip more room and show no credits (§1, §2.3, §3.1, §3.6, §5.1–§5.7, §6.5, §10.2, §10.5). |
| 2026-10-02 | Card editing moves from the machine form to its own Apron card tab with its own Save; the New Machine page has no card; the Service tab thumbnail is replaced by the tab (§3.1–3.5, §3.8, §11.6). |
| 2026-09-28 | Multiple saved cards per machine, each with a required size; an overflowing card saves and exports only with an explicit override (§1, §3.1, §3.5, §3.8, §4.1–4.3, §6.4, §9.1, §9.4, §9.5, §10.5, §11). |
| 2026-09-28 | §5.2–§5.3: the card names playing tips as a third QR destination. §5.4 added: the playing tips row appears only for a machine with tips. |
| 2026-09-27 | Card settings are edited in the machine form's Apron card section on the Manage tab and New Machine page, with no separate editor; Preview renders unsaved values; card description and tip become rich text that prints bold, italic, and lists; the Service tab keeps a thumbnail with Preview and Export (§1, §3.1–3.8). Credits for an uncataloged machine come from its hand-entered designers and artists (§1, §10.1, §10.3, §10.4). |
| 2026-09-27 | §1 Title fit: a title may also break after a hyphen or an ellipsis, so a title with no spaces can still wrap (PP-xeki.1). |
| 2026-09-25 | Added §6.4: an identity panel that does not fit at the title's floor size blocks save and export, like description and tip overflow. |
| 2026-09-25 | Added §10 Credits (OPDB design and art credits in the identity panel, per-role display settings on by default, "Unknown" when missing, two-name limit) and §6.3 (the title shrinks so the panel fits above the logo); updated §1, §2.1, §3.6, §5.1 to match. |
| 2026-09-20 | Added §3.6 and §9.3: card edits use the machine-management capability; exporting is member+ and does not grant editing. |
| 2026-09-18 | §1 Scan target, §8.1, §8.2: the QR encodes the machine's scan hub (`/m/<initials>/hub`) rather than the machine page; the landing experience is now specified in `machine-scan-hub.md`. |
| 2026-09-15 | Initial draft: card content, apron size, description/tip authoring, title fit, edition sourcing, scan target. |
| 2026-09-18 | Authoring surface is reached from Service and Manage (was Manage-only); description/tip overflow is a combined-region check that blocks save and export (§3.5, new); added §9 Export — exact-size format required, extensible. |
