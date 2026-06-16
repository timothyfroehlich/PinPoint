import { formatTimelineBucket, type TimelineBucket } from "~/lib/dates";

export interface TimelineRowGroup<T> {
  bucket: TimelineBucket;
  /** Each entry carries its own bucket so month-tier rows can render an
   *  inline date chip without re-deriving it. */
  entries: { row: T; bucket: TimelineBucket }[];
}

/**
 * Group already-sorted timeline rows into consecutive day/month buckets
 * (PP-0x98 V2): last 7 days → per-day buckets ("Today"/"Yesterday"/weekday),
 * older → per-month buckets ("May 2026"). Shared by the per-machine and
 * collection timeline pages.
 *
 * Groups on the bucket `key`, never the label — labels like "Tuesday" collide
 * across distant weeks inside one rendered page, so they can't be the grouping
 * key. Rows are assumed already ordered newest-first by the query.
 */
export function bucketTimelineRows<T extends { createdAt: Date }>(
  rows: readonly T[]
): TimelineRowGroup<T>[] {
  const groups: TimelineRowGroup<T>[] = [];
  for (const row of rows) {
    const bucket = formatTimelineBucket(row.createdAt);
    const last = groups[groups.length - 1];
    if (last?.bucket.key === bucket.key) {
      last.entries.push({ row, bucket });
    } else {
      groups.push({ bucket, entries: [{ row, bucket }] });
    }
  }
  return groups;
}
