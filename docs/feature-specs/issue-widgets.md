# Issue Widgets — Feature Spec

**Status: draft.**

**What this document is.** The requirements for the Summary Widgets on issue lists. Behavior every Summary Widget shares lives in `docs/feature-specs/widgets.md`; this document adds only what is specific to these widgets. It describes the intended final state only; what the code does or used to do lives solely in the Known divergences table. Each requirement is numbered for citation. When code and spec disagree, either the code is wrong or this document gets amended — never silently neither.

**Related records.** `docs/feature-specs/widgets.md` (shared Summary Widget requirements), `docs/feature-specs/collections-and-tags.md` (Collection and Tag membership, which scopes each Issues tab).

---

## 1. Concepts

- **Status Widget** — summarizes the population's open issues by status group.
- **Severity Widget** — summarizes the population's open issues by severity.
- **Priority Widget** — summarizes the population's open issues by priority.

---

## 2. Hosts

- **2.1** The Issues list at `/issues` and the Issues tab of every Collection and Tag page show the Status Widget, the Severity Widget, and the Priority Widget, in that order.
- **2.2** Each widget's population is every issue, open or closed, on the host's On the Floor machines. On an Issues tab those are the On the Floor machines in that Collection or Tag.
- **2.3** _Retired 2026-10-02_ with the Filtered population (widgets §3.1). The old `status_widget`, `severity_widget`, and `priority_widget` parameters are ignored and dropped from the URL. Number kept so older citations don't dangle.
- **2.4** The Summary Row shows the open-issue total and the Unplayable open-issue count.

---

## 3. Status Widget

- **3.1** _Retired 2026-10-04._ Summary Widgets no longer show a headline (widgets §5.1). Number kept so older citations don't dangle.
- **3.2** The Segments are, in order, New and In Progress, dividing the population's open issues by status group. Closed issues are excluded.
- **3.3** Selecting a Segment sets the Status filter to every status in that group.

---

## 4. Severity Widget

- **4.1** _Retired 2026-10-04._ Summary Widgets no longer show a headline (widgets §5.1). Number kept so older citations don't dangle.
- **4.2** The Segments are, in order, Unplayable, Major, Minor, and Cosmetic, counting the population's open issues of each severity.
- **4.3** Selecting a Segment sets the Severity filter to that severity.

---

## 5. Priority Widget

- **5.1** _Retired 2026-10-04._ Summary Widgets no longer show a headline (widgets §5.1). Number kept so older citations don't dangle.
- **5.2** The Segments are, in order, High, Medium, and Low, counting the population's open issues of each priority.
- **5.3** Selecting a Segment sets the Priority filter to that priority.

---

## Known divergences (code vs spec)

| Requirement | Divergence | Resolution |
| :---------- | :--------- | :--------- |

---

## Changelog

| Date | Change |
| :-- | :-- |
| 2026-10-07 | Owner Collections retired; the widgets appear on every Collection and Tag Issues tab (2.1). |
| 2026-10-05 | The Status Widget's Segments are the New and In Progress status groups (§1, §3.2, §3.3). |
| 2026-10-04 | Retired the widget headlines (§3.1, §4.1, §5.1). |
| 2026-10-02 | Reworded the population (§2.2); retired the Widget Population parameters (§2.3); the Summary Row drops the High priority count (§2.4); Segments run worst first (§3.2, §4.2, §5.2). |
| 2026-09-26 | §2.2: All counts only issues on On the Floor machines, matching the issue list's default view. |
| 2026-09-26 | Created. Establishes the Status, Severity, and Priority widgets on `/issues` and on every Collection and Tag Issues tab. |
