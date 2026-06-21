import React from "react";
import { isToday } from "date-fns";
import { Activity } from "lucide-react";

import { EmptyState } from "~/components/ui/empty-state";
import { TimelineRow } from "~/components/machines/timeline/TimelineRow";
import { bucketTimelineRows } from "~/lib/timeline/bucket-rows";
import {
  getUserTimeline,
  resolveFeedMachineLabels,
  PROFILE_FEED_LIMIT_MOBILE,
} from "~/lib/profiles/queries";

export async function ProfileActivityFeed({
  userId,
}: {
  userId: string;
}): Promise<React.JSX.Element> {
  const rows = await getUserTimeline(userId);
  const labels = await resolveFeedMachineLabels(rows);
  const groups = bucketTimelineRows(rows);
  // Mobile caps the feed at PROFILE_FEED_LIMIT_MOBILE; the extra desktop rows
  // stay in the DOM and reveal at the `@lg` container width.
  const mobileHiddenIds = new Set(
    rows.slice(PROFILE_FEED_LIMIT_MOBILE).map((r) => r.id)
  );

  return (
    <section aria-labelledby="profile-activity-heading">
      <h2
        id="profile-activity-heading"
        className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
      >
        Recent activity
      </h2>
      {rows.length === 0 ? (
        <div className="mt-2">
          <EmptyState
            variant="bare"
            icon={Activity}
            title="No activity yet"
            description="Notes, reports, and updates will show up here."
          />
        </div>
      ) : (
        <div className="mt-2 flex flex-col">
          {groups.map((group) => {
            const first = group.entries[0];
            const showRelativeTime =
              group.bucket.tier === "day" &&
              first !== undefined &&
              isToday(first.row.createdAt);
            return (
              <div key={group.bucket.key}>
                {group.entries.map((entry) => {
                  const label = entry.row.machineId
                    ? labels.get(entry.row.machineId)
                    : undefined;
                  const row = (
                    <TimelineRow
                      row={entry.row}
                      showRelativeTime={showRelativeTime}
                      rowDateLabel={entry.bucket.rowDateLabel}
                      commentCanEdit={false}
                      commentCanDelete={false}
                      {...(label
                        ? {
                            machineLabel: {
                              name: label.name,
                              href: label.href,
                            },
                            machineInitials: label.initials,
                          }
                        : {})}
                    />
                  );
                  return mobileHiddenIds.has(entry.row.id) ? (
                    <div key={entry.row.id} className="hidden @lg:block">
                      {row}
                    </div>
                  ) : (
                    <React.Fragment key={entry.row.id}>{row}</React.Fragment>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
