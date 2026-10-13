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
- **Built-in View** — a named set of filters and sorting PinPoint defines for a Surface, the same for every viewer, with an empty search. Applying one keeps the displayed fields and page size already showing, adding any field its host names for it. One Built-in View on each Surface has its Page Preset's filters and sorting.
- **Default View** — the one Saved View or Built-in View an account marks to open on its host's main page (Machines or Issues) when the URL carries no view configuration.
- **Applied View** — the account's Saved View the current View Configuration came from, or else the Built-in View whose search, filters, and sorting it has. A List View that has left every Built-in View this way has no Applied View.
- **Edited** — the state of a List View whose Applied View is one of the account's Saved Views and whose current View Configuration differs from it.
- **Primary Filter** — a filter a host shows inline beside search. **Secondary Filter** — a filter a host shows only under More filters.
- **List Header** — the bar at the top of the list box. On desktop it holds the view tabs and Saved View controls, sort, compact pager, and View options; on phones it holds the view menu, search, and Filters (§7.3).
- **Collapse Order** — the ordered steps by which one List View page design fits narrower screens (§8).
- **Page actions** — the buttons a page shows for actions on the whole page rather than on one row, ending with ⋯, a menu holding the page's other actions.

---

## 2. Hosts and Scope

- **2.1** Machines, Issues, and every Collection and Tag tab that lists machines or issues use List View rather than separate toolbars, pagers, or URL handling.
- **2.2** A List View shows exactly the records in the scope its route supplies; the feature that owns each group defines its membership. No URL parameter can widen a scope.
- **2.3** Each host keeps its own query pipeline; List View defines behavior, not where filtering runs. Filtering, sorting, and pagination are server-side, and the browser receives only the current page, the filtered total, Summary Widget counts, validated view state, and the filter options it needs.
- **2.4** Row density is a host decision: a host may use one-line or two-line rows, the same at every screen size.

---

## 3. Page Layout

- **3.1** From top to bottom a List View page shows: the page title row, the Summary Widgets, search with the Primary Filters, then one list box holding the List Header and the rows, then the pager.
- **3.2** The page title row holds the title and the host's page actions (§3.7). The result count is never repeated beside the title.
- **3.3** Active filters are never repeated as a separate chip row; each filter control shows its own current value.
- **3.4** At 1440×900 the first rows of the list are visible without scrolling, below the Summary Widgets.
- **3.5** While a new result is loading the rows dim and the list is marked busy; the controls stay usable.
- **3.6** A View Configuration that matches nothing shows an empty state. When the List View is Edited, its action returns to the Applied View; when it has no Applied View, its action opens the Page Preset.
- **3.7** A page shows at most three page actions, in the order its own spec names them. ⋯ is always last, and holds every action the page offers that is not shown as its own button. A page with nothing for ⋯ to hold shows no ⋯.
- **3.8** Page actions are outlined buttons; the one exception is Machines' Add Machine, which keeps its filled primary style. While every shown action fits the row the actions sit in with its label, each shows its label; otherwise each is an icon button that keeps its accessible name. There is no size between labeled and icon-only.
- **3.9** When the shown actions do not fit even as icons, the next step of the fold order its page's spec names moves that step's actions into ⋯, and the actions still shown try labels, then icons, again (§3.8). ⋯ never folds. An action that is itself a menu brings its items into ⋯ when it folds.
- **3.10** When the page actions show labels, ⋯ reads "Actions". On desktop ⋯ opens a menu; on phones it opens a sheet.

---

## 4. Search and Filters

- **4.1** Search runs 250 ms after typing stops, or immediately on Enter.
- **4.2** The search field shows no placeholder. Its accessible name says which list it searches.
- **4.3** Each Primary Filter is a dropdown button labeled with the filter's name; when set, it shows its value (one value) or a count of values (several).
- **4.4** A filter whose options are long lists of records (machines, people) has a search box that narrows its options as the person types, plus the shortcuts its host names.
- **4.5** More filters holds every Secondary Filter, and any Primary Filter that does not fit (§8.15).
- **4.6** Filter values the Page Preset sets by default are shown on their control like any other value.
- **4.7** Changing search, a filter, sorting, or page size returns to page 1.
- **4.8** Changing displayed fields keeps the current page when that page remains valid.
- **4.9** Every filter's options offer Reset, which returns that filter to its Page Preset value, at every width.
- **4.10** More filters shows a badge counting only the filters it holds whose value differs from the Page Preset; with none, it shows no badge.

