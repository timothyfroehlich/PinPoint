# List Views — Feature Spec

**Status: draft.**

**What this document is.** The requirements every PinPoint List View shares: the Machines list, the Issues list, and the Collection and Tag tabs that show them. Each List Host's own spec adds its fields, filters, rows, and Built-in Views. It describes the intended final state only; what the code does or used to do lives solely in the Known divergences table. Each requirement is numbered for citation. When code and spec disagree, either the code is wrong or this document gets amended — never silently neither.

**Related records.** `docs/feature-specs/machine-views.md` and `docs/feature-specs/issues-list.md` (the two List Hosts), `docs/feature-specs/widgets.md` (Summary Widgets on a List Host), `pinpoint-design-bible` §5 (List Page archetype). Epic PP-jb9v.

---

## 1. Concepts

- **List View** — the one shared list framework: page layout, search, filters, list header, rows, pagination, URL state, and Saved Views. It knows nothing about machines or issues.
- **List Host** — a list built on List View. Machine View (machine-views) and Issue View (issues-list) are the List Hosts. A host defines its fields, filters, sorts, row presentation, Page Presets, and Built-in Views.
- **View Scope** — the authoritative set of records a route may show, supplied by that route. Filtering can narrow a scope but never widen it.
- **Page Preset** — a route-owned configuration defining a host's default filters, displayed fields, sorting, and page size.
- **Surface** — a place where a List View appears: Machines, Issues, or one tab of one individual Collection or Tag. Every Collection or Tag tab is its own Surface.
- **View Configuration** — the displayed fields, search, filters, sorting, and page size a List View shows. Page number is not part of it.
- **Saved View** — a named, personal View Configuration owned by one account and belonging to one List Host. It can be applied on every Surface of that host.
- **Built-in View** — a named View Configuration PinPoint defines for a Surface, the same for every viewer. One Built-in View on each Surface is its Page Preset.
- **Default View** — the one Saved View or Built-in View an account marks to open on its host's main page (Machines or Issues) when the URL carries no view configuration.
- **Applied View** — the Saved View or Built-in View the current View Configuration came from.
- **Edited** — the state of a List View whose current View Configuration differs from its Applied View.
- **Primary Filter** — a filter a host shows inline beside search. **Secondary Filter** — a filter a host shows only under More.
- **List Header** — the bar at the top of the list box holding the Saved View controls, sort, compact pager, export, and View options.

---

## 2. Hosts and Scope

- **2.1** Machines, Issues, and every Collection and Tag tab that lists machines or issues use List View rather than separate toolbars, pagers, or URL handling.
- **2.2** A List View shows exactly the records in the scope its route supplies; the feature that owns each group defines its membership. No URL parameter can widen a scope.
- **2.3** Each host keeps its own query pipeline; List View defines behavior, not where filtering runs. Filtering, sorting, and pagination are server-side, and the browser receives only the current page, the filtered total, Summary Widget counts, validated view state, and the filter options it needs.
- **2.4** Row density is a host decision: a host may use one-line or two-line rows, the same at every screen size.

---

## 3. Page Layout

- **3.1** From top to bottom a List View page shows: the page title row, the Summary Widgets, search with the Primary Filters, then one list box holding the List Header and the rows, then the pager.
- **3.2** The page title row holds the title and the host's page actions. The result count is never repeated beside the title.
- **3.3** Active filters are never repeated as a separate chip row; each filter control shows its own current value.
- **3.4** At 1440×900 the first rows of the list are visible without scrolling, with the Summary Widgets open.
- **3.5** While a new result is loading the rows dim and the list is marked busy; the controls stay usable.
- **3.6** A View Configuration that matches nothing shows an empty state; when the List View is Edited, its action returns to the Applied View.

---

## 4. Search and Filters

- **4.1** Search runs 250 ms after typing stops, or immediately on Enter.
- **4.2** The search field names what it searches in its placeholder or a hint.
- **4.3** Each Primary Filter is a dropdown button labeled with the filter's name; when set, it shows its value (one value) or a count of values (several).
- **4.4** A filter whose options are long lists of records (machines, people) has a search box that narrows its options as the person types, plus the shortcuts its host names.
- **4.5** More holds every Secondary Filter, and any Primary Filter that does not fit (§8.1).
- **4.6** Filter values the Page Preset sets by default are shown on their control like any other value.
- **4.7** Changing search, a filter, sorting, or page size returns to page 1.
- **4.8** Changing displayed fields keeps the current page when that page remains valid.
- **4.9** Every filter's options offer Reset, which returns that filter to its Page Preset value, at every width.

---

## 5. List Header

