"use client";

import type React from "react";
import { useActionState } from "react";
import { assignIssueAction, type AssignIssueResult } from "~/app/(app)/issues/actions";
import { AssigneePicker } from "~/components/issues/AssigneePicker";

interface AssignIssueFormProps {
  issueId: string;
  assignedToId: string | null;
  users: { id: string; name: string; email: string | null }[];
}

export function AssignIssueForm({
  issueId,
  assignedToId,
  users,
}: AssignIssueFormProps): React.JSX.Element {
  const [state, formAction] = useActionState<AssignIssueResult, FormData>(
    assignIssueAction,
    undefined
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="issueId" value={issueId} />
      <AssigneePicker
        assignedToId={assignedToId}
        users={users}
        onAssign={(userId) => {
          const formData = new FormData();
          formData.append("issueId", issueId);
          formData.append("assignedTo", userId ?? "");
          formAction(formData);
        }}
      />
      {state && !state.ok && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}
    </form>
  );
}
