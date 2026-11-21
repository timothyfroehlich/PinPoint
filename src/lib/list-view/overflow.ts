/**
 * Fit rules for a List View between phone and desktop (spec list-views.md
 * §8). Pure arithmetic over measured widths: the components measure their
 * own rendered controls (CORE-RESP-002 boundary — ResizeObserver on the
 * component, never the viewport) and ask these functions which controls stay
 * inline and which move into an overflow menu. CSS still owns presentation.
 */

/**
 * Room every fit check leaves spare (§8.7), so a step fires a little before
 * its part would overflow and real glyphs never crowd the edge.
 */
export const FIT_TOLERANCE = 16;

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

/** One part of a one-line row, at its full width. */
export interface LineFitPart<Part extends string> {
  key: Part;
  width: number;
  /**
   * Plain text. A "·" separates two plain-text parts that show next to each
   * other in the same group, and nothing else.
   */
  text: boolean;
  /**
   * Makes the part shrinkable: at its turn in the drop order it truncates,
   * down to this width, before it hides. Without it, a part drops whole.
   */
  minWidth?: number;
}

/**
 * How a part shows on the line: at its full width, truncated (narrower than
 * its full width, never below its `minWidth`), or not at all.
 */
export type LinePartFit = "full" | "truncated" | "hidden";

/** The spacing of a one-line row (list-views §8, issues-list §3.9). */
export interface LineFitSpacing {
  /** The gap between the leading group's parts, separators included. */
  gap: number;
  /** The gap between the trailing group's parts. */
  trailingGap: number;
  /** The least room between the leading and the trailing group. */
  groupGap: number;
  /** The width of a "·" separator. */
  separatorWidth: number;
}

export interface LineFitInput<Part extends string> extends LineFitSpacing {
  /** The line's inner width. */
  available: number;
  /** The parts that lead the line, in display order. */
  leading: readonly LineFitPart<Part>[];
  /**
   * The right-anchored group at the line's end, in display order. The group
   * takes no room once none of its parts shows.
   */
  trailing: readonly LineFitPart<Part>[];
  /**
   * The parts that give way for room, the first to give way first. A part
   * with a `minWidth` truncates before it drops.
   */
  dropOrder: readonly Part[];
}

/** One group's width with the parts in `shown`, separators included. */
function groupWidth<Part extends string>(
  parts: readonly LineFitPart<Part>[],
  shown: ReadonlySet<Part>,
  gap: number,
  separatorWidth: number
): number {
  const widths: number[] = [];
  let previousText = false;
  for (const part of parts) {
    if (!shown.has(part.key)) continue;
    if (part.text && previousText) widths.push(separatorWidth);
    widths.push(part.width);
    previousText = part.text;
  }
  return rowWidth(widths, gap);
}

/**
 * How each part of a one-line row shows (machine-views §5.10, issues-list
 * §3.9): the parts in `dropOrder` give way one at a time, in that order,
 * until the line fits with `FIT_TOLERANCE` to spare. A part with a
 * `minWidth` gives way by truncating first: when the line fits with that
 * part narrower but still at least `minWidth` wide, it is truncated and the
 * fit stops; otherwise it hides like any other part, its "·" separator with
 * it. A part outside `dropOrder` never gives way; when those alone still do
 * not fit, every droppable part is gone and the component truncates what
 * remains.
 */
export function planLineParts<Part extends string>({
  available,
  leading,
  trailing,
  dropOrder,
  gap,
  trailingGap,
  groupGap,
  separatorWidth,
}: LineFitInput<Part>): ReadonlyMap<Part, LinePartFit> {
  const parts = new Map<Part, LineFitPart<Part>>(
    [...leading, ...trailing].map((part) => [part.key, part])
  );
  const plan = new Map<Part, LinePartFit>(
    [...parts.keys()].map((key) => [key, "full"])
  );
  const shown = new Set<Part>(parts.keys());
  const room = available - FIT_TOLERANCE;
  const lineWidth = (): number => {
    const lead = groupWidth(leading, shown, gap, separatorWidth);
    const end = groupWidth(trailing, shown, trailingGap, separatorWidth);
    return end === 0 ? lead : lead + groupGap + end;
  };
  for (const key of dropOrder) {
    const overflow = lineWidth() - room;
    if (overflow <= 0) break;
    const part = parts.get(key);
    if (part === undefined) continue;
    if (part.minWidth !== undefined && part.width - overflow >= part.minWidth) {
      plan.set(key, "truncated");
      break;
    }
    shown.delete(key);
    plan.set(key, "hidden");
  }
  return plan;
}