- **5.1** On desktop the List Header shows the Surface's Built-in Views as tabs, then More views holding the account's Saved Views and any Built-in View that does not fit. The Applied View is marked current; a Saved View that is applied shows as a tab while it is applied.
- **5.2** When the List View is Edited, the current tab shows Edited, and the List Header offers Save and Discard changes.
- **5.3** Save offers Save changes when the Applied View is the account's own Saved View, and always offers Save as new. A Built-in View can only be saved as new.
- **5.4** Discard changes returns to the Applied View's configuration at page 1.
- **5.5** The List Header shows the sort control, a compact pager (range, previous, next), Export when the host offers it, and View options.
- **5.6** View options holds page size and, for hosts with columns, the displayed fields.
- **5.7** Page sizes are 25, 50, and 100; 25 is the default everywhere.

---

## 6. Rows and Pagination

- **6.1** On desktop the pager sits below the list box, with Previous, page numbers, and Next.
- **6.2** The compact pager in the List Header and the pager below the list always show the same page.
- **6.3** Pages are numbered from 1; a page past the end shows the last page.

---

## 7. Phones

- **7.1** Below the md breakpoint a List View uses the phone layout: title row, Summary Widgets, search on its own row, then the list box.
- **7.2** The title row holds the title, the Summary Row toggle (widgets §2.5), and the host's page actions; actions that do not fit become icon buttons with accessible names. On a Collection or Tag tab, whose title row belongs to the Collection or Tag page, the Summary Row toggle sits on its own row between the page's tabs and the search field.
- **7.3** The phone List Header holds the Applied View's name as a button that opens the Saved Views sheet, and a Filters icon button showing a count of filters not at their Page Preset value.
- **7.4** When the List View is Edited, the Applied View's name carries a marker that is announced as "edited".
- **7.5** The Filters button opens one sheet holding Sort, the Primary Filters, the Secondary Filters under More filters, and Display (page size). Selecting a filter opens its options inside the sheet; the sheet's footer offers Reset all, which returns every filter to the Page Preset's values and keeps search, sort, and page size, and a button that shows the result count and closes the sheet.
- **7.6** The Saved Views sheet offers, when Edited, Save changes (own Saved View only), Save as new, and Discard changes; then the Built-in Views, then the account's Saved Views, then Manage views.
- **7.7** The list box runs edge to edge with no card border; rows align with the page's horizontal padding.
- **7.8** The pager is a 44px bar pinned above the tab bar, with Previous, the range ("1–25 of 84"), and Next. The list leaves room so its last row can scroll clear of the pager.
- **7.9** Every phone control is at least 44px tall or wide.

---

## 8. Between Phone and Desktop

- **8.1** When the Primary Filters do not fit beside search, they move into More from the right, one at a time, in the host's order.
- **8.2** When the List Header's tabs do not fit, Saved View tabs move into More views from the right; the Applied View's tab always stays visible.
- **8.3** When the List Header is still crowded, the compact pager drops its range text, then disappears; then Discard changes shortens to Discard, and then the Applied View's tab name truncates. The pager below the list remains, and shows the result range even when there is only one page.
- **8.4** When the Summary Widgets do not fit side by side, they stack full-width in a collapsible section (widgets §2.4).
- **8.5** No List View width between 320px and 1440px scrolls the page horizontally.

---

## 9. URL State

- **9.1** The URL encodes the whole View Configuration plus page, so reopening or copying it shows the same list.
- **9.2** Parameter names are camelCase; multi-values are comma-separated canonical values; sorting is `sort` plus `dir`.
- **9.3** Invalid values are ignored, pages past the end are clamped, and Page Preset defaults are omitted.
- **9.4** A URL that uses a host's older parameter names opens correctly and is rewritten to the canonical form.
- **9.5** Canonical URLs are always expressed relative to the Page Preset, never relative to a viewer's Saved Views, so the same URL shows every viewer the same list.
- **9.6** `view` names the Applied View. It never changes the configuration a URL shows, and a viewer who does not own the named Saved View ignores it.
- **9.7** List View updates the URL in place without adding a history entry for each keystroke or filter change, and without scrolling the page.
- **9.8** Sort headers, where a host has them, cycle the field's preferred direction, its opposite, and then the Page Preset's default sort.

---

## 10. Saved Views

