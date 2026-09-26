# Summary Widgets — Feature Spec

**Status: draft.**

**What this document is.** The requirements every PinPoint Summary Widget shares, whichever list it summarizes. It describes the intended final state only; what the code does or used to do lives solely in the Known divergences table. Each requirement is numbered for citation. When code and spec disagree, either the code is wrong or this document gets amended — never silently neither.

**Related records.** `docs/feature-specs/machine-widgets.md` (the widgets on Machines and Collections), `docs/feature-specs/issue-widgets.md` (the widgets on Issues), `docs/feature-specs/machine-views.md` (Machine View, a Widget Host). A later Integrations widgets spec will add that page's widgets.

---

## 1. Concepts

- **Summary Widget** — a fixed summary of one aspect of a Widget Population: a headline, one segmented bar, and a breakdown of its Segments.
- **Widget Host** — a searchable, filterable, paginated list whose view state lives in the URL, such as Machine View or the Issues list. The host's widgets spec names the widgets it shows, their URL parameters, and the filters their Segments set.
- **Widget Population** — the records one Summary Widget summarizes. All is the host's complete authoritative scope; Filtered is every record matching the host's current search and filters across all pages.
- **Segment** — one category in a widget's bar and breakdown, with one count.
- **Summary Row** — the single collapsed line that stands in for a host's Summary Widgets on phones.

---

## 2. Placement and Configuration

- **2.1** Each host's widgets spec defines which Summary Widgets appear and in what order. A person cannot add, remove, hide, or reorder them.
- **2.2** Summary Widgets appear between the page heading and the host's search and filter toolbar, to everyone who can view the host.
- **2.3** Wider layouts place a host's Summary Widgets side by side in one row, always expanded, with no collapse control.
- **2.4** Phones stack a host's Summary Widgets full-width inside one collapsible section that starts collapsed as the Summary Row.
- **2.5** The Summary Row shows one short figure per widget, as its host's widgets spec defines, and expands the section when selected.
- **2.6** The browser remembers each person's expanded or collapsed choice per host. That choice is never URL state and never part of a saved view.

---

## 3. Widget Population

- **3.1** Each Summary Widget offers an All/Filtered choice of Widget Population. Each widget defaults to All independently of the others.
- **3.2** Widget Population is URL state. A widget set to Filtered carries a host-named parameter with the value `filtered`; All is the default and is omitted.
- **3.3** Changing a Widget Population keeps the host's current page.
- **3.4** A host with saved views stores each widget's Widget Population as part of the saved view.

---

## 4. Counts

- **4.1** Summary Widget counts always cover the whole Widget Population, never only the current page.
- **4.2** Counts are computed on the server. The browser receives the counts, never the population's records.
- **4.3** A Summary Widget uses the same derivations as the host's fields and filters, so its counts never disagree with the rows.
- **4.4** A Summary Widget loads only the data its counts need. Showing a widget never makes the host load unrelated optional data.
- **4.5** An empty Widget Population shows zero counts and an empty bar.

---

## 5. Presentation

- **5.1** A Summary Widget shows a group label with its All/Filtered choice, a headline, one continuous segmented bar, and a breakdown listing every Segment's count and label.
- **5.2** A Segment shows exactly one count. Widgets carry no secondary counts or subtitles.
- **5.3** Bar Segments are sized by their counts and colored with the colors PinPoint already uses for that category's badges.
- **5.4** Every count appears as text, so color is never the only signal.
- **5.5** A Segment with a zero count still appears in the breakdown with its zero.

---

## 6. Segment Selection

- **6.1** Selecting a Segment sets the host filter its widgets spec associates with that widget to that Segment's value alone, replacing any other values in that filter. A host's widgets spec may name additional filters a Segment sets.
- **6.2** Selecting a Segment keeps search and every other filter, and returns the host to page 1.
- **6.3** A filter set from a Summary Widget appears in the toolbar and active chips like any other filter and is removed the same way.
- **6.4** A Segment with a zero count cannot be selected.
- **6.5** Segments are keyboard-operable and announce their label and count.

---

## Known divergences (code vs spec)

| Spec  | Code today               | Resolution                               |
| :---- | :----------------------- | :--------------------------------------- |
| §1–§6 | No Summary Widget exists | Machine widgets implementation (PP-3h21) |

---

## Changelog

| Date | Change |
| :-- | :-- |
| 2026-09-26 | Created. Establishes fixed Summary Widgets between a Widget Host's heading and toolbar, a collapsed-by-default Summary Row on phones, per-widget All/Filtered Widget Population as URL state, whole-population server-computed counts, single-count Segments in existing category colors, and Segment selection as a host filter. |
