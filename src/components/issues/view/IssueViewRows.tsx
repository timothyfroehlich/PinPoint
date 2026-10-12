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
    <ul aria-label="Issues" className="divide-y divide-outline-variant">
      {rows.map((issue) => (
        <IssueListEntry key={issue.id} issue={issue} />
      ))}
    </ul>
  );
}
