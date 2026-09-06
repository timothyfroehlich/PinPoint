# Machine & PinballMap Status Dashboard — Feature Spec

**Status: approved.**

**What this document is.** The requirements for PinPoint's Machine & PinballMap Status Dashboard at `/fleet` — the single fleet-wide audit surface for managing 100+ collection machines, ops status, and Pinball Map synchronization status. It describes the intended final state only; what the code does or used to do lives solely in the Known divergences table. Each requirement is numbered for citation. When code and spec disagree, either the code is wrong or this document gets amended — never silently neither.

**Related records.** `docs/feature-specs/pinballmap.md` (Pinball Map catalog sync and listing state).

---

## 1. Concepts

- **Machine & PinballMap Status Dashboard** — the operational route (`/fleet`) providing a status table of every machine in the collection.
- **Fleet Table** — a fleet audit table displaying machine identity, operational/availability status, ownership, issue count, and Pinball Map sync status.
- **Filter Presets** — URL-driven filter configurations that allow members and technicians to rapidly narrow the fleet by operational, listing, and synchronization criteria.
- **KPI Summary Cards** — a strip of connected summary cards above the table summarizing fleet-wide operational health:
  - **Total Machines**: count of all machines in the collection.
  - **On Floor**: count of machines with `on_the_floor` presence, and percentage of total collection machines (`on_the_floor / total`).
  - **Operational**: count of operational machines among on-floor machines, and percentage of on-floor machines (`operational / on_the_floor`).
  - **Open Issues**: total open issues count across all machines, and count of machines with at least one open issue.
  - **In Sync with PBM**: count of machines with an in-sync Pinball Map status (`in_sync`, `on`, `covered`), and percentage of machines intended for public listing (`in_sync / intent_on`).
  - **Discrepancies**: count of machines requiring operator action (playability `needs_service` or `unplayable`, or Pinball Map `outOfSync` states `missing`, `lingering`, `alert`).
- **Last Serviced** — the recency of the most recent maintenance-tagged timeline event or service touch recorded on a machine. Machines with no recorded service history display "Never".
- **Per-Machine Inspection Surface** — a contextual detail pane for the selected machine. On desktop and tablet viewports (`≥768px` / `md:`), it renders as a side-by-side pane alongside the table without obscuring pinned columns. On mobile viewports (`<768px`), it transitions to a bottom drawer (`Drawer`) overlay with swipe/drag dismissibility and thumb-friendly action targets.
- **Edition Near-Miss** — a machine state where a local machine and a Pinball Map lineup entry share a title family (`machineGroupId`), but differ in edition (defined in `docs/feature-specs/pinballmap.md` §1).

---

## 2. Page Structure & Access Control

- **2.1** A single operational route (`/fleet`) lists every collection machine in a paginated status table.
- **2.2** Page view access is `member+` (available to all authenticated members, technicians, and admins; guests are denied access).
- **2.3** The table is paginated with a user-selectable number of rows per page (e.g. 25, 50, 100) to keep performance snappy while accommodating fleet auditing.
- **2.4** The page renders the KPI Summary Cards strip above the filter controls using the population formulas defined in §1. When a percentage denominator is zero, the percentage displays "—".

---

## 3. Fleet Table & Navigation

- **3.1** The header row remains sticky at the top of the container during vertical scrolling.
- **3.2** The first column (Machine Identity) remains sticky on the left during horizontal scrolling. It displays strictly two lines: Line 1 renders the machine title and uppercase initials badge; Line 2 renders manufacturer, year, and owner (`[Manufacturer] · [Year] · [Owner]`).
- **3.3** Default column visibility is curated and lean: Machine (pinned), Presence, Playability, Open Issues, Last Serviced (positioned immediately adjacent to Open Issues), and Pinball Map Status default to visible. The Owner column defaults to off as an independent column since owner identity is surfaced on Line 2 of the Machine Identity column. Additional toggleable columns (Manufacturer, Year, PBM Intent) default to off.
- **3.4** Sorting is client-side URL-driven: clicking column headers updates `sort` and `dir` URL search parameters via soft client navigation without triggering a page refresh, and applies accessible `aria-sort` attributes.
- **3.5** Column display adheres to accessibility standard `CORE-A11Y-003` with `<th scope="col">` and accessible table labeling.
- **3.6** The table does not hide columns responsively on narrower viewports (`CORE-RESP-001`); instead, it allows horizontal scrolling while keeping the first column pinned.
- **3.7** A View Options control allows operators to toggle optional column visibility and select page size (25, 50, 100).

