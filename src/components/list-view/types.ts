/**
 * The host-neutral models List View controls render (spec list-views.md).
 * A List Host (Machine View, Issue View) builds these from its own state;
 * List View knows nothing about machines or issues.
 */

export type SortDirection = "asc" | "desc";

/** One choice in a filter, sort, or display control. */
export interface ListOption {
  value: string;
  label: string;
  /** A short tag shown before the label, such as a machine's initials. */
  tag?: string | undefined;
  /** A semantic text color class for state values, from the host's config. */
  textClassName?: string | undefined;
}

/** A Primary or Secondary Filter (list-views §4). */
export interface ListFilterModel {
  id: string;
  /** The filter's name, shown on its dropdown button (§4.3). */
  label: string;
  options: readonly ListOption[];
  /** Host shortcuts listed above the options, such as Me and Unassigned (§4.4). */
  shortcuts?: readonly ListOption[] | undefined;
  /** Placeholder of the type-to-search box for long lists (§4.4). */
  searchPlaceholder?: string | undefined;
  selected: readonly string[];
  /** What the control shows when set (§4.3, §4.6); null shows only the name. */
  valueLabel: string | null;
  /** Whether the filter holds its Page Preset value (§7.3). */
  atPreset: boolean;
  onChange: (values: string[]) => void;
  /** Returns the filter to its Page Preset value. */
  onReset: () => void;
}

export type ActionOutcome = { ok: true } | { ok: false; message: string };
export type ActionOutcomeWith<T> =
  { ok: true; value: T } | { ok: false; message: string };

export type DefaultViewTarget = {
  kind: "saved" | "builtIn";
  id: string;
} | null;

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
  /** Signed-in accounts with the Save views permission (§10.1). */
  canSave: boolean;
  /** Default View controls show only on the host's main page (§10.8). */
  offersDefault: boolean;
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
 * The value a filter control shows (§4.3): the one value's label, or a count
 * of values. Values the options no longer list still count.
 */
export function describeSelection(
  selected: readonly string[],
  options: readonly ListOption[]
): string | null {
  if (selected.length === 0) return null;
  if (selected.length > 1) return String(selected.length);
  const [only] = selected;
  return options.find((option) => option.value === only)?.label ?? "1";
}
