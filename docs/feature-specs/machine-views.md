# Machine Views — Feature Spec

**Status: approved.**

**What this document is.** The requirements for PinPoint's shared machine-list experience on `/m`, standard Collections, and owner Collections. It describes the intended final state only; what the code does or used to do lives solely in the Known divergences table. Each requirement is numbered for citation. When code and spec disagree, either the code is wrong or this document gets amended — never silently neither.

**Related records.** `docs/feature-specs/list-views.md` (the shared List View that Machine View is built on), `docs/feature-specs/collections-and-tags.md` (Collection, Owner Collection, and Tag membership and access), `docs/feature-specs/widgets.md` and `docs/feature-specs/machine-widgets.md` (the Summary Widgets on Machine View).

---

## 1. Concepts

- **Machine View** — the List Host (list-views §1) for machines, used by Machines and Collections. It owns the machine fields, filters, rows, conditional data enrichment, and the machine query pipeline.
- **View Scope, Page Preset, Surface, Saved View, Default View, Built-in View** — _Moved 2026-10-02_ to list-views §1, where they apply to every List Host.
- **Displayed Field** — a Machine View field selected for display. Displayed fields, active filters, sorting, and search determine which optional data enrichments Machine View loads.
- **Bookmarkable View** — _Retired 2026-10-02._ list-views §9.1 now covers every List Host's URL state.
- **Display Mode** — the phone-only Compact list or Table presentation. Display Mode is a browser preference rather than bookmarkable URL state.

---

## 2. Shared Module and Scoping

- **2.1** `/m` and every page that lists a group of machines use one domain-specific Machine View implementation rather than separate card, table, or query pipelines.
- **2.2** Machine View shows exactly the machines in the scope its route supplies; the feature that owns each machine group defines its membership. No scope may leak machines from outside its authoritative set.
- **2.3** Machines and Collections define separate Page Presets. A preset owns default filters, displayed fields, sorting, and permitted fields; route callers supply only scope, preset, and URL search parameters.
- **2.4** Machine View is a List Host: it uses List View for layout, search and filter controls, the List Header, pagination, URL state, and Saved Views, and keeps its own fields, filters, rows, and query pipeline. Future tags and locations may add Machine View scopes or presets without changing the machine row model.
- **2.5** Unmatched external integration entries are not Machine rows. Their representation remains deferred until the Integrations design and must not be introduced as a premature generic row union.

---

## 3. Fields and Conditional Data

- **3.1** The field catalog contains Machine, Playability, Open Issues, Last Serviced, Presence, Owner, Manufacturer, Year, Oldest Open Issue, Last Activity, and Date Added. Each field declares its sorting behavior, data dependencies, and table and compact presentations.
- **3.2** Machine identity is always loaded. On desktop and tablet it is two lines: the machine title link plus its uppercase initials badge, then the machine's manufacturer, year, and owner. The phone Compact list shows it on one line (§5.3). Manufacturer, Year, and Owner remain fields of their own that a person can add as columns.
- **3.3** Missing owner, manufacturer, or year values display as “Unassigned” or “Unknown” as appropriate. Machine View never exposes owner email addresses.
- **3.4** Health enrichment is loaded only when required by displayed fields, active filters, sorting, or Summary Widgets. It consists of grouped open-issue count, cosmetic/minor/major/unplayable counts, worst open severity, and oldest open issue. Closed issues never contribute.
- **3.5** Playability is derived once on the server from compact issue aggregates; Machine View does not hydrate issue children.
- **3.6** Service enrichment is loaded only when required by displayed fields or sorting. Last Serviced is the deterministic latest non-deleted timeline event tagged `maintenance`, `adjustment`, `parts`, `upgrade`, `cleaning`, or `inspection`.
- **3.7** Activity enrichment is loaded only when Last Activity is displayed or sorted.
- **3.8** Search matches machine title, initials, manufacturer, canonical catalog title, and the legacy model-name fallback.
- **3.9** Filtering, deterministic sorting, and pagination occur in the server-only pipeline. The browser receives only the current page, filtered total count, Summary Widget counts, validated view state, permitted fields, and required filter options.
- **3.10** Initial delivery adds no database index. Query plans are benchmarked with realistic 100- and 500-machine fixtures and `EXPLAIN` evidence before proposing a partial open-issue or latest-service index.
- **3.11** The Open Issue Severity filter matches a machine that has at least one open issue of any selected severity.
- **3.12** The Primary Filters, in order, are Presence, Playability, Issue severity, Owner, Tag, and Collection. Machine View has no Secondary Filters. Tag and Collection follow collections-and-tags §12.
- **3.13** Owner searches people by name and offers Me (signed-in people only) and Unassigned shortcuts.
- **3.14** Every sortable field is offered in the List Header's sort control as well as by its column header.

