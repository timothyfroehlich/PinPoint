/**
 * Fit rules for a List View between phone and desktop (spec list-views.md
 * §8). Pure arithmetic over measured widths: the components measure their
 * own rendered controls (CORE-RESP-002 boundary — ResizeObserver on the
 * component, never the viewport) and ask these functions which controls stay
 * inline and which move into an overflow menu. CSS still owns presentation.
 */

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** The width of `count` items laid out with `gap` between them. */
function rowWidth(widths: readonly number[], gap: number): number {
  return widths.length === 0 ? 0 : sum(widths) + gap * (widths.length - 1);
}

export interface FilterFitInput {
  /** Width the filter group may use beside search. */
  available: number;
  /** Each Primary Filter button's width, in the host's order. */
  filterWidths: readonly number[];
  /** Width of the More button. */
  moreWidth: number;
  /** Whether the host has Secondary Filters, so More shows regardless. */
  hasSecondary: boolean;
  gap: number;
}

/**
 * How many Primary Filters stay inline (§8.1): they move into More from the
 * right, one at a time, in the host's order, until the rest fit beside More.
 * More itself shows only when it holds something (§4.5).
 */
export function fitPrimaryFilters({
  available,
  filterWidths,
  moreWidth,
  hasSecondary,
  gap,
}: FilterFitInput): number {
  if (!hasSecondary && rowWidth(filterWidths, gap) <= available) {
    return filterWidths.length;
  }
  for (let count = filterWidths.length; count > 0; count -= 1) {
    const inline = filterWidths.slice(0, count);
    if (rowWidth([...inline, moreWidth], gap) <= available) return count;
  }
  return 0;
}

export type CompactPagerMode = "full" | "compact" | "hidden";

export interface ListHeaderFitInput {
  /** The List Header's inner width. */
  available: number;
  /** Each view tab's width, in order (the Applied View's tab included). */
  tabWidths: readonly number[];
  /** Index of the Applied View's tab in `tabWidths`; null with no Applied View. */
  appliedIndex: number | null;
  /** Width of More views, or 0 when the host never shows it. */
  moreViewsWidth: number;
  /** Whether More views shows even when every tab fits (it holds Saved Views or Manage views). */
  moreViewsAlways: boolean;
  /** Width of Save and Discard changes, or of Save view; 0 when neither shows. */
  editWidth: number;
  /** Width of Save and the shorter "Discard", or of Save view; 0 when neither shows. */
  editCompactWidth: number;
  /** The compact pager's width with its range text and without it. */
  pagerWidths: { full: number; compact: number };
  /** Sort, Export, and View options together. */
  controlsWidth: number;
  gap: number;
}

export interface ListHeaderPlan {
  /** Indexes of the tabs shown inline, in order. */
  visibleTabs: number[];
  /** Whether More views shows. */
  showMoreViews: boolean;
  pager: CompactPagerMode;
  /** Discard changes shortens to "Discard". */
  compactEdit: boolean;
}

function fitTabs(
  input: ListHeaderFitInput,
  leftAvailable: number,
  editWidth: number
): { visibleTabs: number[]; showMoreViews: boolean } | null {
  const { tabWidths, appliedIndex, gap } = input;
  const all = tabWidths.map((_, index) => index);
  const leftWidth = (indexes: number[], withMore: boolean): number =>
    rowWidth(
      [
        ...indexes.map((index) => tabWidths[index] ?? 0),
        ...(withMore ? [input.moreViewsWidth] : []),
        ...(editWidth > 0 ? [editWidth] : []),
      ],
      gap
    );
  if (!input.moreViewsAlways && leftWidth(all, false) <= leftAvailable) {
    return { visibleTabs: all, showMoreViews: false };
  }
  // Tabs leave from the right; the Applied View's tab always stays (§8.2).
  const pinned = appliedIndex === null ? [] : [appliedIndex];
  const others = all.filter((index) => index !== appliedIndex);
  for (let keep = others.length; keep >= 0; keep -= 1) {
    const visible = [...others.slice(0, keep), ...pinned].sort(
      (left, right) => left - right
    );
    if (leftWidth(visible, true) <= leftAvailable) {
      return { visibleTabs: visible, showMoreViews: true };
    }
  }
  return null;
}

const STEPS: readonly { pager: CompactPagerMode; compactEdit: boolean }[] = [
  { pager: "full", compactEdit: false },
  { pager: "compact", compactEdit: false },
  { pager: "hidden", compactEdit: false },
  { pager: "hidden", compactEdit: true },
];

/**
 * Lays out the desktop List Header (§8.2, §8.3). View tabs move into More
 * views from the right first; only when the Applied View's tab alone still
 * does not fit does the compact pager drop its range text, and then
 * disappear. The pager below the list always remains, and shows the result
 * range even when there is only one page. Past that, Discard
 * changes shortens to "Discard", and finally the Applied View's tab name
 * truncates (the component lets that one tab shrink).
 */
