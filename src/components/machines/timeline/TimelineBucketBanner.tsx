import type React from "react";

import type { TimelineBucket } from "~/lib/dates";

/**
 * Sticky section-divider banner for a timeline day/month bucket. Bold
 * green-rail strip that reads unambiguously as a section divider rather than a
 * label for the row directly below it. Same treatment for day-tier ("Today",
 * "Yesterday", "Monday") and month-tier ("May 2026") buckets — design decision
 * PP-0x98 round 2. Shared by the per-machine and collection timeline pages so
 * the two feeds stay visually identical.
 *
 * `top-0`, NOT `top-14`: the sticky scroll container is MainLayout's
 * `<main overflow-y-auto>`, which already starts below the 56px AppHeader — an
 * extra `top-14` offset double-counts the header and floats the bar mid-page
 * over the rows. No `-mx` bleed: PageContainer is `max-w` + `mx-auto` with no
 * horizontal padding, so a negative-margin bleed overshoots the centered
 * content box.
 */
export function TimelineBucketBanner({
  bucket,
}: {
  bucket: TimelineBucket;
}): React.JSX.Element {
  return (
    <div
      className="sticky top-0 z-10 mb-3 border-l-[3px] border-primary bg-gradient-to-r from-card to-background px-3 py-2"
      data-bucket-tier={bucket.tier}
    >
      <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {bucket.label}
      </h3>
    </div>
  );
}
