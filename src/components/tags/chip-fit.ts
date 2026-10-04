/**
 * How many chips, in order, fit on one line of `available` pixels. When they
 * do not all fit, room is kept for a trailing "+N" chip `moreWidth` wide. At
 * least one chip always shows; it truncates if it has to.
 */
export function chipsThatFit(
  widths: readonly number[],
  moreWidth: number,
  gap: number,
  available: number
): number {
  const total =
    widths.reduce((sum, width) => sum + width, 0) +
    gap * Math.max(0, widths.length - 1);
  if (total <= available) return widths.length;
  let used = 0;
  for (const [index, width] of widths.entries()) {
    const next = used + (index > 0 ? gap : 0) + width;
    if (next + gap + moreWidth > available) return Math.max(1, index);
    used = next;
  }
  return widths.length;
}
