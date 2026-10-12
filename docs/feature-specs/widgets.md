# Summary Widgets — Feature Spec

**Status: draft.**

**What this document is.** The requirements every PinPoint Summary Widget shares, whichever list it summarizes. It describes the intended final state only; what the code does or used to do lives solely in the Known divergences table. Each requirement is numbered for citation. When code and spec disagree, either the code is wrong or this document gets amended — never silently neither.

**Related records.** `docs/feature-specs/machine-widgets.md` (the widgets on Machines and Collections), `docs/feature-specs/issue-widgets.md` (the widgets on Issues), `docs/feature-specs/machine-views.md` (Machine View, a Widget Host). A later Integrations widgets spec will add that page's widgets.

---

## 1. Concepts

- **Summary Widget** — a fixed summary of one aspect of a Widget Population: one segmented bar and a breakdown of its Segments.
- **Widget Host** — a searchable, filterable, paginated list whose view state lives in the URL, such as Machine View or the Issues list. The host's widgets spec names the widgets it shows, their URL parameters, and the filters their Segments set.
- **Widget Population** — the records one Summary Widget summarizes: the host's complete authoritative scope, whatever search and filters are set. The Filtered population was retired 2026-10-02.
- **Segment** — one category in a widget's bar and breakdown, with one count.
- **Summary Row** — _Retired 2026-10-11._ Summary Widgets never stack or collapse (§2.3), so no line stands in for them.

---

## 2. Placement and Configuration

- **2.1** Each host's widgets spec defines which Summary Widgets appear and in what order. A person cannot add, remove, hide, or reorder them.
- **2.2** Summary Widgets appear between the page heading and the host's search and filter toolbar, to everyone who can view the host.
- **2.3** A host's Summary Widgets sit side by side in one row at every width, each at least 240px wide, always expanded, with no collapse control.
- **2.4** _Retired 2026-10-11._ Summary Widgets no longer stack into a collapsible section; whole widgets drop instead (§2.7). Number kept so older citations don't dangle.
- **2.5** _Retired 2026-10-11_ with the Summary Row (§1). Number kept so older citations don't dangle.
- **2.6** _Retired 2026-10-11._ Summary Widgets cannot be collapsed, so there is no expanded or collapsed choice to remember. Number kept so older citations don't dangle.
- **2.7** When a host's Summary Widgets do not all fit side by side at 240px each, whole widgets drop from the right, last in the host's order first, until the rest fit; a widget never shrinks below 240px, stacks, or wraps to a second row. When not even one widget fits at 240px, the Summary Widgets are not shown.

---

## 3. Widget Population

- **3.1** Every Summary Widget summarizes its host's whole scope; search and filters never change its counts. There is no All/Filtered choice.
- **3.2–3.4** _Retired 2026-10-02_ with the Filtered population: Widget Population is no longer URL state or part of a saved view. Numbers kept so older citations don't dangle.

---

## 4. Counts

- **4.1** Summary Widget counts always cover the whole Widget Population, never only the current page.
- **4.2** Counts are computed on the server. The browser receives the counts, never the population's records.
- **4.3** A Summary Widget uses the same derivations as the host's fields and filters, so its counts never disagree with the rows.
- **4.4** A Summary Widget loads only the data its counts need. Showing a widget never makes the host load unrelated optional data.
- **4.5** An empty Widget Population shows zero counts and an empty bar.

---

## 5. Presentation

- **5.1** A Summary Widget shows a group label, one continuous segmented bar, and a breakdown listing every Segment's count and label.
- **5.2** A Segment shows exactly one count. Widgets carry no secondary counts or subtitles.
- **5.3** Bar Segments are sized by their counts and colored with the colors PinPoint already uses for that category's badges.
- **5.4** Every count appears as text, so color is never the only signal.
- **5.5** The breakdown lists only Segments with a nonzero count; a Segment with a zero count is left out of the breakdown and of "N other".
- **5.6** The breakdown lists Segments in the order the host's widgets spec defines, worst first. When the line cannot fit every Segment, it shows whole count-and-label pairs from the start while they fit and rolls the rest into one "N other" entry; the bar still shows every Segment.
- **5.7** The breakdown sits on the widget's label line, with nothing beneath the bar. It shows no color swatches at any width; each count is shown in its Segment's category color.

---

## 6. Segment Selection

- **6.1** Selecting a Segment sets the host filter its widgets spec associates with that widget to that Segment's value alone, replacing any other values in that filter. A host's widgets spec may name additional filters a Segment sets.
- **6.2** Selecting a Segment keeps search and every other filter, and returns the host to page 1.
- **6.3** A filter set from a Summary Widget shows on its filter control like any other filter and is cleared the same way.
- **6.4** A Segment with a zero count cannot be selected.
- **6.5** Segments are keyboard-operable and announce their label and count.

---

## Known divergences (code vs spec)

| Requirement | Divergence | Resolution |
| :---------- | :--------- | :--------- |

---

## Changelog

| Date | Change |
| :-- | :-- |
| 2026-10-11 | Summary Widgets sit side by side at every width, each at least 240px wide, and whole widgets drop from the right when they do not fit, leaving no summary when not even one fits (§2.3, §2.7). Retired the collapsible stacked section, the Summary Row, and the remembered expanded or collapsed choice (§1, §2.4–§2.6). Breakdowns show no color swatches at any width, and each count is shown in its Segment's category color (§5.7). |
| 2026-10-05 | Stacked breakdowns drop the color swatches at every width (§5.7). |
| 2026-10-04 | Summary Widgets no longer show a headline (§1, §5.1); the breakdown sits on the label line at every width (§5.7). |
| 2026-10-03 | Zero-count Segments are left out of the breakdown and of "N other" (§5.5). Stacked widgets collapse at every width (§2.3, §2.4); headlines show only when widgets sit side by side (§5.1); stacked breakdowns sit on the label line above the bar (§5.7). The Summary Row stands in for any collapsed stacked section, not only on phones (§1). |
| 2026-10-02 | The Summary Row shows the figures its host defines (§2.5); Summary Widget filters show on their filter control (§6.3). Retired the Filtered population and the All/Filtered choice (§1, §3, §5.1). Widgets stack when a wide layout cannot fit them side by side (§2.3); the phone section starts open at 390px and wider (§2.4); breakdowns run worst first and roll overflow into "N other" (§5.5, §5.6); phone breakdowns sit on the label line (§5.7). |
| 2026-09-26 | Created. Establishes fixed Summary Widgets between a Widget Host's heading and toolbar, a collapsed-by-default Summary Row on phones, per-widget All/Filtered Widget Population as URL state, whole-population server-computed counts, single-count Segments in existing category colors, and Segment selection as a host filter. |
