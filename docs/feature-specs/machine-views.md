# Machine Views — Feature Spec

**Status: approved.**

**What this document is.** The requirements for PinPoint's shared machine-list experience on `/m` and Collections. It describes the intended final state only; what the code does or used to do lives solely in the Known divergences table. Each requirement is numbered for citation. When code and spec disagree, either the code is wrong or this document gets amended — never silently neither.

**Related records.** `docs/feature-specs/list-views.md` (the shared List View that Machine View is built on), `docs/feature-specs/collections-and-tags.md` (Collection and Tag membership and access), `docs/feature-specs/widgets.md` and `docs/feature-specs/machine-widgets.md` (the Summary Widgets on Machine View).

---

## 1. Concepts

- **Machine View** — the List Host (list-views §1) for machines, used by Machines and Collections. It owns the machine fields, filters, rows, conditional data enrichment, and the machine query pipeline.
- **View Scope, Page Preset, Surface, Saved View, Default View, Built-in View** — _Moved 2026-10-02_ to list-views §1, where they apply to every List Host.
- **Displayed Field** — _Retired 2026-11-15._ Machine rows show a fixed set of fields at every width (§5.13), so no field is selected for display; the row, active filters, sorting, and Summary Widgets determine which data enrichments Machine View loads (§3.4, §3.6, §3.7).
- **Bookmarkable View** — _Retired 2026-10-02._ list-views §9.1 now covers every List Host's URL state.
- **Display Mode** — _Retired 2026-11-15._ Machine rows are the same at every width (§5.3), so there is no Compact or Table presentation to choose.

---

## 2. Shared Module and Scoping

- **2.1** `/m` and every page that lists a group of machines use one domain-specific Machine View implementation rather than separate card, table, or query pipelines.
- **2.2** Machine View shows exactly the machines in the scope its route supplies; the feature that owns each machine group defines its membership. No scope may leak machines from outside its authoritative set.
- **2.3** Machines and Collections define separate Page Presets. A preset owns default filters, sorting, and permitted fields; route callers supply only scope, preset, and URL search parameters.
- **2.4** Machine View is a List Host: it uses List View for layout, search and filter controls, the List Header, pagination, URL state, and Saved Views, and keeps its own fields, filters, rows, and query pipeline. Future tags and locations may add Machine View scopes or presets without changing the machine row model.
- **2.5** Unmatched external integration entries are not Machine rows. Their representation remains deferred until the Integrations design and must not be introduced as a premature generic row union.

---

## 3. Fields and Conditional Data

- **3.1** The field catalog contains Machine, Playability, Open Issues, Last Serviced, Presence, Owner, Manufacturer, Year, Oldest Open Issue, Last Activity, and Date Added. Each field declares its sorting behavior and data dependencies. Fields serve sorting, filtering, and Export; a machine row shows only the fields §5.13 names.
- **3.2** Machine identity is always loaded. Every machine row puts the machine name and its uppercase initials badge on its first line and the manufacturer, year, and owner on its second (§5.3, §5.9).
- **3.3** Missing owner, manufacturer, or year values display as “Unassigned” or “Unknown” as appropriate. Machine View never exposes owner email addresses.
- **3.4** Health enrichment is always loaded, since every machine row shows Playability and the open-issue count (§5.13). It consists of grouped open-issue count, cosmetic/minor/major/unplayable counts, worst open severity, and oldest open issue. Closed issues never contribute.
- **3.5** Playability is derived once on the server from compact issue aggregates; Machine View does not hydrate issue children.
- **3.6** Service enrichment is always loaded, since every machine row shows the Last Serviced age (§5.13). Last Serviced is the deterministic latest non-deleted timeline event tagged `maintenance`, `adjustment`, `parts`, `upgrade`, `cleaning`, or `inspection`.
- **3.7** Activity enrichment is loaded only when the list is sorted by Last Activity or exported.
- **3.8** Search matches machine title, initials, manufacturer, canonical catalog title, and the legacy model-name fallback.
- **3.9** Filtering, deterministic sorting, and pagination occur in the server-only pipeline. The browser receives only the current page, filtered total count, Summary Widget counts, validated view state, permitted fields, and required filter options.
- **3.10** Initial delivery adds no database index. Query plans are benchmarked with realistic 100- and 500-machine fixtures and `EXPLAIN` evidence before proposing a partial open-issue or latest-service index.
- **3.11** The Open Issue Severity filter matches a machine that has at least one open issue of any selected severity.
- **3.12** The Primary Filters, in order, are Presence, Playability, Issue severity, Owner, Tag, and Collection. Machine View has no Secondary Filters. Tag and Collection follow collections-and-tags §12.
- **3.13** Owner searches people by name and offers Me (signed-in people only) and Unassigned shortcuts.
- **3.14** Every sortable field is offered in the List Header's sort control, the only place a person sorts the list.
- **3.15** Export downloads a CSV of every machine matching the current View Configuration across all pages, within the Surface's scope, in the list's sort order.
- **3.16** The CSV has these columns, in order: initials, name, full model, manufacturer, year, owner, Date Added, Presence, Playability, Open Issues, Last Serviced, and Last Activity. Name is the machine's title. Full model is the machine's catalog title, which names its edition. Dates are the site's calendar day. A missing value is left empty, and an unassigned owner is left empty.
- **3.17** Export is offered to signed-in people only.

