# Machine Scan Hub — Feature Spec

**Status: approved.**

**What this document is.** The requirements for the machine scan hub: the player-facing page a machine's apron-card QR opens. No implementation detail — design records and code carry that. It describes the intended final state only; what the code does or used to do lives solely in the Known divergences table. Each requirement is numbered for citation. When code and spec disagree, either the code is wrong or this document gets amended — never silently neither.

**Related records.** [machine-scan-hub-mockup.html](machine-scan-hub-mockup.html) (visual reference, locked 2026-09-18; canvas https://claude.ai/artifact/Fc7Qm1iMQ6o9MKkwvaUCg2, board "A3-Tim · View all on [iScored logo]"; unlinked state: canvas https://claude.ai/artifact/UhqRBvz9vM1yphnSXtgYZd, board "Unlinked · sentence only"). `docs/feature-specs/apron-cards.md` (the card whose QR opens the hub), `docs/feature-specs/iscored.md` (Top Scores card, score entry link), `docs/feature-specs/reporting.md` (Quick report). Bead PP-cov9 (build tracking); PP-a0be (pinTips on the hub, deferred).

---

## 1. Concepts

- **Scan hub** — the page a machine's apron-card QR opens. One hub per machine, at its own URL, distinct from the machine page and its tabs. Player-facing: it exists so the person standing at the machine can post a score, report a problem, and see what others have posted — not to maintain the machine.
- **Scan source** — the `apron` source tag the QR carries. The hub reads it and passes it on to the actions it launches, so scan traffic stays attributable.
- **Thumb zone** — the bottom of the hub's content area, directly above the tab bar, where the two action buttons live.

## 2. Route & shell

- **2.1** The hub lives at `/m/<initials>/hub`. The initials segment follows the machine page's canonical-casing rule: a lowercase or mixed-case scan redirects to the canonical URL.
- **2.2** The hub renders inside PinPoint's standard shell — the app header and the mobile bottom tab bar. It does not render the machine page's tab strip (Info · Settings · Service · Timeline · Manage).
- **2.3** The hub is reachable signed out. Signed-out visitors see the shell's normal Sign In / Sign Up controls; nothing on the hub requires an account before the first tap.
- **2.4** The hub is designed for phones. On a viewport 768px or wider it renders the same single column, centered, at phone width — it never grows a desktop layout.

## 3. Content, top to bottom

- **3.1** **Identity block** — the machine's name, then manufacturer · year · owner display name on one line. The block links to the machine's Info page and carries a "Details" affordance. The owner is shown by display name only (CORE-SEC-007).
- **3.2** **Top scores card** — a reduced form of the iScored Top Scores card (iScored spec §4): the "Top scores" label, three ranked rows, a "View all on" link carrying the iScored logo, and the card's empty and unlinked states (§4.4–§4.5). In the unlinked state the card keeps its label and the iScored logo (as a plain image) and shows one sentence — no iScored game is linked to this machine — to every viewer; it never renders the Manage link. It carries no Add score control — that action is the hub's Post a score button (§3.4). The hub never shows more than three scores.
- **3.3** **Open issues card** — the count of open issues in its label and the three newest open issues as rows (severity label, title, age), with a "See all" link to the machine's issues. With zero open issues it shows a quiet "No open issues" state.
- **3.4** **Action buttons** — two equal-size buttons side by side in the thumb zone, icon above label: **Post a score** (left) and **Report a problem** (right).
- **3.5** The hub shows no machine status indicator (Playable / Needs attention / Out of order) and no maintainer or owner tools.

## 4. Actions

- **4.1** **Post a score** opens the machine's iScored score entry link (iScored spec §1) in a new tab.
- **4.2** When the machine has no iScored link, Post a score is not rendered and Report a problem spans the full width of the thumb zone.
- **4.3** **Report a problem** opens Quick report (reporting spec §2–§3) with the machine preselected, carrying the scan source through.
- **4.4** The hub itself submits nothing — every write happens on the destination it links to.

## 5. Fit

- **5.1** On the reference phone (390×844 CSS px) the hub fits without scrolling with three scores, three issues, and both buttons at full size.
- **5.2** On the smallest supported phone (375×667) the hub still fits without scrolling: the Open issues card collapses to a single row — count, the newest issue's severity and title, "+N more" — and the whole card links to the machine's issues. Scores and buttons keep their size.
- **5.3** Below 375×667, scrolling is permitted; nothing is hidden.

## 6. Color

- **6.1** Post a score uses the primary token. Report a problem uses the existing `warning` token (amber) with dark text — the color family the Major severity label already uses. No new token is introduced.

## Changelog

| Date | Change |
| :-- | :-- |
| 2026-09-22 | §3.2: the unlinked state shows the sentence only, to everyone — the hub never renders the Manage link (resolves the conflict with §3.5). Unlinked-state mockup added. |
| 2026-09-21 | §3.2 narrowed: the hub's Top scores card is a reduced iScored card — no Add score control (Post a score is the thumb-zone button), "View all on" link carries the iScored logo. Mockup board reference updated. |
| 2026-09-18 | Initial draft: route and shell, content order, actions, fit on the reference and smallest phones, color. Design locked on canvas board "A3-Tim · amber". |