export function planListHeader(input: ListHeaderFitInput): ListHeaderPlan {
  for (const { pager, compactEdit } of STEPS) {
    const pagerWidth =
      pager === "hidden" ? 0 : input.pagerWidths[pager] + input.gap;
    const leftAvailable =
      input.available - input.controlsWidth - pagerWidth - input.gap;
    const editWidth = compactEdit ? input.editCompactWidth : input.editWidth;
    const tabs = fitTabs(input, leftAvailable, editWidth);
    if (tabs) return { ...tabs, pager, compactEdit };
  }
  return {
    visibleTabs: input.appliedIndex === null ? [] : [input.appliedIndex],
    showMoreViews: true,
    pager: "hidden",
    compactEdit: true,
  };
}

/** The narrowest the phone search field may be before it becomes an icon. */
export const PHONE_SEARCH_MIN_WIDTH = 175;

/**
 * Fit tolerance (list-views §8.7): the icon takes over slightly before the
 * field would drop below its minimum, so a field at exactly 175px is
 * already an icon.
 */
const FIT_TOLERANCE_PX = 1;

export interface PhoneSearchFitInput {
  /** The phone List Header's inner width. */
  available: number;
  /** The views button's untruncated width, Edited marker included. */
  viewsWidth: number;
  /** Width of the Filters icon button. */
  filtersWidth: number;
  gap: number;
}

/**
 * Whether the phone List Header shows search as an icon button instead of
 * the field (list-views §7.12). The field takes what the views button and
 * Filters leave, and becomes an icon when that would be narrower than
 * 175px, the field's width on a 400px screen with "Open issues" as the view
 * name, with the §8.7 tolerance on top. A longer view name, or the Edited
 * marker, makes it an icon on a wider screen.
 */
export function phoneSearchAsIcon({
  available,
  viewsWidth,
  filtersWidth,
  gap,
}: PhoneSearchFitInput): boolean {
  const fieldWidth = available - viewsWidth - filtersWidth - 2 * gap;
  return fieldWidth < PHONE_SEARCH_MIN_WIDTH + FIT_TOLERANCE_PX;
}

/**
 * Room a line fit leaves spare, so a part drops a little before the line is
 * exactly full and real glyphs never crowd the line's end.
 */
export const LINE_FIT_TOLERANCE = 16;

export interface LineFitInput<Part extends string> {
  /** The line's inner width. */
  available: number;
  /** Widths of the parts that never drop, at their full width. */
  keptWidths: readonly number[];
  /** Each droppable part's width, any leading separator included. */
  partWidths: Readonly<Record<Part, number>>;
  /** The droppable parts, the first to drop first. */
  dropOrder: readonly Part[];
  /** The gap between the parts that lead the line. */
  gap: number;
  /**
   * Droppable parts in a right-anchored group at the line's end instead of
   * after the kept parts. The group takes no room once all its parts drop.
   */
  trailing?: LineFitTrailingGroup<Part> | undefined;
}

/** A right-anchored group of droppable parts at a line's end. */
export interface LineFitTrailingGroup<Part extends string> {
  /** The group's parts, in display order. */
  parts: readonly Part[];
  /** The gap between the group's parts. */
  gap: number;
  /** The least room between the leading parts and the group. */
  groupGap: number;
}

/**
 * Which droppable parts of a one-line row stay shown (issues-list §3.9):
 * parts drop one at a time in `dropOrder` until the line fits with
 * `LINE_FIT_TOLERANCE` to spare. When the kept parts alone still do not fit,
 * every droppable part is gone and the component truncates what remains.
 */
export function fitLineParts<Part extends string>({
  available,
  keptWidths,
  partWidths,
  dropOrder,
  gap,
  trailing,
}: LineFitInput<Part>): ReadonlySet<Part> {
  const shown = new Set(dropOrder);
  const room = available - LINE_FIT_TOLERANCE;
  const trailingParts = trailing?.parts ?? [];
  const widthsOf = (parts: readonly Part[]): number[] =>
    parts.filter((part) => shown.has(part)).map((part) => partWidths[part]);
  const lineWidth = (): number => {
    const leading = rowWidth(
      [
        ...keptWidths,
        ...widthsOf(dropOrder.filter((part) => !trailingParts.includes(part))),
      ],
      gap
    );
    const trailingWidths = widthsOf(trailingParts);
    if (!trailing || trailingWidths.length === 0) return leading;
    return leading + trailing.groupGap + rowWidth(trailingWidths, trailing.gap);
  };
  for (const part of dropOrder) {
    if (lineWidth() <= room) break;
    shown.delete(part);
  }
  return shown;
}
