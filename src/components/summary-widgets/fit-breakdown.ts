/** Sub-pixel rounding slack, so a line that fits exactly is not rolled up. */
const FIT_TOLERANCE_PX = 1;

interface FitBreakdownOptions {
  /** Width the breakdown line has, in px. */
  readonly availableWidth: number;
  /** Measured width of each Segment's "count label" pair, in display order. */
  readonly segmentWidths: readonly number[];
  /** Measured width of the "N other" entry at its widest count. */
  readonly otherWidth: number;
  /** Gap between neighboring entries, in px. */
  readonly gap: number;
}

/**
 * How many leading Segments a Summary Widget breakdown line shows (widgets
 * §5.6). Every Segment shows when the whole line fits. Otherwise the line
 * keeps whole pairs from the start while they fit beside one "N other" entry,
 * and every Segment after them rolls into it. The result can be 0, when not
 * even the first pair fits beside "N other".
 */
export function fitBreakdown({
  availableWidth,
  segmentWidths,
  otherWidth,
  gap,
}: FitBreakdownOptions): number {
  const room = availableWidth + FIT_TOLERANCE_PX;
  const lineWidth = (widths: readonly number[]): number =>
    widths.reduce((sum, width) => sum + width, 0) +
    gap * Math.max(0, widths.length - 1);

  if (lineWidth(segmentWidths) <= room) return segmentWidths.length;

  let shown = 0;
  while (
    shown < segmentWidths.length &&
    lineWidth([...segmentWidths.slice(0, shown + 1), otherWidth]) <= room
  ) {
    shown += 1;
  }
  return shown;
}
