/**
 * The activity summary's event catalog and schedule vocabulary
 * (discord-activity-summary spec §2, §3.1, §4).
 *
 * Pure and client-safe: the settings form, the save action's validation, and
 * the schema default all read these, so the keys, the order, and the defaults
 * live in one place.
 */

/** Every event type, in display order. Stored in `summary_events`. */
export const ACTIVITY_SUMMARY_EVENT_KEYS = [
  "issues_opened",
  "issues_closed",
  "issue_progress",
  "severity_changes",
  "assignments",
  "comment_counts",
  "machine_status",
  "availability",
  "new_machines",
  "owner_changes",
  "pinball_map_sync",
  "pinball_map_comments",
  "new_members",
] as const;

export type ActivitySummaryEventKey =
  (typeof ACTIVITY_SUMMARY_EVENT_KEYS)[number];

/** The event types on by default (spec §4.1), in display order. */
export const DEFAULT_ACTIVITY_SUMMARY_EVENTS = [
  "issues_opened",
  "issues_closed",
  "machine_status",
  "availability",
  "new_machines",
  "pinball_map_sync",
] as const satisfies readonly ActivitySummaryEventKey[];

export interface ActivitySummaryEventGroup {
  id: "issues" | "machines" | "pinball_map" | "people";
  label: string;
  events: readonly { key: ActivitySummaryEventKey; label: string }[];
}

/** The settings form's grouping and labels (approved layout "A"). */
export const ACTIVITY_SUMMARY_EVENT_GROUPS: readonly ActivitySummaryEventGroup[] =
  [
    {
      id: "issues",
      label: "Issues",
      events: [
        { key: "issues_opened", label: "Issues opened" },
        { key: "issues_closed", label: "Issues closed" },
        { key: "issue_progress", label: "Issue progress" },
        { key: "severity_changes", label: "Severity changes" },
        { key: "assignments", label: "Assignments" },
        { key: "comment_counts", label: "Comment counts" },
      ],
    },
    {
      id: "machines",
      label: "Machines",
      events: [
        { key: "machine_status", label: "Machine status" },
        { key: "availability", label: "Availability" },
        { key: "new_machines", label: "New machines" },
        { key: "owner_changes", label: "Owner changes" },
      ],
    },
    {
      id: "pinball_map",
      label: "Pinball Map",
      events: [
        { key: "pinball_map_sync", label: "Out of sync" },
        { key: "pinball_map_comments", label: "Pinball Map comments" },
      ],
    },
    {
      id: "people",
      label: "People",
      events: [{ key: "new_members", label: "New members" }],
    },
  ];

export function isActivitySummaryEventKey(
  value: string
): value is ActivitySummaryEventKey {
  return (ACTIVITY_SUMMARY_EVENT_KEYS as readonly string[]).includes(value);
}

/** Interval lengths in hours (spec §1). Null is Disabled. */
export const ACTIVITY_SUMMARY_INTERVAL_HOURS = [24, 12, 6, 4, 2, 1] as const;

export type ActivitySummaryIntervalHours =
  (typeof ACTIVITY_SUMMARY_INTERVAL_HOURS)[number];

export function isActivitySummaryIntervalHours(
  value: number
): value is ActivitySummaryIntervalHours {
  return (ACTIVITY_SUMMARY_INTERVAL_HOURS as readonly number[]).includes(value);
}

export const DEFAULT_ACTIVITY_SUMMARY_INTERVAL_HOURS: ActivitySummaryIntervalHours = 24;
/** 6 PM Central (spec §2.2). */
export const DEFAULT_ACTIVITY_SUMMARY_START_HOUR = 18;

/** Interval select options, longest first, then Disabled. */
export const ACTIVITY_SUMMARY_INTERVAL_OPTIONS: readonly {
  value: ActivitySummaryIntervalHours | null;
  label: string;
}[] = [
  { value: 24, label: "Every 24 hours" },
  { value: 12, label: "Every 12 hours" },
  { value: 6, label: "Every 6 hours" },
  { value: 4, label: "Every 4 hours" },
  { value: 2, label: "Every 2 hours" },
  { value: 1, label: "Every hour" },
  { value: null, label: "Disabled" },
];

/** "12 AM", "1 AM", … "12 PM", … "11 PM". */
export function formatCentralHour(hour: number): string {
  const suffix = hour < 12 ? "AM" : "PM";
  const clock = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(clock)} ${suffix}`;
}

/** The line under the schedule selects naming when summaries post. */
export function describeSchedule(
  intervalHours: number | null,
  startHour: number
): string {
  if (intervalHours === null) return "Off. No summaries post.";
  if (intervalHours === 24) {
    return `Posts daily at ${formatCentralHour(startHour)} Central.`;
  }
  if (intervalHours === 1)
    return "Posts every hour, on the hour, Central time.";

  const hours: number[] = [];
  for (let offset = 0; offset < 24; offset += intervalHours) {
    hours.push((startHour + offset) % 24);
  }
  hours.sort((a, b) => a - b);
  return `Posts at ${hours.map(formatCentralHour).join(", ")} Central.`;
}
