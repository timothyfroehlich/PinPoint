# Machine Widgets — Feature Spec

**Status: draft.**

**What this document is.** The requirements for the Summary Widgets on Machine View for Machines, Collections, and Tags. Behavior every Summary Widget shares lives in `docs/feature-specs/widgets.md`; this document adds only what is specific to these widgets. It describes the intended final state only; what the code does or used to do lives solely in the Known divergences table. Each requirement is numbered for citation. When code and spec disagree, either the code is wrong or this document gets amended — never silently neither.

**Related records.** `docs/feature-specs/widgets.md` (shared Summary Widget requirements), `docs/feature-specs/machine-views.md` (Machine View, the Widget Host).

---

## 1. Concepts

- **Presence Widget** — summarizes where the population's machines are.
- **Playability Widget** — summarizes whether the population's On the Floor machines can be played.
- **Open Issues Widget** — _Retired 2026-09-27._ Its Segments counted issues while selecting one filtered to machines, so its counts disagreed with the rows. The Severity Widget on Issues tabs (issue-widgets §4) summarizes open issues by severity instead.

---

## 2. Hosts

- **2.1** Machine View on Machines and on every standard Collection, owner Collection, and Tag page shows the Presence Widget and the Playability Widget, in that order.
- **2.2** _Retired 2026-10-02_ with the Filtered population (widgets §3.1). The old `presenceWidget` and `playabilityWidget` parameters are ignored and dropped from the URL. Number kept so older citations don't dangle.
- **2.3** The widgets use only Machine View's base rows and health enrichment (machine-views §3.4) and never load service or activity enrichment.
- **2.4** The Summary Row shows the Playability headline. On narrow phones it may show only the figures, but screen readers still hear the full headline.

---

## 3. Presence Widget

- **3.1** The headline states how many of the population's machines are On the Floor out of all its machines other than Removed ones.
- **3.2** The Segments are, in order, On the Floor, Off the Floor, On Loan, and Pending Arrival, dividing the population's machines by presence. Removed machines are not counted.
- **3.3** Selecting a Segment sets the Presence filter to that presence state.

---

## 4. Playability Widget

- **4.1** The headline states how many of the population's On the Floor machines are playable out of all its On the Floor machines. Operational and Needs Service machines are playable.
- **4.2** The Segments are, in order, Unplayable, Needs Service, and Operational, dividing the population's On the Floor machines by Playability (machine-views §3.5). Machines in other presence states are excluded.
- **4.3** Selecting a Segment sets the Playability filter to that Segment's value and the Presence filter to On the Floor.

---

## 5. Open Issues Widget (retired)

- **5.1–5.4** _Retired 2026-09-27_ with the Open Issues Widget (§1). Numbers kept so older citations don't dangle.

---

## Known divergences (code vs spec)

| Requirement | Divergence | Resolution |
| :-- | :-- | :-- |
| §2.2, §2.4, §3.1, §3.2, §4.2 | Widget Population parameters exist; the Summary Row shows two figures, Presence counts Removed machines, and Segments run in the old order. | PP-jb9v |

---

## Changelog

| Date | Change |
| :-- | :-- |
| 2026-10-02 | Retired the Widget Population parameters (§2.2). The Summary Row shows only the Playability headline (§2.4); Presence leads with On the Floor, its default filter, and no longer counts Removed machines (§3.1, §3.2); Playability runs worst first (§4.2). |
| 2026-09-27 | Retired the Open Issues Widget (§1, §2.1, §2.2, §2.4, §5); the Machine View Severity filter stays. |
| 2026-09-26 | Created. Establishes the Presence, Playability, and Open Issues widgets on Machines, Collections, and Tags. |
