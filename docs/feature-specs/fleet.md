# Machine & PinballMap Status Dashboard — Feature Spec

**Status: approved.**

**What this document is.** The requirements for PinPoint's Machine & PinballMap Status Dashboard at `/fleet` — the single fleet-wide audit surface for managing 100+ collection machines, ops status, and Pinball Map synchronization status. It describes the intended final state only; what the code does or used to do lives solely in the Known divergences table. Each requirement is numbered for citation. When code and spec disagree, either the code is wrong or this document gets amended — never silently neither.

**Related records.** `docs/feature-specs/pinballmap.md` (Pinball Map catalog sync and listing state).

---

## 1. Concepts

- **Machine & PinballMap Status Dashboard** — the operational route (`/fleet`) providing a status table of every machine in the collection.
- **Fleet Table** — a fleet audit table displaying machine identity, operational/availability status, ownership, issue count, and Pinball Map sync status.
- **Filter Presets** — URL-driven filter configurations that allow members and technicians to rapidly narrow the fleet by operational, listing, and synchronization criteria.
- **Per-Machine Inspection Surface** — a contextual detail pane for the selected machine. On desktop viewports (`≥1024px`), it renders as a side-by-side pane alongside the table without obscuring pinned columns. On mobile viewports (`<1024px`), it transitions to a bottom sheet (`Drawer` / `Sheet`) overlay with swipe/drag dismissibility and thumb-friendly action targets.
- **Edition Near-Miss** — a machine state where a local machine and a Pinball Map lineup entry share a title family (`machineGroupId`), but differ in edition (defined in `docs/feature-specs/pinballmap.md` §1).

---

## 2. Page Structure & Access Control

- **2.1** A single operational route (`/fleet`) lists every collection machine in a paginated status table.
- **2.2** Page view access is `member+` (available to all authenticated members, technicians, and admins; guests are denied access).
- **2.3** The table is paginated with a user-selectable number of rows per page (e.g. 25, 50, 100) to keep performance snappy while accommodating fleet auditing.

---

## 3. Fleet Table & Navigation

- **3.1** The header row remains sticky at the top of the container during vertical scrolling.
- **3.2** The first column (Machine Identity: Title, with availability and playability statuses as primary candidates) remains sticky on the left during horizontal scrolling.
- **3.3** Horizontal scrolling is enabled across remaining columns (e.g. Owner, Open Issues, PBM Catalog Match, PBM Listed status, PBM Sync state). Default column visibility is deliberately lean and curated to prevent an overly wide, cluttered spreadsheet layout.
- **3.4** Sorting is client-side URL-driven: clicking column headers updates `sort` and `dir` URL search parameters via soft client navigation without triggering a page refresh, and applies accessible `aria-sort` attributes.
- **3.5** Column display adheres to accessibility standard `CORE-A11Y-003` with `<th scope="col">` and accessible table labeling.
- **3.6** The table does not hide columns responsively on narrower viewports (`CORE-RESP-001`); instead, it allows horizontal scrolling while keeping the first column pinned.

---

## 4. Filter Presets & URL State

- **4.1** Filter controls render as quick-selection preset pills above the table to filter fleet machines by operational, catalog link, and Pinball Map sync states.
- **4.2** All filter states, search queries, and sort parameters round-trip through URL search parameters (`q`, `status`, `pbm_state`, `sort`, `dir`) via client-side soft navigation without full page reloads.
- **4.3** Pasting or opening a URL with search parameters initializes the exact filter, sort, and search view.

---

## 5. Pinball Map Column Group & Sync Status

- **5.1** Pinball Map columns render from stored snapshot state without making live third-party API calls on page render.
- **5.2** The table displays the last snapshot sync timestamp in the section header.
- **5.3** Edition near-misses (matching title family / `machineGroupId`, differing edition) are visually highlighted as distinct from genuinely unmatched machines to guide catalog linking.
- **5.4** Desync statuses (e.g., condition mismatch, unlisted cabinet present on floor, listed cabinet removed) render explicit diagnostic badges derived from `derivePbmMachineStatus()`.

---

## 6. Per-Machine Inspection Surface & Responsive Behavior

- **6.1** Selecting a row or clicking its inspect action opens the **Per-Machine Inspection Surface** for the focused machine.
- **6.2** On desktop viewports (`≥1024px`), the inspection surface opens as an anchored side-by-side pane, adjusting the main table container width without obscuring the pinned machine column.
- **6.3** On narrower viewports, the inspection surface opens as a full-width bottom sheet (`Drawer` / `Sheet`) with drag-to-dismiss behavior and touch-optimized action targets.
- **6.4** The inspection surface presents detailed per-machine PBM sync diagnostics, local vs. PBM edition comparisons, owner attribution notes, and action triggers (Trigger Snapshot Sync, Edit Match Link, Open on PinballMap.com).

---

## 7. Permissions

- **7.1** Viewing `/fleet` requires `member+` role (members, technicians, and admins).
- **7.2** Individual mutation actions accessed through the page or inspection surface (e.g. edit machine, update PBM link, list/unlist on PBM, trigger sync) remain strictly gated by their respective granular capability checks (e.g. machine ownership, tech capability, or admin grant) as defined in `docs/feature-specs/pinballmap.md` §8 and the PinPoint permissions matrix. Viewing the status table as a member does not grant permission to perform unauthorized mutations.

---

## Known divergences (code vs spec)

| Spec                                           | Code today                                  | Resolution                     |
| :--------------------------------------------- | :------------------------------------------ | :----------------------------- |
| §2.1 `/fleet` route                            | Route does not exist                        | Implementation of route        |
| §3.2 Sticky first column & sticky header       | No sticky table layout component            | Sticky table component         |
| §4.1 Filter presets & URL state                | `MachineFilters` lacks PBM filter axes      | PBM filter extension           |
| §5.1 PBM column group & near-miss detection    | Dashboard table not yet built               | Dashboard table implementation |
| §6.1 Responsive per-machine inspection surface | No per-machine inspection pane/drawer built | Inspection surface component   |

---

## Changelog

| Date       | Change                                                                                                                                                                                                                                              |
| :--------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-05 | Created. Establishes requirements for member+ status table at `/fleet` (§2–§3), URL-driven filter presets (§4), PBM column group & edition near-misses (§5), desktop side-pane / mobile bottom-sheet inspection surface (§6), and permissions (§7). |