---

## 5. List Header

- **5.1** On desktop the List Header shows the Surface's Built-in Views as tabs, then More views holding the account's Saved Views and any Built-in View that does not fit. The Applied View is marked current; a Saved View that is applied shows as a tab while it is applied.
- **5.2** When the List View is Edited, its Saved View's tab shows Edited, and the List Header offers Save and Discard changes. When it has no Applied View, the List Header offers Save view to signed-in accounts.
- **5.3** Save offers Save changes and Save as new. Save view saves the current View Configuration as a new Saved View.
- **5.4** Discard changes returns to the Applied View's configuration at page 1.
- **5.5** The List Header shows the sort control, a compact pager (range, previous, next), and View options. Export, when a host offers it, is a page action in ⋯ (§3.7), never in the List Header.
- **5.6** View options holds page size and, for hosts with columns, the displayed fields.
- **5.7** Page sizes are 25, 50, and 100; 25 is the default everywhere.
- **5.8** View tabs are quiet pills with the Applied View's pill filled, so they never read as a page's own tabs.

---

## 6. Rows and Pagination

- **6.1** On desktop the pager sits below the list box, with Previous, page numbers, and Next.
- **6.2** The compact pager in the List Header and the pager below the list always show the same page.
- **6.3** Pages are numbered from 1; a page past the end shows the last page.

---

## 7. Phones

- **7.1** Below the md breakpoint a List View uses the phone layout: title row, Summary Widgets, the list box, then the pager. Search has no row of its own; it sits in the phone List Header (§7.3).
- **7.2** The title row holds the title and the host's page actions, which drop their labels and fold into ⋯ as they stop fitting (§3.8, §3.9).
- **7.3** The phone List Header holds, in order, the Applied View's name, or "Views" when there is none, as a button that opens the Saved Views sheet; the search field; and a Filters icon button showing a count of filters not at their Page Preset value.
- **7.4** When the List View is Edited, the Applied View's name carries a marker that is announced as "edited".
- **7.5** The Filters button opens one sheet holding Sort, the Primary Filters, the Secondary Filters under More filters, and Display (page size). Selecting a filter opens its options inside the sheet; the sheet's footer offers Reset all, which returns every filter to the Page Preset's values and keeps search, sort, and page size, and a button that shows the result count and closes the sheet.
- **7.6** The Saved Views sheet offers, when Edited, Save changes, Save as new, and Discard changes, and when there is no Applied View, Save view; then the Built-in Views, then the account's Saved Views, then Manage views.
- **7.7** The list box runs edge to edge with no card border; rows align with the page's horizontal padding.
- **7.8** The pager is the last thing after the list box and scrolls with the page, with Previous, the range ("1–25 of 84"), and Next.
- **7.9** Every phone control is at least 44px tall or wide.
- **7.10** The phone List Header stays at the top of the screen, directly under the app header, while the title row and Summary Widgets scroll away and the rows scroll beneath it.
- **7.11** A List View follows design-bible §3: nothing full-width is pinned above the tab bar.

---

## 8. Collapse Order