/**
 * The parts of a one-line row that show, at full width or truncated
 * (`planLineParts`).
 */
export function fitLineParts<Part extends string>(
  input: LineFitInput<Part>
): ReadonlySet<Part> {
  const shown = new Set<Part>();
  for (const [key, fit] of planLineParts(input)) {
    if (fit !== "hidden") shown.add(key);
  }
  return shown;
}

/** One page action's width with its label and as an icon button. */
export interface PageActionWidths {
  key: string;
  labeled: number;
  icon: number;
}

export interface PageActionsFitInput {
  /** The width the row gives the page actions. */
  available: number;
  /** The page's actions before ⋯, in display order. */
  actions: readonly PageActionWidths[];
  /** ⋯ with its "Actions" label and as an icon button. */
  more: { labeled: number; icon: number };
  /** Whether ⋯ holds anything of its own before any action folds into it. */
  moreHasItems: boolean;
  /**
   * The page's fold order (list-views §3.9): each step names the actions
   * that fold into ⋯ together, the first step first. An action named in no
   * step never folds.
   */
  foldSteps: readonly (readonly string[])[];
  gap: number;
}

export interface PageActionsPlan {
  /** The actions shown as their own buttons, in display order. */
  shown: string[];
  /** The actions folded into ⋯, in display order. */
  folded: string[];
  /** Every shown button, ⋯ included, shows its label; otherwise all are icons. */
  labeled: boolean;
  /** Whether ⋯ shows: it holds items of its own or a folded action. */
  showMore: boolean;
}

/**
 * Lays out a page's actions (list-views §3.7–§3.9, §8.11, §8.12). Every
 * shown action shows its label while they all fit with the tolerance to
 * spare (§8.7); otherwise every one is an icon button, with no size
 * between. When even the icons do not fit, the next fold step moves its
 * actions into ⋯ and the rest try labels, then icons, again. ⋯ never folds
 * and shows only while it holds something. When nothing fits even after the
 * last step, that step's icons remain.
 */
export function planPageActions({
  available,
  actions,
  more,
  moreHasItems,
  foldSteps,
  gap,
}: PageActionsFitInput): PageActionsPlan {
  const room = available - FIT_TOLERANCE;
  const keys = actions.map((action) => action.key);
  // Each level folds one more step; a step naming no present action adds
  // no level.
  const levels: string[][] = [[]];
  for (const step of foldSteps) {
    const previous = levels[levels.length - 1] ?? [];
    const adds = step.filter(
      (key) => keys.includes(key) && !previous.includes(key)
    );
    if (adds.length > 0) levels.push([...previous, ...adds]);
  }
  let plan: PageActionsPlan = {
    shown: keys,
    folded: [],
    labeled: false,
    showMore: moreHasItems,
  };
  for (const foldedKeys of levels) {
    const shownActions = actions.filter(
      (action) => !foldedKeys.includes(action.key)
    );
    const folded = keys.filter((key) => foldedKeys.includes(key));
    const showMore = moreHasItems || folded.length > 0;
    const width = (labeled: boolean): number =>
      rowWidth(
        [
          ...shownActions.map((action) =>
            labeled ? action.labeled : action.icon
          ),
          ...(showMore ? [labeled ? more.labeled : more.icon] : []),
        ],
        gap
      );
    plan = {
      shown: shownActions.map((action) => action.key),
      folded,
      labeled: false,
      showMore,
    };
    if (width(true) <= room) return { ...plan, labeled: true };
    if (width(false) <= room) return plan;
  }
  return plan;
}
