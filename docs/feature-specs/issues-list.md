# Issues List — Feature Spec

**Status: draft.**

**What this document is.** The requirements for Issue View, the List Host that lists issues on `/issues` and on the Issues tab of every Collection and Tag. Behavior every List View shares lives in `docs/feature-specs/list-views.md`; this document adds only what is specific to issues. It describes the intended final state only; what the code does or used to do lives solely in the Known divergences table. Each requirement is numbered for citation. When code and spec disagree, either the code is wrong or this document gets amended — never silently neither.

**Related records.** `docs/feature-specs/list-views.md` (shared List View), `docs/feature-specs/issue-widgets.md` (the Summary Widgets on Issue View), `docs/feature-specs/collections-and-tags.md` (membership that scopes each Issues tab), `docs/feature-specs/issue-detail.md` (the page an issue row opens). Epic PP-jb9v.

---

## 1. Concepts

- **Issue View** — the List Host for issues.
- **Open statuses** — every status in the New and In Progress groups. **Closed statuses** — every status in the Closed group.
- **Machine Presence filter** — a filter on the presence of each issue's machine, so issues on machines that are not On the Floor can be shown or hidden deliberately.

---

## 2. Hosts and Scope

- **2.1** Issue View appears on `/issues` and on the Issues tab of every standard Collection, owner Collection, and Tag.
- **2.2** On an Issues tab the scope is the issues on that Collection's or Tag's machines; a Machine filter can narrow it but never widen it.
- **2.3** The page title is "Issues". Issue View adds no page action; reporting an issue stays in the app header and tab bar.

---

## 3. Rows

- **3.1** Every issue row has two lines at every screen size, and the full title is always shown, wrapping rather than truncating. On a narrow phone the second line also wraps rather than truncating, so the row may run longer.
- **3.2** Line 1 shows the status icon, the title (linking to the issue), the severity badge, and the priority badge.
- **3.3** Line 2 shows the issue ID, the machine name (linking to the machine), the status name, and how long ago the issue was updated.
- **3.4** On desktop the row's right side shows the comment count (when nonzero) and the assignee's avatar; on phones the assignee's initials end line 2.
- **3.5** A person allowed to change an issue can change its status, severity, priority, and assignee from the row. Other people see the same values as plain text.
- **3.6** After a change from a row, the row keeps its place in the list until the list next reloads, even if the change means it no longer matches the sort or filters.
- **3.7** An unassigned issue shows an empty avatar announced as "Unassigned". Assignee names never show email addresses.

---

## 4. Search and Filters

- **4.1** Search matches issue titles, issue IDs (such as AFM-12), machine names and initials, people's names, description text, and comment text.
- **4.2** The Primary Filters, in order, are Status, Severity, Priority, Machine, Assignee, and Machine Presence.
- **4.3** The Secondary Filters, in order, are Created, Updated, Frequency, Machine owner, Machine tag, Machine collection, Reporter, and Watching. Machine tag and Machine collection follow collections-and-tags §12.
- **4.4** Status offers every status grouped by status group; selecting a group selects all its statuses. The control reads "Open" when exactly the Open statuses are selected.
- **4.5** Machine searches machines by name and initials, leaving out Removed machines unless Machine Presence includes Removed, and offers a My machines shortcut (machines the person owns, other than Removed ones). A machine already selected stays listed.
- **4.6** Assignee searches people by name and offers Me and Unassigned shortcuts.
- **4.7** Machine Presence offers every presence state.
- **4.8** Created and Updated are date ranges.
- **4.9** Me, My machines, Watching, and Machine collection appear only to signed-in people.
- **4.10** Machine owner searches people by name and offers Me and Unassigned shortcuts; Unassigned matches machines with no owner. Reporter searches people by name and offers a Me shortcut.

---

## 5. Sorting, Export, and View Options

- **5.1** Sort options are Updated, Created, Issue ID, Severity, Priority, and Assignee, each in either direction. The default is Updated, newest first.
- **5.2** Assignee sorts by the assignee's display name, unassigned last; ties fall back to Updated, newest first.
- **5.3** Every sort is deterministic: ties end in issue ID order.
- **5.4** Export downloads a CSV of every issue matching the current View Configuration across all pages, within the Surface's scope.
- **5.5** View options holds page size only.

---

## 6. Page Preset and Built-in Views

- **6.1** The Page Preset is Open issues: Open statuses, Machine Presence On the Floor, sorted by Updated, newest first.
- **6.2** `/issues` and every Issues tab offer four Built-in Views, in order: **Open issues** (the Page Preset); **My issues** (Open statuses assigned to the viewer, every presence except Removed, Updated newest first); **Unassigned** (Open statuses with no assignee, On the Floor, Updated newest first); **Recently fixed** (status Fixed, every presence except Removed, Updated newest first).
- **6.3** My issues appears only to signed-in people.
- **6.4** Removed machines' issues appear only when a person sets Machine Presence to include Removed; no Built-in View includes them.

---

## 7. URL State

- **7.1** Canonical parameters are `q`, `status`, `severity`, `priority`, `machine`, `assignee`, `presence`, `created`, `updated`, `frequency`, `owner`, `tag`, `collection`, `reporter`, `watching`, `sort`, `dir`, `page`, `pageSize`, and `view`.
- **7.2** The older parameters `page_size`, a composite `sort` such as `updated_desc`, `include_inactive_machines`, and the separate created and updated date bounds open correctly and are rewritten to the canonical form (list-views §9.4).
- **7.3** Machine values are machine initials; people are stable IDs plus the `me` and `unassigned` sentinels; `me` means whoever is viewing.
- **7.4** A link to Issues for one machine, from a machine page or a Machine View cell, also sets Machine Presence to every presence state, so the machine's issues show whatever its presence.

---

## 8. Returning to the List

- **8.1** The Issues tab in the app navigation follows list-views §11: it reopens the last Issue View configuration used in the current browser session, and a new session opens the list as list-views §10.10 describes.

---

## Known divergences (code vs spec)

| Requirement | Divergence | Resolution |
| :---------- | :--------- | :--------- |

---

## Changelog

| Date | Change |
| :-- | :-- |
| 2026-10-05 | Machine tag and Machine collection Secondary Filters (4.3, 4.9) and their `tag` and `collection` parameters (7.1). |
| 2026-10-04 | Search also matches description text (4.1). Machine owner offers Me and Unassigned shortcuts and Reporter offers Me (4.10). |
| 2026-10-03 | Machine and My machines leave out Removed machines unless Machine Presence includes Removed (4.5). |
| 2026-10-03 | §3.1: on a narrow phone the second line wraps rather than truncating. |
| 2026-10-02 | Created from the approved list-framework design: two-line rows with inline editing, Primary and Secondary Filters including Machine Presence, sorting and export rules, the Open issues Page Preset and four Built-in Views, and canonical URL state with aliases for older parameters. |
