# Machine Scan Hub — Feature Spec

**Status: approved.**

**What this document is.** The requirements for the machine scan hub: the player-facing page a machine's apron-card QR opens. No implementation detail — design records and code carry that. It describes the intended final state only; what the code does or used to do lives solely in the Known divergences table. Each requirement is numbered for citation. When code and spec disagree, either the code is wrong or this document gets amended — never silently neither.

**Related records.** [machine-scan-hub-mockup.html](machine-scan-hub-mockup.html) (visual reference, locked 2026-09-18; canvas https://claude.ai/artifact/Fc7Qm1iMQ6o9MKkwvaUCg2, board "A3-Tim · View all on [iScored logo]"; unlinked state: canvas https://claude.ai/artifact/UhqRBvz9vM1yphnSXtgYZd, board "Unlinked · sentence only"; artwork band: canvas https://claude.ai/artifact/LVMtxXzPLCHucYPFwsmEr8, boards "H5 ·", locked 2026-09-24). `docs/feature-specs/apron-cards.md` (the card whose QR opens the hub), `docs/feature-specs/iscored.md` (Top Scores card, score entry link), `docs/feature-specs/reporting.md` (Quick report). Bead PP-cov9 (build tracking); `docs/feature-specs/pintips.md` (tip card); PP-o355.60 (artwork band). Scrolling hub and tip card: canvas https://claude.ai/artifact/PFvYuNrju4e2pfyrUshttN, boards "Hub A · …" and "Small phone · 1+2: card peeks, fade" (2026-09-27).

---

## 1. Concepts

- **Scan hub** — the page a machine's apron-card QR opens. One hub per machine, at its own URL, distinct from the machine page and its tabs. Player-facing: it exists so the person standing at the machine can post a score, report a problem, and see what others have posted — not to maintain the machine.
- **Scan source** — the `apron` source tag the QR carries. The hub reads it and passes it on to the actions it launches, so scan traffic stays attributable.
- **Thumb zone** — a bar pinned directly above the tab bar that holds the two action buttons. It stays in place while the hub scrolls.

## 2. Route & shell

- **2.1** The hub lives at `/m/<initials>/hub`. The initials segment follows the machine page's canonical-casing rule: a lowercase or mixed-case scan redirects to the canonical URL.
- **2.2** The hub renders inside PinPoint's standard shell — the app header and the mobile bottom tab bar. It does not render the machine page's tab strip (Info · Settings · Service · Timeline · Manage).
- **2.3** The hub is reachable signed out. Signed-out visitors see the shell's normal Sign In / Sign Up controls; nothing on the hub requires an account before the first tap.
- **2.4** The hub is designed for phones. On a viewport 768px or wider it renders the same single column, centered, at phone width — it never grows a desktop layout.

## 3. Content, top to bottom

- **3.1** **Identity block** — the machine's name, then manufacturer · year · owner display name on one line. The block links to the machine's Info page and carries a "Details" affordance. The owner is shown by display name only (CORE-SEC-007). When the machine has artwork (§3.6), the identity block sits over the bottom edge of the artwork band.
- **3.2** **Top scores card** — a reduced form of the iScored Top Scores card (iScored spec §4): the "Top scores" label, three ranked rows, a "View all on" link carrying the iScored logo, and the card's empty and unlinked states (§4.4–§4.5). In the unlinked state the card keeps its label and the iScored logo (as a plain image) and shows one sentence — no iScored game is linked to this machine — to every viewer; it never renders the Manage link. It carries no Add score control — that action is the hub's Post a score button (§3.4). The hub never shows more than three scores.
- **3.3** **Open issues card** — the count of open issues in its label and the three newest open issues as rows (severity label, title, age), with a "See all" link to the machine's issues. With zero open issues it shows a quiet "No open issues" state.
- **3.4** **Action buttons** — two equal-size buttons side by side in the thumb zone, icon above label: **Post a score** (left) and **Report a problem** (right).
- **3.5** The hub shows no machine status indicator (Playable / Needs attention / Out of order) and no maintainer or owner tools.
- **3.6** **Artwork band** — when the machine's catalog entry has game artwork, the hub opens with a full-width band showing the whole image, never cropped, with an "Image: OPDB" credit linking to the image. Without artwork there is no band.
- **3.7** The artwork band is as tall as it can be while the top 60px of the card after Top scores stays visible above the thumb zone on first load, up to the image's own height at full width. When the band is shorter than the image, the image shrinks and a blurred copy of it fills the band's sides.
- **3.8** **Tip card** — between the Top scores card and the Open issues card, the PinTips tip card (PinTips spec §3). A machine without tips shows nothing there.

## 4. Actions

- **4.1** **Post a score** opens the machine's iScored score entry link (iScored spec §1) in a new tab.
- **4.2** When the machine has no iScored link, Post a score is not rendered and Report a problem spans the full width of the thumb zone.
- **4.3** **Report a problem** opens Quick report (reporting spec §2–§3) with the machine preselected, carrying the scan source through.
- **4.4** The hub itself submits nothing — every write happens on the destination it links to.

## 5. Fit

- **5.1** _Retired 2026-09-27._ Required the hub to fit the reference phone without scrolling; the hub now scrolls (§5.5). Number kept so older citations don't dangle.
- **5.2** _Retired 2026-09-27._ Same, for the smallest supported phone. Number kept.
- **5.3** _Retired 2026-09-27._ Permitted scrolling only below 375×667; §5.5 now permits it everywhere. Number kept.
- **5.4** The artwork band is never shorter than 180px. Where §3.7 would make it shorter, it stays at 180px and the page scrolls.
- **5.5** The hub scrolls when its content is taller than the space between the header and the thumb zone. The thumb zone stays pinned above the tab bar while it scrolls.
- **5.6** Content that scrolls under the thumb zone fades out at the thumb zone's top edge.

## 6. Color

- **6.1** Post a score uses the primary token. Report a problem uses the existing `warning` token (amber) with dark text — the color family the Major severity label already uses. No new token is introduced.

## Known divergences

_None — the current implementation matches this spec._

## Changelog

| Date | Change |
| :-- | :-- |
| 2026-09-27 | §5.1–§5.3 retired and §5.5–§5.6 added: the hub scrolls, with the action buttons pinned above the tab bar and content fading under them. §3.7: the band leaves the top 60px of the next card visible. §5.4: the band's minimum is 180px. §3.8 added: the PinTips tip card. §1 Thumb zone redefined as the pinned bar. |
| 2026-09-24 | §3.6–§3.7 added: artwork band at the top of the hub, whole image, sized to the free height with a blurred fill. §3.1: the identity block sits over the band. §5.2: the Open issues card no longer collapses on the smallest phone; the band shrinks instead. §5.4 added: the band's minimum height. |
| 2026-09-22 | §3.2: the unlinked state shows the sentence only, to everyone — the hub never renders the Manage link (resolves the conflict with §3.5). Unlinked-state mockup added. |
| 2026-09-21 | §3.2 narrowed: the hub's Top scores card is a reduced iScored card — no Add score control (Post a score is the thumb-zone button), "View all on" link carries the iScored logo. Mockup board reference updated. |
| 2026-09-18 | Initial draft: route and shell, content order, actions, fit on the reference and smallest phones, color. Design locked on canvas board "A3-Tim · amber". |