- **10.1** Any signed-in account can save the current View Configuration as a named Saved View from any Surface of a List Host. Anonymous visitors have no Saved Views but can apply Built-in Views.
- **10.2** A Saved View stores the View Configuration. It never stores a page number or Summary Row open state.
- **10.3** Saved Views are personal: only the owning account can see, apply, change, or delete them.
- **10.4** Saved Views sync across every device the owning account uses.
- **10.5** A Saved View appears on every Surface of its List Host: a machine Saved View on Machines and every Collection and Tag Machines tab, an issue Saved View on Issues and every Issues tab.
- **10.6** Applying a Saved View or Built-in View opens it at page 1.
- **10.7** A Saved View name is required and must be unique, ignoring case, among the account's Saved Views for that List Host. A colliding name is rejected, never silently overwritten.
- **10.8** Manage views lets the account rename or delete its Saved Views. On the Machines and Issues pages it also lets the account set or clear its Default View.
- **10.9** An account has at most one Default View per List Host.
- **10.10** The Machines or Issues page, opened with no view configuration other than page, shows the account's Default View if one exists, otherwise the Page Preset. A Collection or Tag tab opened that way always shows its Page Preset. A URL carrying any view configuration opens exactly as written. On the Machines or Issues page, when an account whose Default View is not the Page Preset's Built-in View shows the Page Preset's settings, the URL names that Built-in View, so reopening it does not show the Default View.
- **10.11** When the Default View opens, the address bar shows its canonical URL.
- **10.12** Every Built-in View is always reachable, as a List Header tab or in More views, so an account with a default can still reach the Page Preset.
- **10.13** Deleting the Default View leaves its host without a default; the main page then opens to the Page Preset.
- **10.14** A stored field, filter value, or person that no longer exists or is not permitted on the Surface is dropped when the view is applied, exactly as an invalid URL value is (§9.3).
- **10.15** _Retired 2026-10-02._ Saved Views belong to a List Host, not a Surface, so deleting a Collection or Tag deletes none. Number kept so older citations don't dangle.
- **10.16** Built-in Views are the same for every viewer and cannot be renamed, changed, or deleted.
- **10.17** Sharing Saved View records with other accounts is deferred; copied URLs are the sharing mechanism.
- **10.18** Applying a Saved View on a Collection or Tag tab applies its configuration inside that tab's scope. A filter value outside the scope matches nothing there and never widens it.

---

## 11. Returning to a List

- **11.1** Within one browser tab session, returning to a List Host through the app navigation reopens the last View Configuration and page used there.
- **11.2** A new browser session opens the list as §10.10 describes.

---

## 12. Accessibility

- **12.1** Filter dropdowns, More, More views, Save, and View options are keyboard-operable; opening one moves focus into it, and closing it returns focus to its button.
- **12.2** Phone sheets trap focus while open, close on Escape, and return focus to the control that opened them.
- **12.3** The Saved View tabs are a navigation landmark named "Saved views", and the current tab is exposed as current.
- **12.4** The result count is announced politely after the results change.
- **12.5** Pinned bars never cover the focused element; the page scroll padding accounts for them.
- **12.6** Pinned phone bars respect the device safe area.

---

## Known divergences (code vs spec)

| Requirement | Divergence | Resolution |
| :-- | :-- | :-- |
| §2.1 | Issues and Collection Issues tabs use their own toolbar, pager, and URL handling. | PP-jb9v |
| §3–§8, §12 | Issues and Collection Issues tabs don't use the shared layout, List Header, phone sheets, or overflow rules. | PP-jb9v |
| §5.7 | Issues offers 15, 25, and 50 per page, defaulting to 15. | PP-jb9v |
| §9.2, §9.4 | Issues uses snake_case parameters and a composite sort value. | PP-jb9v |
| §10 | Issues has no Saved Views. | PP-jb9v |
| §11 | Issues restores the last URL from a cookie across sessions. | PP-jb9v |

---

## Changelog

| Date | Change |
| :-- | :-- |
| 2026-10-04 | Reset all returns filters to the Page Preset (§7.5); Built-in Views stay reachable as tabs or in More views (§10.12); the List Header's crowding order and the single-page result range (§8.3); per-filter Reset (§4.9); a Page Preset URL names its Built-in View when a Default View exists (§10.10); empty-state action only when Edited (§3.6). |
| 2026-10-03 | On a Collection or Tag tab the Summary Row toggle sits on its own row between the page's tabs and search (§7.2). |
| 2026-10-03 | Stacked Summary Widgets sit in a collapsible section (§8.4). |
| 2026-10-02 | Default View controls appear only on the Machines and Issues pages (§10.8). |
| 2026-10-02 | Created from the approved list-framework design: shared layout, filters, List Header with Saved View tabs, compact and bottom pagers, phone sheets and pinned pager, overflow rules, URL state, Saved Views shared across each host's Surfaces with a Default View on the main page only (moved from machine-views §8), returning to a list, and accessibility. |
