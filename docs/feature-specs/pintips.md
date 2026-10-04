# PinTips — Feature Spec

**Status: draft.**

**What this document is.** The requirements for showing PinTips playing tips on a machine's Info tab and scan hub. No implementation detail — design records and code carry that. It describes the intended final state only; what the code does or used to do lives solely in the Known divergences table. Each requirement is numbered for citation. When code and spec disagree, either the code is wrong or this document gets amended — never silently neither.

**Related records.** Canvas https://claude.ai/artifact/PFvYuNrju4e2pfyrUshttN (boards "Hub A · Tip card under Top scores (chosen)", "Small phone · 1+2: card peeks, fade", "Info B · Compact tip card (chosen)"). `docs/feature-specs/machine-scan-hub.md` (§3.8, the tip card on the hub). Bead PP-a0be.

---

## 1. Concepts

- **PinTips** — Match Play Events' crowd-sourced collection of short playing tips for pinball games. Each tip has text, one category, and a vote total. Match Play owns the content; PinPoint shows it and links back to it.
- **Game** — PinTips keeps one list of tips per OPDB game (the title, such as Godzilla), not per edition. A machine's game is the OPDB game of its model, so a Premium and a Pro of the same title show the same tips.
- **Stored copy** — PinPoint's own copy of the PinTips data. Pages read only the stored copy.
- **Tip card** — the card that shows one tip on a machine's Info tab and scan hub.

## 2. Data

- **2.1** PinPoint takes tips from the PinTips export file Match Play publishes, never from Match Play's API or its web pages. (Verified 2026-09-27: Match Play's API documentation directs OPDB and PinTips consumers to the published export files rather than the API, and the export keys each tip by OPDB game id. This is their published guidance and may change.)
- **2.2** PinPoint refreshes the stored copy once a day.
- **2.3** A refresh makes the stored copy match the export: a tip removed from PinTips disappears from PinPoint at the next refresh.
- **2.4** A refresh whose download fails, or whose file is empty or unreadable, leaves the stored copy unchanged.
- **2.5** Rendering a page never contacts Match Play.
- **2.6** PinPoint never shows a tip in PinTips' `illegal` category. (Verified 2026-09-27: 5 of 3,477 tips carry it; it reads as a moderation flag, not a playing category.)
- **2.7** A machine whose model has no OPDB id has no tips.

## 3. Tip card

- **3.1** The tip card shows one tip: its full text, its category, the PinTips name, and a link to the game's PinTips page on Match Play that opens in a new tab.
- **3.2** The tip shown is picked at random on each page load, weighted by vote total, so higher-voted tips appear more often and every tip can appear.
- **3.3** The tip card offers a shuffle control that shows another of the game's tips without reloading the page.
- **3.4** The category shows for every tip, General included. The category names are General, Multiball, Skill shot, Wizard, and Secret.
- **3.5** The link names Match Play in text. The tip card shows no Match Play logo.
- **3.6** When the machine has no tips (§2.7, or its game has none), the tip card is not rendered — on the Info tab and on the scan hub alike. No empty state takes its place.
- **3.7** PinPoint offers no way to add, edit, or vote on tips. Those happen on Match Play.

## 4. Placement

- **4.1** On the machine's Info tab, the tip card sits in the reference rail directly after the Top scores card.
- **4.2** On the scan hub, the tip card sits between the Top scores card and the Open issues card (scan hub spec §3.8).

## Known divergences

_None — the current implementation matches this spec._

## Changelog

| Date | Change |
| :-- | :-- |
| 2026-10-04 | 4.1: the tip card follows Top scores; the Tags card moved to the top of the reference rail (collections-and-tags, PP-wqit.3). |
| 2026-09-27 | Initial draft: data source and daily stored copy, tip card (random weighted pick, shuffle, category, Match Play link, hidden when no tips), placement on the Info tab and scan hub. |
