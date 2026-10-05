/**
 * The host-neutral models List View controls render (spec list-views.md).
 * A List Host (Machine View, Issue View) builds these from its own state;
 * List View knows nothing about machines or issues.
 */

import type { DefaultViewTarget } from "~/lib/types";

export type SortDirection = "asc" | "desc";

/** One choice in a filter, sort, or display control. */
export interface ListOption {
  value: string;
  label: string;
  /** A short tag shown before the label, such as a machine's initials. */
  tag?: string | undefined;
  /** A semantic text color class for state values, from the host's config. */
  textClassName?: string | undefined;
  /**
   * The group a filter option belongs to. Options of one group are listed
   * together under a heading that selects or clears the whole group.
   */
  group?: string | undefined;
  /**
   * The values a filter shortcut stands for, when it stands for several,
   * such as the machines a person owns. Checking it adds them all; it shows
   * as checked while every one is selected.
   */
  values?: readonly string[] | undefined;
}

interface ListFilterBase {
  id: string;
  /** The filter's name, shown on its dropdown button (§4.3). */
  label: string;
  /**
   * What the control shows when set (§4.3, §4.6); null shows only the name,
   * or a count when several values are selected.
   */
  valueLabel: string | null;
  /** Whether the filter holds its Page Preset value (§7.3). */
  atPreset: boolean;
  /** Returns the filter to its Page Preset value. */
  onReset: () => void;
}

/** A filter of options, any number of which can be selected (list-views §4). */
export interface ListOptionsFilterModel extends ListFilterBase {
  kind?: "options" | undefined;
  options: readonly ListOption[];
  /** Host shortcuts listed above the options, such as Me and Unassigned (§4.4). */
  shortcuts?: readonly ListOption[] | undefined;
  /** Placeholder of the type-to-search box for long lists (§4.4). */
  searchPlaceholder?: string | undefined;
  selected: readonly string[];
  onChange: (values: string[]) => void;
}

/** A date range; each end is a calendar day (`YYYY-MM-DD`) or open. */
export interface ListDateRange {
  from: string | null;
  to: string | null;
}

/** A filter on a date range, such as Created. */
export interface ListDateRangeFilterModel extends ListFilterBase {
  kind: "dateRange";
  range: ListDateRange;
  onRangeChange: (range: ListDateRange) => void;
}

/** A Primary or Secondary Filter (list-views §4). */
export type ListFilterModel = ListOptionsFilterModel | ListDateRangeFilterModel;

/** How many values a filter holds, for its count (§4.3, §7.3). */
export function selectionCount(filter: ListFilterModel): number {
  return filter.kind === "dateRange" ? 0 : filter.selected.length;
}

export type ActionOutcome = { ok: true } | { ok: false; message: string };
export type ActionOutcomeWith<T> =
  { ok: true; value: T } | { ok: false; message: string };

/** The Saved View writes a host wires to its own Server Actions (§10). */
export interface SavedViewActions {
  saveChanges: () => Promise<ActionOutcome>;
  saveAsNew: (input: {
    name: string;
    makeDefault: boolean;
  }) => Promise<ActionOutcomeWith<{ id: string }>>;
  rename: (id: string, name: string) => Promise<ActionOutcome>;
  remove: (id: string) => Promise<ActionOutcome>;
  setDefault: (target: DefaultViewTarget) => Promise<ActionOutcome>;
}

export interface ListViewEntry {
  id: string;
  name: string;
}

/** Built-in and Saved Views for the List Header and its phone sheet (§5, §7.6, §10). */
export interface ListViewsModel {
  builtInViews: readonly ListViewEntry[];
  savedViews: readonly ListViewEntry[];
  appliedId: string;
  appliedName: string;
  /** The Applied View is one of the account's own Saved Views (§5.3). */
  appliedIsSaved: boolean;
  edited: boolean;
  /**
   * The current View Configuration in a stable serialized form. A Save
   * changes failure shows only while the configuration it was made from is
   * unchanged (§5.3).
   */
  configurationKey: string;
  /** Signed-in accounts with the Save views permission (§10.1). */
  canSave: boolean;
  /** Default View controls show only on the host's main page (§10.8). */
  offersDefault: boolean;
  /** The host's main page, where the Default View opens, such as "Machines". */
  defaultPageName: string;
  defaultViewId: string | null;
  /** The canonical URL that opens a view at page 1 (§9.5, §10.6). */
  hrefFor: (id: string) => string;
  onApply: (id: string) => void;
  /** Returns to the Applied View's configuration at page 1 (§5.4). */
  onDiscard: () => void;
  actions: SavedViewActions;
}

