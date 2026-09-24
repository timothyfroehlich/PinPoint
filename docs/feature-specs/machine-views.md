# Machine Views — Feature Spec

**Status: approved.**

**What this document is.** The requirements for PinPoint's shared machine-list experience on `/m`, standard Collections, and owner Collections. It describes the intended final state only; what the code does or used to do lives solely in the Known divergences table. Each requirement is numbered for citation. When code and spec disagree, either the code is wrong or this document gets amended — never silently neither.

**Related records.** `docs/feature-specs/fleet.md` (the existing Fleet and Pinball Map dashboard requirements; unchanged by this spec).

---

## 1. Concepts

- **Machine View** — the shared, machine-specific listing module used by Machines and Collections. It owns validated view state, conditional data enrichment, filtering, sorting, pagination, and responsive presentation.
- **View Scope** — the authoritative set of machines a route may show: all machines, one standard Collection's exact membership, or one owner's exact machine set. Filtering can narrow a scope but never widen it.
- **Page Preset** — a route-owned configuration defining default filters, displayed fields, sorting, and permitted fields without allowing the route to assemble query dependencies itself.
- **Displayed Field** — a Machine View field selected for display. Displayed fields, active filters, sorting, and search determine which optional data enrichments Machine View loads.
- **Bookmarkable View** — the complete displayed-field, filter, sort, and pagination state encoded in the URL so reopening or copying it restores the same view.
- **Display Mode** — the phone-only Compact list or Table presentation. Display Mode is a browser preference rather than bookmarkable URL state.

---

## 2. Shared Module and Scoping

- **2.1** `/m`, standard Collection overviews, and owner Collection overviews use one domain-specific Machine View implementation rather than separate card, table, or query pipelines.
- **2.2** Machine View supports all-machines, standard-collection, and owner scopes. Standard Collections use exact membership rows; owner Collections use exact owner identity. No scope may leak machines from outside its authoritative set.
- **2.3** Machines and Collections define separate Page Presets. A preset owns default filters, displayed fields, sorting, and permitted fields; route callers supply only scope, preset, and URL search parameters.
- **2.4** The module remains machine-specific rather than becoming a generic grid. Future tags and locations may add Machine View scopes or presets without changing the machine row model.
- **2.5** Unmatched external integration entries are not Machine rows. Their representation remains deferred until the Integrations design and must not be introduced as a premature generic row union.

---

## 3. Fields and Conditional Data

- **3.1** The field catalog contains Machine, Playability, Open Issues, Last Serviced, Presence, Owner, Manufacturer, Year, Oldest Open Issue, Last Activity, and Date Added. Each field declares its sorting behavior, data dependencies, and table and compact presentations.
- **3.2** Machine identity is always loaded and displayed as exactly two lines: Line 1 is the machine title link plus uppercase initials badge; Line 2 is `[Manufacturer] · [Year] · [Owner]`.
- **3.3** Missing owner, manufacturer, or year values display as “Unassigned” or “Unknown” as appropriate. Machine View never exposes owner email addresses.
- **3.4** Health enrichment is loaded only when required by displayed fields, active filters, or sorting. It consists of grouped open-issue count, cosmetic/minor/major/unplayable counts, worst open severity, and oldest open issue. Closed issues never contribute.
- **3.5** Playability is derived once on the server from compact issue aggregates; Machine View does not hydrate issue children.
- **3.6** Service enrichment is loaded only when required by displayed fields or sorting. Last Serviced is the deterministic latest non-deleted timeline event tagged `maintenance`, `adjustment`, `parts`, `upgrade`, `cleaning`, or `inspection`.
- **3.7** Activity enrichment is loaded only when Last Activity is displayed or sorted.
- **3.8** Search matches machine title, initials, manufacturer, canonical catalog title, and the legacy model-name fallback.
- **3.9** Filtering, deterministic sorting, and pagination occur in the server-only pipeline. The browser receives only the current page, filtered total count, validated view state, permitted fields, and required filter options.
- **3.10** Initial delivery adds no database index. Query plans are benchmarked with realistic 100- and 500-machine fixtures and `EXPLAIN` evidence before proposing a partial open-issue or latest-service index.

---

## 4. URL State and Presets

- **4.1** Canonical Machine View URL state uses `q`, `presence`, `status`, `owner`, `sort`, `dir`, `page`, `pageSize`, and `columns`.
- **4.2** Multi-values serialize as comma-separated canonical values. Owner filters use stable IDs plus the `unassigned` sentinel. Page sizes are limited to 25, 50, and 100.
- **4.3** Invalid values are ignored, positive pages are clamped, and preset defaults are omitted from the URL.
- **4.4** Search, filter, sort, and page-size changes reset to page 1. Displayed-field changes retain the current page when that page remains valid.
- **4.5** Sort headers cycle the field's preferred direction, its opposite direction, and then the Page Preset's default sort.
- **4.6** Both initial Page Presets display Machine, Playability, Open Issues, and Last Serviced by default.
- **4.7** `/m` defaults to Presence “On the Floor” and machine-title ascending. An omitted `presence` parameter means On the Floor; `presence=all` is the explicit unfiltered state.
- **4.8** Collections include every member presence state by default and sort worst playability first.
- **4.9** Reopening or copying a canonical URL restores displayed fields, search, filters, sorting, page size, and page.

---

## 5. Shared Presentation and Responsive Behavior

- **5.1** Machine View provides shared search, multi-select filters, active chips, clear-all, result count, pagination, and View Options controls.
- **5.2** Desktop and tablet use an accessible semantic table with a sticky header and pinned Machine identity column. Selected columns remain available through horizontal scrolling rather than being silently hidden.
- **5.3** Phones default to a Compact list that reflows every selected field beneath Machine identity.
- **5.4** Phones offer an optional Table mode with a visible horizontal-overflow cue and pinned Machine identity. Compact/Table mode is stored as a browser preference and is not URL state.
- **5.5** Sortable headers are keyboard-operable and expose `scope` and `aria-sort`; the table has an accessible name and preserves native table semantics.
- **5.6** Open Issues values are centered. A nonzero count is colored by the machine's worst open severity and links to `/issues?machine={initials}`; zero remains neutral.
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

- **7.1** Named personal saved views, per-surface default saved views, and copied-link sharing semantics are deferred.
- **7.2** Widgets and dashboard gauge relocation are deferred.
- **7.3** The Integrations page, Pinball Map and iScored fields, integration presets, and integration remediation are deferred.
- **7.4** Unmatched Pinball Map entries and other external-only records are deferred.
- **7.5** Machine and issue inspection drawers are deferred.

---

## Known divergences (code vs spec)

_None currently recorded._

---

## Changelog

| Date | Change |
| :-- | :-- |
| 2026-09-21 | Created. Establishes one machine-specific view for `/m` and Collections, conditional enrichment, bookmarkable URL state, shared responsive presentation, route-preservation requirements, and explicit deferred integrations/saved-view work. |
