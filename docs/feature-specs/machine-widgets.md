# Machine Widgets — Feature Spec

**Status: draft.**

**What this document is.** The requirements for the Summary Widgets on Machine View for Machines, Collections, and Tags. Behavior every Summary Widget shares lives in `docs/feature-specs/widgets.md`; this document adds only what is specific to these widgets. It describes the intended final state only; what the code does or used to do lives solely in the Known divergences table. Each requirement is numbered for citation. When code and spec disagree, either the code is wrong or this document gets amended — never silently neither.

**Related records.** `docs/feature-specs/widgets.md` (shared Summary Widget requirements), `docs/feature-specs/machine-views.md` (Machine View, the Widget Host).

---

## 1. Concepts

- **Presence Widget** — summarizes where the population's machines are.
- **Playability Widget** — summarizes whether the population's On the Floor machines can be played.
- **Open Issues Widget** — summarizes the population's open issues by severity.

---

## 2. Hosts

- **2.1** Machine View on Machines and on every standard Collection, owner Collection, and Tag page shows the Presence Widget, the Playability Widget, and the Open Issues Widget, in that order.
- **2.2** Their Widget Population parameters are `presenceWidget`, `playabilityWidget`, and `issuesWidget`.
- **2.3** The widgets use only Machine View's base rows and health enrichment (machine-views §3.4) and never load service or activity enrichment.
- **2.4** The Summary Row shows the Presence headline's machine total, the Playability headline, and the Open Issues headline's open-issue total.

---

## 3. Presence Widget

- **3.1** The headline states how many machines the population has.
- **3.2** The Segments are On the Floor, Off the Floor, On Loan, Pending Arrival, and Removed, dividing the population's machines by presence.
- **3.3** Selecting a Segment sets the Presence filter to that presence state.

---

## 4. Playability Widget

- **4.1** The headline states how many of the population's On the Floor machines are playable out of all its On the Floor machines. Operational and Needs Service machines are playable.
- **4.2** The Segments are Operational, Needs Service, and Unplayable, dividing the population's On the Floor machines by Playability (machine-views §3.5). Machines in other presence states are excluded.
- **4.3** Selecting a Segment sets the Playability filter to that Segment's value and the Presence filter to On the Floor.

---

## 5. Open Issues Widget

- **5.1** The headline states how many open issues the population has and how many machines they belong to.
- **5.2** The Segments are Cosmetic, Minor, Major, and Unplayable, counting the population's open issues of each severity.
- **5.3** Closed issues never contribute.
- **5.4** Selecting a Segment sets the Open Issue Severity filter (machine-views §3.11) to that severity.

---

## Known divergences (code vs spec)

| Spec | Code today | Resolution |
| :-- | :-- | :-- |
| §1–§5 | Machine View shows no Summary Widgets | Machine widgets implementation (PP-3h21) |

---

## Changelog

| Date | Change |
| :-- | :-- |
| 2026-09-26 | Created. Establishes the Presence, Playability, and Open Issues widgets on Machines, Collections, and Tags. |
