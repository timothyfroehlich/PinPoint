import type React from "react";
import { IssueListEntry } from "~/components/issues/IssueListEntry";
import type { IssueListRow } from "~/lib/types";

/**
 * The issue rows (issues-list §3): two lines each, read-only for everyone
 * (§3.11).
 */
export function IssueViewRows({
  rows,
}: {
  rows: readonly IssueListRow[];
}): React.JSX.Element {
  return (
    // Desktop draws a line between rows; phones draw one under every row.
    <ul aria-label="Issues" className="md:divide-y md:divide-border">
      {rows.map((issue) => (
        <IssueListEntry key={issue.id} issue={issue} />
      ))}
    </ul>
  );
}
