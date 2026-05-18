import type React from "react";

import { formatRelative } from "~/lib/dates";

interface Props {
  deletedByName: string | null;
  deletedAt: Date;
}

/**
 * Placeholder row for a soft-deleted timeline comment.
 *
 * Shows who deleted the comment and when. Server-renderable.
 * Email privacy (AGENTS.md rule 10): only the deleter's display name is
 * rendered; email is never accepted or displayed.
 */
export function MachineTimelineTombstoneRow({
  deletedByName,
  deletedAt,
}: Props): React.JSX.Element {
  return (
    <div className="border-b py-1.5 text-xs italic text-muted-foreground">
      Comment deleted by {deletedByName ?? "an admin"} ·{" "}
      {formatRelative(deletedAt)}
    </div>
  );
}