---

## 4. URL State and Presets

- **4.1** Canonical Machine View URL state uses `q`, `presence`, `status`, `severity`, `owner`, `tag`, `collection`, `sort`, `dir`, `page`, `pageSize`, `columns`, and `view`.
- **4.2** Multi-values serialize as comma-separated canonical values. Owner filters use stable IDs plus the `me` and `unassigned` sentinels; `me` means whoever is viewing. Page sizes are limited to 25, 50, and 100. Severity filters use `cosmetic`, `minor`, `major`, and `unplayable`.
- **4.3** _Moved 2026-10-02_ to list-views §9.3.
- **4.4** _Moved 2026-10-02_ to list-views §4.7 and §4.8.
- **4.5** _Moved 2026-10-02_ to list-views §9.8.
- **4.6** Both initial Page Presets display Machine, Playability, Presence, Open Issues, Last Serviced, and Last Activity by default.
- **4.7** `/m` defaults to Presence “On the Floor” and machine-title ascending. An omitted `presence` parameter means On the Floor; `presence=all` is the explicit unfiltered state.
- **4.8** Collections open to On the Floor members by default, sorted worst playability first; All machines shows every presence state (§9.2).
- **4.9** _Moved 2026-10-02_ to list-views §9.1.
- **4.10** _Moved 2026-10-02_ to list-views §9.5.
- **4.11** _Moved 2026-10-02_ to list-views §9.6.

---

## 5. Shared Presentation and Responsive Behavior

- **5.1** _Moved 2026-10-02._ list-views §3–§5 define the shared controls. Number kept so older citations don't dangle.
- **5.2** Desktop and tablet use an accessible semantic table of two-line rows with a sticky header and pinned Machine identity column. The Machine column takes the remaining width on the left; the other columns are narrow and packed to the right. Selected columns remain available through horizontal scrolling rather than being silently hidden.
- **5.3** Phones default to a Compact list of one-line rows: a Playability dot, the machine name, its initials badge, and its open-issue count. Other selected fields appear in Table mode.
- **5.4** Phones offer an optional Table mode with a visible horizontal-overflow cue and pinned Machine identity. Compact/Table mode is stored as a browser preference and is not URL state.
- **5.5** Sortable headers are keyboard-operable and expose `scope` and `aria-sort`; the table has an accessible name and preserves native table semantics.
- **5.6** Open Issues values are right-aligned. A nonzero count is colored by the machine's worst open severity and links to that machine's issues (issues-list §7.4); zero remains neutral.
- **5.7** Last Serviced displays a compact relative age and links populated values to `/m/{initials}/maintenance`. A machine without qualifying service history displays “Never”.
- **5.8** Machine View exposes a stable machine-selection callback for a future inspection drawer without implementing drawer state or UI in this delivery.

---

## 6. Route Preservation

- **6.1** `/m` remains publicly viewable. Add Machine remains governed by `machines.create`.
- **6.2** `/m` preserves useful search coverage, existing empty-state intent, and machine navigation while replacing the machine-card grid.
- **6.3** Standard Collections preserve their header, tabs, edit and add-machine flows, share-token authorization, and exact membership scoping.
- **6.4** Owner Collections preserve their header, tabs, and exact owner scoping.
- **6.5** Issues and Timeline Collection tabs continue to use the resolved Collection machine identities and may not widen their scope through URL parameters.

---

## 7. Deferred Work

- **7.1** _Moved 2026-09-25._ Saved views are specified in §8. Number kept so older citations don't dangle.
- **7.2** _Moved 2026-09-26._ Summary Widgets are specified in `docs/feature-specs/widgets.md` and `docs/feature-specs/machine-widgets.md`. Number kept so older citations don't dangle.
- **7.3** The Integrations page, its Summary Widgets, Pinball Map and iScored fields, integration presets, and integration remediation are deferred.
- **7.4** Unmatched Pinball Map entries appear on the Pinball Map lineup page (`docs/feature-specs/pinballmap-lineup.md`), not as Machine View rows. Other external-only records are deferred.
- **7.5** Machine and issue inspection drawers are deferred.
- **7.6** _Moved 2026-10-02_ to list-views §10.17.

