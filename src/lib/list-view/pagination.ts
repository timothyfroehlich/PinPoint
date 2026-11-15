/**
 * Page arithmetic shared by every List View pager (spec list-views.md §6,
 * §7.8, §8.3). Pages are numbered from 1; a page past the end reads as the
 * last page (§6.3).
 */

export interface PageRange {
  /** The page shown, clamped to 1…pageCount. */
  page: number;
  pageCount: number;
  /** First record on the page, 1-based; 0 when there are no records. */
  start: number;
  /** Last record on the page; 0 when there are no records. */
  end: number;
  total: number;
}

export function getPageRange(
  page: number,
  pageSize: number,
  total: number
): PageRange {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const clamped = Math.min(Math.max(1, Math.trunc(page)), pageCount);
  if (total === 0) {
    return { page: 1, pageCount: 1, start: 0, end: 0, total: 0 };
  }
  const start = (clamped - 1) * pageSize + 1;
  return {
    page: clamped,
    pageCount,
    start,
    end: Math.min(clamped * pageSize, total),
    total,
  };
}

/** The visible range, as "1–25" (en dash); empty lists read "0". */
export function formatPageSpan(range: PageRange): string {
  return range.total === 0 ? "0" : `${range.start}–${range.end}`;
}

export type PagerItem =
  { kind: "page"; page: number } | { kind: "gap"; key: "start" | "end" };

/**
 * The page numbers the full pager shows (§6.1): the first and last pages,
 * the current page with one neighbor on each side, and a gap wherever pages
 * are skipped. A gap never stands in for a single page.
 */
export function getPagerItems(page: number, pageCount: number): PagerItem[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => ({
      kind: "page" as const,
      page: index + 1,
    }));
  }
  const current = Math.min(Math.max(1, page), pageCount);
  let from = Math.max(2, current - 1);
  let to = Math.min(pageCount - 1, current + 1);
  // Keep five numbered slots between the ends so the pager width is steady.
  if (current <= 3) to = 5;
  if (current >= pageCount - 2) from = pageCount - 4;
  if (from === 3) from = 2;
  if (to === pageCount - 2) to = pageCount - 1;
  const items: PagerItem[] = [{ kind: "page", page: 1 }];
  if (from > 2) items.push({ kind: "gap", key: "start" });
  for (let value = from; value <= to; value += 1) {
    items.push({ kind: "page", page: value });
  }
  if (to < pageCount - 1) items.push({ kind: "gap", key: "end" });
  items.push({ kind: "page", page: pageCount });
  return items;
}