- **8.1–8.3** _Retired 2026-10-11._ Folded into the Collapse Order: 8.1 is now 8.15, 8.2 is 8.16, and 8.3 is 8.17–8.19. Numbers kept so older citations don't dangle.
- **8.4** _Retired 2026-10-11._ Summary Widgets never stack or collapse, so there is no Summary Row toggle to place; whole widgets drop from the right instead (widgets §2.7). Number kept so older citations don't dangle.
- **8.5** _Retired 2026-10-11._ Now 8.24. Number kept so older citations don't dangle.
- **8.6** Every Surface uses one page design and fits narrower screens by applying the steps in 8.9–8.23. A step fires when the part of the page it changes runs out of room, or below the width it names.
- **8.7** Whether a part has room is measured on the width its container gives it, never the screen width, and every fit check keeps a small tolerance so a step fires slightly before its part would overflow.
- **8.8** Steps that change the same part fire in the order listed. A step that does not apply to a Surface, such as a breadcrumb on Machines, is skipped.
- **8.9** When a Collection or Tag page's breadcrumb, title, and description do not fit on one row, the breadcrumb moves from before the title to above it. This is the page header's first step.
- **8.10** When a Collection's description would be narrower than 280px beside the title, it moves under the title.
- **8.11** Page actions that do not fit beside the title, or at the end of a Collection or Tag page's tab row, lose their labels and become outlined icon buttons with accessible names; when those still do not fit, they fold into the Actions menu, which is always the last page action.
- **8.12** Page actions fold into the Actions menu from the first: on a Collection or Tag page Share and Print fold together, and on Machines Pinball Map folds before Add Machine. After each fold the buttons that remain show their labels again when they fit, and a lone Actions menu shows its label when it fits.
- **8.13** When a Collection or Tag page's tabs and a lone Actions menu still do not fit the tab row, page tabs move into a menu from the right; the current tab always stays.
- **8.14** Summary Widgets that do not fit side by side drop whole from the right (widgets §2.7).
- **8.15** When the Primary Filters do not fit beside search, they move into More filters from the right, one at a time, in the host's order.
- **8.16** When the List Header's view tabs do not fit, tabs move into More views from the right; the Applied View's tab always stays visible.
- **8.17** When only the Applied View's tab is left and the List Header is still crowded, the compact pager drops its range text, then disappears. The pager below the list remains, and shows the result range even when there is only one page.
- **8.18** Next, Discard changes shortens to Discard.
- **8.19** Last, the Applied View's tab name truncates.
- **8.20** A host table whose columns do not fit scrolls sideways inside the list box, with its identity column pinned (machine-views §5.2).
- **8.21** A row line that does not fit drops fields in the order its host defines: issue rows per issues-list §3.9, phone machine rows per machine-views §5.10.
- **8.22** Below the md breakpoint the phone layout of §7 applies: search moves into the List Header (§7.3), sort, filters, and page size move into the Filters sheet (§7.5), the pager follows the list (§7.8), and the List Header sticks to the top while the page header scrolls away (§7.10).
- **8.23** Below 390px wide, a Collection or Tag page's header tightens the space above its title and below its tabs from 12px to 4px.
- **8.24** No List View width between 320px and 1440px scrolls the page horizontally.

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
- **10.2** A Saved View stores the View Configuration. It never stores a page number.
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

- **12.1** Filter dropdowns, More filters, More views, Save, and View options are keyboard-operable; opening one moves focus into it, and closing it returns focus to its button.
- **12.2** Phone sheets trap focus while open, close on Escape, and return focus to the control that opened them.
- **12.3** The Saved View tabs are a navigation landmark named "Saved views", and the current tab is exposed as current.
- **12.4** The result count is announced politely after the results change.
- **12.5** Pinned bars never cover the focused element; the page scroll padding accounts for them.
- **12.6** Pinned phone bars respect the device safe area.

---

## Known divergences (code vs spec)