---

## 4. URL State and Presets

- **4.1** Canonical Machine View URL state uses `q`, `presence`, `status`, `severity`, `owner`, `tag`, `collection`, `sort`, `dir`, `page`, `pageSize`, and `view`. A `columns` parameter in an older URL is ignored, and the URL is rewritten without it (list-views §9.4).
- **4.2** Multi-values serialize as comma-separated canonical values. Owner filters use stable IDs plus the `me` and `unassigned` sentinels; `me` means whoever is viewing. Page sizes are limited to 25, 50, and 100. Severity filters use `cosmetic`, `minor`, `major`, and `unplayable`.
- **4.3** _Moved 2026-10-02_ to list-views §9.3.
- **4.4** _Moved 2026-10-02_ to list-views §4.7 and §4.8.
- **4.5** _Moved 2026-10-02_ to list-views §9.8.
- **4.6** _Retired 2026-11-15._ Default displayed fields went with the choice of columns; machine rows show a fixed set of fields (§5.13). Number kept so older citations don't dangle.
- **4.7** `/m` defaults to Presence “On the Floor” and machine-title ascending. An omitted `presence` parameter means On the Floor; `presence=all` is the explicit unfiltered state.
- **4.8** Collections open to On the Floor members by default, sorted worst playability first; All machines shows every presence state (§9.2).
- **4.9** _Moved 2026-10-02_ to list-views §9.1.
- **4.10** _Moved 2026-10-02_ to list-views §9.5.
- **4.11** _Moved 2026-10-02_ to list-views §9.6.

---

## 5. Shared Presentation and Responsive Behavior

- **5.1** _Moved 2026-10-02._ list-views §3–§5 define the shared controls. Number kept so older citations don't dangle.
- **5.2** _Retired 2026-11-15._ Desktop and tablet used a table; every width now uses the machine rows of §5.3 and §5.9. Number kept so older citations don't dangle.
- **5.3** Machine View lists machines as two-line rows, the same at every screen size, on `/m` and on every Collection and Tag Machines tab. The first line holds a Playability dot, the machine name, its initials badge, and, at the right, the open-issue count. The count is text (“N open”) in the color of the machine's worst open severity with no icon before it, and its accessible name includes that severity; a machine with no open issues shows a muted “None open”.
- **5.4** _Retired 2026-11-15._ Phones offered a Table mode; with no table (§5.2) there is nothing to switch to. Number kept so older citations don't dangle.
- **5.5** _Retired 2026-11-15._ Sortable column headers went with the table (§5.2); sorting is in the List Header's sort control (§3.14). Number kept so older citations don't dangle.
- **5.6** A nonzero open-issue count is colored by the machine's worst open severity and links to that machine's issues (issues-list §7.4); zero remains neutral.
- **5.7** Last Serviced displays a compact relative age as plain text that does not link (§5.12). A machine without qualifying service history displays “never” (§5.9).
- **5.8** Machine View exposes a stable machine-selection callback for a future inspection drawer without implementing drawer state or UI in this delivery.
- **5.9** A machine row's second line starts under the machine name, past the Playability dot, as issue rows do (issues-list 3.1), runs to the row's right edge, and never wraps: the Playability label in its Playability color, then manufacturer, year, and the owner as an initials avatar (an empty dashed circle when the machine has no owner), with the Last Serviced age at the right end of the line as a wrench icon and a short age such as “2h ago”. A machine with no qualifying service history shows the wrench icon and “never” in place of the age (§5.7). A separator dot appears only between two plain-text items, so none sits before the owner avatar.
- **5.10** When a machine row's second line does not fit, it drops year, then manufacturer, then Last Serviced, then owner. The Playability label never drops.
- **5.11** A machine row's Playability dot differs by shape as well as color for each Playability.
- **5.12** At every width the whole machine row is a link to the machine. The open-issue count keeps its own link to the machine's issues (5.6), and the Last Serviced age is plain text.
- **5.13** A machine row's fields are fixed: the Playability dot and label, name, initials, open-issue count, manufacturer, year, owner avatar, and Last Serviced age. No other field appears on the row, and Machine View has no columns, column headers, or choice of displayed fields; View options holds page size only (list-views §5.6).
- **5.14** Machine rows and issue rows share one row structure (list-views §6.4): a leading dot column, then line 1, then line 2 starting past the dot, with a left group and a group anchored to the right end of the line. On a machine row the left group is the Playability label, manufacturer, year, and owner avatar, and the right group is the Last Serviced age.
- **5.15** While the list is sorted by Date Added, the right end of a machine row's second line shows how long ago the machine was added (for example “added 3d ago”) in place of the Last Serviced age, so the order is visible.

---

## 6. Route Preservation