/** The sort control (list-views §5.5; machine-views §3.14). */
export interface ListSortModel {
  fields: readonly ListOption[];
  field: string;
  dir: SortDirection;
  directionLabels: (field: string) => { asc: string; desc: string };
  /** The direction a field sorts in when first chosen (§9.8). */
  preferredDirection: (field: string) => SortDirection;
  /** The current sort, such as "Name, A–Z". */
  label: string;
  onChange: (field: string, dir: SortDirection) => void;
}

/** View options and the phone sheet's Display section (§5.6, §5.7, §7.5). */
export interface ListDisplayModel {
  pageSize: number;
  pageSizes: readonly number[];
  onPageSizeChange: (pageSize: number) => void;
  /** Displayed fields, for hosts with columns (§5.6). */
  fields?:
    | {
        options: readonly ListOption[];
        selected: readonly string[];
        onToggle: (value: string, checked: boolean) => void;
      }
    | undefined;
  /** A phone-only presentation choice, such as Compact list or Table. */
  layout?:
    | {
        label: string;
        options: readonly ListOption[];
        value: string;
        onChange: (value: string) => void;
      }
    | undefined;
}

export interface ListPaginationModel {
  page: number;
  pageSize: number;
  totalCount: number;
  /** Moves to `page`; `fromBottom` pagers also return to the list's top. */
  onPage: (page: number, fromBottom: boolean) => void;
}

/** What the list counts, for the result button and announcements. */
export interface ListNoun {
  one: string;
  other: string;
}

export function nounFor(noun: ListNoun, count: number): string {
  return count === 1 ? noun.one : noun.other;
}

/**
 * A filter's `valueLabel` (§4.3): the label of its one selected value. More
 * than one value shows as a count instead (`filterSelectionText`). A value
 * the options no longer list still counts.
 */
export function describeSelection(
  selected: readonly string[],
  options: readonly ListOption[]
): string | null {
  if (selected.length !== 1) return null;
  const [only] = selected;
  return options.find((option) => option.value === only)?.label ?? "1";
}

/**
 * What a filter's control says it holds (§4.3, §4.6): the host's label for
 * it, such as the one value or "Open"; else "3 selected"; else null when
 * nothing is selected.
 */
export function filterSelectionText(filter: ListFilterModel): string | null {
  if (filter.valueLabel !== null) return filter.valueLabel;
  const count = selectionCount(filter);
  return count > 1 ? `${count} selected` : null;
}

/**
 * A filter's Reset (§4.9). Reset stays enabled at the Page Preset so
 * pressing it keeps focus, and there it does nothing: no page change and no
 * navigation.
 */
export function resetFilter(filter: ListFilterModel): void {
  if (!filter.atPreset) filter.onReset();
}

/**
 * Whether Manage views has anything to offer: the Default View on the host's
 * main page, or a Saved View to rename or delete (§10.8).
 */
export function offersManageViews(views: ListViewsModel): boolean {
  return views.canSave && (views.offersDefault || views.savedViews.length > 0);
}

/**
 * The sort directions for the current field, its preferred direction first
 * (§9.8). Direction words read as a phrase on the trigger ("Name, newest")
 * and stand alone, capitalized, in menus.
 */
export function sortDirectionOptions(
  sort: ListSortModel
): { value: SortDirection; label: string }[] {
  const labels = sort.directionLabels(sort.field);
  const preferred = sort.preferredDirection(sort.field);
  const order: SortDirection[] =
    preferred === "asc" ? ["asc", "desc"] : ["desc", "asc"];
  return order.map((dir) => ({
    value: dir,
    label: labels[dir].charAt(0).toUpperCase() + labels[dir].slice(1),
  }));
}
