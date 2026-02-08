"use client";

import type React from "react";
import { useState, useTransition } from "react";
import {
  assignIssueAction,
  type AssignIssueResult,
} from "~/app/(app)/issues/actions";
import { AssigneePicker } from "~/components/issues/AssigneePicker";

interface AssignIssueFormProps {
  issueId: string;
  assignedToId: string | null;
  users: { id: string; name: string }[];
}

export function AssignIssueForm({
  issueId,
  assignedToId,
  users,
}: AssignIssueFormProps): React.JSX.Element {
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<AssignIssueResult | undefined>(undefined);

  return (
    <div>
      <AssigneePicker
        assignedToId={assignedToId}
        users={users}
        isPending={isPending}
        onAssign={(userId) => {
          const formData = new FormData();
          formData.append("issueId", issueId);
          formData.append("assignedTo", userId ?? "");
          startTransition(async () => {
            const result = await assignIssueAction(undefined, formData);
            setState(result);
          });
        }}
      />
      {state && !state.ok && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}
    </div>
  );
}
