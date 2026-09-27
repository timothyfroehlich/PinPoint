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
- **2.2** Each host's complete authoritative scope, and so each widget's All population, is every issue that host may show, open or closed. On an Issues tab that is every issue on the machines in that Collection or Tag.
- **2.3** Their Widget Population parameters are `status_widget`, `severity_widget`, and `priority_widget`.
- **2.4** The Summary Row shows the open-issue total, the Unplayable open-issue count, and the High priority open-issue count.

---

## 3. Status Widget

- **3.1** The headline states how many of the population's issues are open out of all its issues.
- **3.2** The Segments are New, Confirmed, In Progress, Need Parts, Need Help, and Pending Owner, dividing the population's open issues by status. Closed issues are excluded.
- **3.3** Selecting a Segment sets the Status filter to that status.

---

## 4. Severity Widget

- **4.1** The headline states how many open issues the population has and how many machines they belong to.
- **4.2** The Segments are Cosmetic, Minor, Major, and Unplayable, counting the population's open issues of each severity.
- **4.3** Selecting a Segment sets the Severity filter to that severity.

---

## 5. Priority Widget

- **5.1** The headline states how many open issues the population has and how many machines they belong to.
- **5.2** The Segments are Low, Medium, and High, counting the population's open issues of each priority.
- **5.3** Selecting a Segment sets the Priority filter to that priority.

---

## Known divergences (code vs spec)

| Spec  | Code today                          | Resolution                   |
| :---- | :---------------------------------- | :--------------------------- |
| §1–§5 | Issue lists show no Summary Widgets | Issue widgets implementation |

---

## Changelog

| Date | Change |
| :-- | :-- |
| 2026-09-26 | Created. Establishes the Status, Severity, and Priority widgets on `/issues` and on every Collection and Tag Issues tab. |