- **6.1** `/m` remains publicly viewable. Add Machine remains governed by `machines.create`.
- **6.2** `/m` preserves useful search coverage, existing empty-state intent, and machine navigation while replacing the machine-card grid.
- **6.3** Standard Collections preserve their header, tabs, edit and add-machine flows, share-token authorization, and exact membership scoping.
- **6.4** _Retired 2026-10-07._ Owner Collections were replaced by the Owner filter (collections-and-tags §6.4). Number kept so older citations don't dangle.
- **6.5** Issues and Timeline Collection tabs continue to use the resolved Collection machine identities and may not widen their scope through URL parameters.
- **6.6** `/m`'s page actions are, in order, Pinball Map, Add Machine, and ⋯ (list-views §3.7). Pinball Map appears only to people who can open the Pinball Map lineup page (pinballmap-lineup §2.2), and Add Machine only to people 6.1 allows.
- **6.7** `/m`'s ⋯ holds Export (§3.15), Print settings sheets (settings-sheets §2.1) and, for people who can print apron cards, Print apron cards (apron-cards §12.1), at every width; the print-queue count shows only on that entry (apron-cards §13.4).
- **6.8** On `/m`, Pinball Map folds into ⋯ first and Add Machine last (list-views §3.9).

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

- **9.1** Machines offers five Built-in Views, in order: **On the floor** (On the Floor, by name — the Page Preset); **Needs attention** (On the Floor, Playability Needs service or Unplayable, worst first); **Service due** (On the Floor, oldest Last Serviced first); **All machines** (every presence state, by name); **Recently added** (every presence state except Removed, newest Date Added first).
- **9.2** Collections offer three Built-in Views, in order: **On the floor** (On the Floor, worst playability first — the Page Preset); **Needs attention** (On the Floor, Playability Needs service or Unplayable, worst first); **All machines** (every presence state, worst playability first).
- **9.3** _Retired 2026-10-05._ Applying a Built-in View keeps the displayed fields and page size already showing (list-views §1). Number kept so older citations don't dangle.
- **9.4** _Moved 2026-10-02_ to list-views §10.16.
- **9.5** _Moved 2026-10-02_ to list-views §5.3 and §10.6.
- **9.6** Built-in Views that share a name appear in the same order on every Surface.

---

## Known divergences (code vs spec)

| Requirement | Divergence | Resolution |
| :-- | :-- | :-- |
| §6.6–§6.8 | `/m` shows Pinball Map, a Print menu, and a filled Add Machine as separate buttons with no ⋯; nothing folds. | PP-jb9v.17 |

---

## Changelog

| Date | Change |
| :-- | :-- |
| 2026-11-15 | While sorted by Date Added, a machine row shows its added age in place of the Last Serviced age (§5.15). |
| 2026-11-15 | Machine View drops its table at every width: one two-line machine row on `/m` and every Collection and Tag Machines tab (§5.3), with fixed fields (§5.13) on the row structure issue rows share (§5.14); retired the desktop table, phone Table mode, and column headers (§5.2, §5.4, §5.5), the Display Mode and Displayed Field concepts (§1), and default fields (§4.6); presets set no fields (§2.3); sorting only in the sort control (§3.14); `columns` leaves the URL and old URLs ignore it (§4.1); the whole row links at every width and Last Serviced never links (§5.7, §5.12); Compact qualifiers dropped (§3.2, §5.9–§5.11); health and service data always load, activity only for its sort or Export (§3.1, §3.4, §3.6, §3.7, §3.16); Recently added no longer adds Date Added (§9.1). |
| 2026-11-15 | A Compact row's second line starts under the machine name, past the Playability dot, and has no separator dot before the owner avatar (§5.9). |
| 2026-10-13 | `/m`'s ⋯ holds Export (§6.7). |
| 2026-10-13 | Export: a CSV of every machine the list matches, with initials, name, full model, manufacturer, year, owner, and the list's Date Added, Presence, Playability, Open Issues, Last Serviced, and Last Activity, for signed-in people (§3.15–§3.17). |
| 2026-10-12 | Compact rows show the owner as an initials avatar and the Last Serviced age at the right end of line 2 as a wrench icon and “2h ago” (§5.9); Last Serviced links only in the table (§5.7); the whole Compact row links to the machine and its Last Serviced age is plain text (§5.12). |
| 2026-10-11 | `/m`'s page actions are Pinball Map, Add Machine, and ⋯, which holds the Print settings sheets and Print apron cards entries; Pinball Map folds first and Add Machine last (§6.6–§6.8). |
| 2026-10-11 | Phone Compact rows become two lines: Playability dot, name, initials, and open-issue count first, then the Playability label, manufacturer, year, owner, and Last Serviced, dropping year, manufacturer, Last Serviced, then owner when crowded (§3.2, §5.3, §5.9, §5.10); the Playability label and Last Serviced age appear only when those fields are displayed, and no service history reads “never serviced” (§5.9); the count is colored “N open” text with no icon, or a muted “None open” (§5.3); the Playability dot differs by shape (§5.11). |
| 2026-10-07 | Retired Owner Collections (preamble, 6.4); a person's machines are Machines filtered by Owner (collections-and-tags §6). |
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
