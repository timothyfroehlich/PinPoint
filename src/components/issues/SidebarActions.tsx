"use client";

import type React from "react";
import { useTransition } from "react";
import { assignIssueAction } from "~/app/(app)/issues/actions";

import { type IssueWithAllRelations } from "~/lib/types";
import { AssigneePicker } from "~/components/issues/AssigneePicker";

interface SidebarActionsProps {
  issue: IssueWithAllRelations;
  allUsers: { id: string; name: string; email: string | null }[];
}

export function SidebarActions({
  issue,
  allUsers,
}: SidebarActionsProps): React.JSX.Element {
  const [isPending, startTransition] = useTransition();
  return (
    <div>
      <div className="text-xs font-semibold text-on-surface-variant mb-2">
        Assignee
      </div>
      <AssigneePicker
        assignedToId={issue.assignedTo ?? null}
        users={allUsers}
        isPending={isPending}
        onAssign={(userId) => {
          startTransition(async () => {
            const formData = new FormData();
            formData.append("issueId", issue.id);
            formData.append("assignedTo", userId ?? "");
            await assignIssueAction(formData);
          });
        }}
      />
    </div>
  );
}
