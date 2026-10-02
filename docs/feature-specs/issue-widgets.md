# Issue Widgets — Feature Spec

**Status: draft.**

**What this document is.** The requirements for the Summary Widgets on issue lists. Behavior every Summary Widget shares lives in `docs/feature-specs/widgets.md`; this document adds only what is specific to these widgets. It describes the intended final state only; what the code does or used to do lives solely in the Known divergences table. Each requirement is numbered for citation. When code and spec disagree, either the code is wrong or this document gets amended — never silently neither.

**Related records.** `docs/feature-specs/widgets.md` (shared Summary Widget requirements), `docs/feature-specs/collections-and-tags.md` (Collection and Tag membership, which scopes each Issues tab).

---

## 1. Concepts

- **Status Widget** — summarizes the population's open issues by status.
- **Severity Widget** — summarizes the population's open issues by severity.
- **Priority Widget** — summarizes the population's open issues by priority.

---

## 2. Hosts

- **2.1** The Issues list at `/issues` and the Issues tab of every standard Collection, owner Collection, and Tag page show the Status Widget, the Severity Widget, and the Priority Widget, in that order.
- **2.2** Each widget's All population is every issue, open or closed, on the host's On the Floor machines. On an Issues tab those are the On the Floor machines in that Collection or Tag.
- **2.3** _Retired 2026-10-02_ with the Filtered population (widgets §3.1). The old `status_widget`, `severity_widget`, and `priority_widget` parameters are ignored and dropped from the URL. Number kept so older citations don't dangle.
- **2.4** The Summary Row shows the open-issue total and the Unplayable open-issue count.

---

## 3. Status Widget

- **3.1** The headline states how many of the population's issues are open out of all its issues.
- **3.2** The Segments are, in order, Need Help, Need Parts, Pending Owner, New, Confirmed, and In Progress, dividing the population's open issues by status. Closed issues are excluded.
- **3.3** Selecting a Segment sets the Status filter to that status.

---

## 4. Severity Widget

- **4.1** The headline states how many open issues the population has and how many machines they belong to.
- **4.2** The Segments are, in order, Unplayable, Major, Minor, and Cosmetic, counting the population's open issues of each severity.
- **4.3** Selecting a Segment sets the Severity filter to that severity.

---

## 5. Priority Widget

- **5.1** The headline states how many open issues the population has and how many machines they belong to.
- **5.2** The Segments are, in order, High, Medium, and Low, counting the population's open issues of each priority.
- **5.3** Selecting a Segment sets the Priority filter to that priority.

---

## Known divergences (code vs spec)

| Requirement | Divergence | Resolution |
| :-- | :-- | :-- |
| §2.3, §2.4, §3.2, §4.2, §5.2 | Widget Population parameters, a three-figure Summary Row, and Segments in mildest-first order. | PP-jb9v |

---

## Changelog

| Date | Change |
| :-- | :-- |
| 2026-10-02 | Retired the Widget Population parameters (§2.3); the Summary Row drops the High priority count (§2.4); Segments run worst first (§3.2, §4.2, §5.2). |
| 2026-09-26 | §2.2: All counts only issues on On the Floor machines, matching the issue list's default view. |
| 2026-09-26 | Created. Establishes the Status, Severity, and Priority widgets on `/issues` and on every Collection and Tag Issues tab. |
