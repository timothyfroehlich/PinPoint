/** The narrowest a Summary Widget may be, in px (widgets §2.3). */
export const SUMMARY_WIDGET_MIN_WIDTH_PX = 240;

/** The space between neighboring Summary Widgets, in px (`gap-6`). */
export const SUMMARY_WIDGET_GAP_PX = 24;

/**
 * The narrowest row, in px, that holds `count` Summary Widgets side by side
 * at their minimum width (widgets §2.3, §2.7).
 */
export function summaryRowMinWidth(count: number): number {
  return (
    count * SUMMARY_WIDGET_MIN_WIDTH_PX +
    Math.max(0, count - 1) * SUMMARY_WIDGET_GAP_PX
  );
}

/**
 * Each widget's slot in the group's row, in the host's order. A slot shows
 * only while its container query says the row holds that many widgets, so
 * whole widgets drop from the right, last first, and never shrink below
 * 240px, stack, or wrap (widgets §2.7). The row is the query container, so
 * the thresholds are `summaryRowMinWidth(n)`: 240, 504, and 768px. Container
 * queries, not measurement: the rule is fixed widths, which CSS expresses
 * on the first paint with no script (CORE-RESP-002). Static class names, so
 * Tailwind generates them.
 */
export const SUMMARY_WIDGET_SLOT_CLASSES = [
  "hidden @min-[240px]:block",
  "hidden @min-[504px]:block",
  "hidden @min-[768px]:block",
] as const;