---

## 4. Filter Presets & URL State

- **4.1** The filter toolbar provides a unified search input matching across machine name, initials, manufacturer, and model name.
- **4.2** Multi-select dropdown filters allow combining criteria across Presence, Playability, Pinball Map sync state, and Owner.
- **4.3** Active filters render in a dismissible chips tray above the table with individual removal buttons and a clear-all action.
- **4.4** All filter states, search queries, sort parameters, and pagination round-trip through URL search parameters (`q`, `presence`, `status`, `pbm`, `owner`, `sort`, `dir`, `page`, `pageSize`) via client-side soft navigation without full page reloads.
- **4.5** Pasting or opening a URL with search parameters initializes the exact filter, sort, pagination, and search view.

---

## 5. Pinball Map Column Group & Sync Status

- **5.1** Pinball Map columns render from stored snapshot state without making live third-party API calls on page render.
- **5.2** The table displays the last snapshot sync timestamp in the section header.
- **5.3** Edition near-misses (matching title family / `machineGroupId`, differing edition) are visually highlighted as distinct from genuinely unmatched machines to guide catalog linking.
- **5.4** Pinball Map sync and advisory states (such as In Sync, Missing, Lingering, Alert, and Flag) render explicit diagnostic status badges defined in `docs/feature-specs/pinballmap.md` §4.10.

---

## 6. Per-Machine Inspection Surface & Responsive Behavior

- **6.1** Selecting a row or clicking its inspect action opens the **Per-Machine Inspection Surface** for the focused machine.
- **6.2** On desktop and tablet viewports (`≥768px` / `md:`), the inspection surface opens as an anchored side-by-side pane, adjusting the main table container width without obscuring the pinned machine column.
- **6.3** On mobile viewports (`<768px`), the inspection surface opens as a full-width bottom drawer (`Drawer`) with drag-to-dismiss behavior and touch-optimized action targets.
- **6.4** The inspection surface presents detailed per-machine PBM sync diagnostics, local vs. PBM edition comparisons, owner attribution notes, and action triggers (Refresh, Edit Match Link, Open on PinballMap.com).

---

## 7. Permissions

- **7.1** Viewing `/fleet` requires `member+` role (members, technicians, and admins).
- **7.2** Individual mutation actions accessed through the page or inspection surface (e.g. edit machine, update PBM link, list/unlist on PBM, trigger sync) remain strictly gated by their respective granular capability checks (e.g. machine ownership, tech capability, or admin grant) as defined in `docs/feature-specs/pinballmap.md` §8 and the PinPoint permissions matrix. Viewing the status table as a member does not grant permission to perform unauthorized mutations.

---

## Known divergences (code vs spec)

| Spec | Code today | Resolution |
| :-- | :-- | :-- |
| §2.1 `/fleet` route | Route does not exist | Implementation of route |
| §3.2 Sticky first column & sticky header | No sticky table layout component | Sticky table component |
| §4.1–§4.4 Filter toolbar & URL state | `MachineFilters` lacks PBM filter axis, manufacturer/model search matching, and `pageSize` URL sync | Fleet filter toolbar |
| §5.1 PBM column group & near-miss detection | Dashboard table not yet built | Dashboard table implementation |
| §6.1 Responsive per-machine inspection surface | No per-machine inspection pane/drawer built | Inspection surface component |

---

## Changelog

| Date | Change |
| :-- | :-- |
| 2026-09-06 | Clarify strictly two-line machine identity column (§3.2), lean column defaults and Last Serviced positioning (§3.3), View Options control (§3.7), KPI formulas and empty-state rules (§1, §2.4), and unified search/multi-select filter toolbar (§4.1–§4.5). |
| 2026-09-05 | Created. Establishes requirements for member+ status table at `/fleet` (§2–§3), URL-driven filter presets (§4), PBM column group & edition near-misses (§5), desktop side-pane / mobile bottom-sheet inspection surface (§6), and permissions (§7). |