---

## 8. Saved Views

- **8.1–8.16** _Moved 2026-10-02_ to list-views §10, where Saved Views apply to every List Host. Numbers kept so older citations don't dangle.

---

## 9. Built-in Views

- **9.1** Machines offers five Built-in Views, in order: **On the floor** (On the Floor, by name — the Page Preset); **Needs attention** (On the Floor, Playability Needs service or Unplayable, worst first); **Service due** (On the Floor, oldest Last Serviced first); **All machines** (every presence state, by name); **Recently added** (every presence state except Removed, newest Date Added first, adding the Date Added field).
- **9.2** Collections offer three Built-in Views, in order: **On the floor** (On the Floor, worst playability first — the Page Preset); **Needs attention** (On the Floor, Playability Needs service or Unplayable, worst first); **All machines** (every presence state, worst playability first).
- **9.3** _Retired 2026-10-05._ Applying a Built-in View keeps the displayed fields and page size already showing (list-views §1). Number kept so older citations don't dangle.
- **9.4** _Moved 2026-10-02_ to list-views §10.16.
- **9.5** _Moved 2026-10-02_ to list-views §5.3 and §10.6.
- **9.6** Built-in Views that share a name appear in the same order on every Surface.

---

## Known divergences (code vs spec)

| Requirement | Divergence | Resolution |
| :---------- | :--------- | :--------- |

---

## Changelog

| Date | Change |
| :-- | :-- |
| 2026-10-05 | Built-in Views no longer set displayed fields or page size (§9.3). Tag and Collection Primary Filters (§3.12) and their `tag` and `collection` parameters (§4.1). |
| 2026-10-04 | Collections open to On the Floor members by default (§4.8), matching §9.2. |
| 2026-10-03 | Collections' Page Preset becomes On the floor (§9.2). |
| 2026-10-03 | Presence and Last Activity join the default fields, Presence after Playability (§4.6); All machines and Recently added no longer add Presence (§9.1). Desktop and tablet rows are two lines, with manufacturer, year, and owner under the name (§3.2, §5.2); Owner, Manufacturer, and Year leave the default fields (§4.6). |
| 2026-10-02 | Machine View became a List Host on the shared List View (§2.4): moved the generic concepts, URL rules, shared controls, and Saved Views to list-views (§1, §4.3–§4.5, §4.9–§4.11, §5.1, §7.6, §8, §9.4, §9.5); one-line machine identity and rows (§3.2, §5.2, §5.3); dropped Widget Population parameters (§4.1); Recently added leaves out Removed machines (§9.1); Primary Filters, Owner shortcuts, and the sort control (§3.12–§3.14); more default fields (§4.6); right-aligned Open Issues that link to the machine's issues in every presence state (§5.6); an Owner `me` sentinel (§4.2). |
| 2026-09-27 | §7.4: unmatched Pinball Map entries now appear on the Pinball Map lineup page rather than being deferred. |
| 2026-09-26 | Added the Open Issue Severity filter (§3.11) and Widget Population URL state (§4.1, §4.2, §4.4, §4.9); Saved Views store Widget Populations (§8.2); moved widgets to their own specs (§7.2); deferred Integrations widgets (§7.3). |
| 2026-09-26 | Added Built-in Views (§9): named, shared configurations per Surface that can be an account's default; anonymous visitors can apply them (§8.1, §8.9, §8.10, §8.13, §4.11). Renamed Default Saved View to Default View (§1, §8.11, §8.12, §8.14). |
| 2026-09-25 | Added Surfaces, Saved Views, and Default Saved Views (§8); URLs are canonical relative to the Page Preset (§4.10) and carry a `view` parameter naming their Saved View or the Page Preset (§4.1, §4.11); retired §7.1; deferred Saved View record sharing (§7.6). |
| 2026-09-24 | Made View Scope route-supplied; machine-group membership moved to the specs that own each group. |
| 2026-09-21 | Created. Establishes one machine-specific view for `/m` and Collections, conditional enrichment, bookmarkable URL state, shared responsive presentation, route-preservation requirements, and explicit deferred integrations/saved-view work. |