| Requirement | Divergence | Resolution |
| :-- | :-- | :-- |
| §7.1, §7.3 | On phones search still has its own row above the list box; the phone List Header has no search field. | PP-jb9v.15 |
| §7.2 | While the Summary Widgets stack, the title row holds a Summary Row toggle; on a Collection or Tag tab it sits on its own row between the page's tabs and search. | PP-jb9v.14 |
| §7.8, §7.11 | The phone pager is a 44px full-width bar pinned above the tab bar, and the scroller reserves its height. | PP-jb9v.15 |
| §7.10, §12.5 | The phone List Header scrolls away with the page, and the page's top scroll padding covers only the app header, not a pinned List Header. | PP-jb9v.15 |
| §4.5, §12.1 | The filter overflow button is labeled "More". | PP-jb9v.16 |
| §4.10 | The filter overflow badge counts every filter the button holds, changed or not. | PP-jb9v.16 |
| §5.8 | View tabs are underlined like page tabs, the current one marked by its underline. | PP-jb9v.16 |
| §8.7 | Fit checks compare bare measured widths with no tolerance. | PP-jb9v.16 |
| §8.9, §8.10 | A Tag page's breadcrumb always sits above the title, a Collection page has no breadcrumb, and a Collection's description always sits under the header. | PP-jb9v.18 |
| §8.11, §8.12 | Page actions that do not fit wrap below the title or onto their own row; there is no Actions menu to fold into. | PP-jb9v.17 |
| §8.13, §8.23 | A Collection or Tag page's tabs never move into a menu, and its header spacing does not tighten below 390px. | PP-jb9v.18 |
| §3.7–§3.10, §7.2 | Page actions are separate buttons with no ⋯ Actions menu, cap, or fold order; they become icon buttons at the md breakpoint rather than when they stop fitting, and Machines' Add Machine label shortens in steps. | PP-jb9v.17 |
| §1, §5.5 | Issue View's Export sits in the desktop List Header, and phones offer no Export. | PP-jb9v.17 |

---

## Changelog

| Date | Change |
| :-- | :-- |
| 2026-10-11 | §8 becomes the Collapse Order (§1): one set of ordered steps for every Surface, measured on each part's container with a small tolerance (§8.6–§8.8); page-header steps for the breadcrumb, description, page actions, and page tabs (§8.9–§8.13); Summary Widget, filter, List Header, table, and row steps (§8.14–§8.21); the phone layout and the narrow Collection or Tag header (§8.22, §8.23); 8.1–8.3 and 8.5 retired into §8.15–§8.19 and §8.24. The filter overflow is named More filters, and its badge counts only filters changed from the Page Preset (§1, §4.5, §4.10, §12.1). View tabs are quiet pills (§5.8). The List Header concept names its phone contents (§1). Page actions: at most three, ending with a ⋯ menu that reads Actions when labeled; they go from labeled outlined buttons to icon buttons, then fold into ⋯ in the page's order, at every width (§1, §3.2, §3.7–§3.10, §7.2). Export leaves the List Header for ⋯ (§1, §5.5). |
| 2026-10-11 | Phone list chrome: search moves into the phone List Header with no search row (§7.1, §7.3); the pager follows the list instead of being pinned (§7.8); the phone List Header stays under the app header while the page above it scrolls away (§7.10); nothing full-width is pinned above the tab bar, per the site-wide design-bible §3 rule (§7.11). |
| 2026-10-11 | The Summary Row toggle is gone with the collapsible Summary Widgets: removed from the title row and the Collection and Tag tabs (§7.2), retired the stacking rule (§8.4), and dropped Summary Row open state from Saved Views (§10.2); the first rows at 1440×900 sit below the always-shown Summary Widgets (§3.4). |
| 2026-10-05 | Built-in Views are starting points: they set filters and sorting only, leaving one leaves no Applied View and offers Save view, and only a changed Saved View is Edited (§1, §3.6, §5.2, §5.3, §7.3, §7.6). The Summary Row toggle moves to the title row whenever the Summary Widgets stack (§8.4). |
| 2026-10-04 | Reset all returns filters to the Page Preset (§7.5); Built-in Views stay reachable as tabs or in More views (§10.12); the List Header's crowding order and the single-page result range (§8.3); per-filter Reset (§4.9); a Page Preset URL names its Built-in View when the account's Default View is another view (§10.10); empty-state action only when Edited (§3.6). The search field shows no placeholder (§4.2). |
| 2026-10-03 | On a Collection or Tag tab the Summary Row toggle sits on its own row between the page's tabs and search (§7.2). |
| 2026-10-03 | Stacked Summary Widgets sit in a collapsible section (§8.4). |
| 2026-10-02 | Default View controls appear only on the Machines and Issues pages (§10.8). |
| 2026-10-02 | Created from the approved list-framework design: shared layout, filters, List Header with Saved View tabs, compact and bottom pagers, phone sheets and pinned pager, overflow rules, URL state, Saved Views shared across each host's Surfaces with a Default View on the main page only (moved from machine-views §8), returning to a list, and accessibility. |
