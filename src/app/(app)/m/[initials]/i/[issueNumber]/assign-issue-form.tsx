"use client";

import type React from "react";
import { useActionState, useEffect, startTransition } from "react";
import { toast } from "sonner";
import {
  assignIssueAction,
  type AssignIssueResult,
} from "~/app/(app)/issues/actions";
import {
  AssigneeInitial,
  AssigneePicker,
} from "~/components/issues/AssigneePicker";
import { FieldRowStatic } from "~/components/issues/fields/IssueFieldRow";
import {
  checkPermission,
  type OwnershipContext,
} from "~/lib/permissions/helpers";
import { type AccessLevel } from "~/lib/permissions/matrix";

interface AssignIssueFormProps {
  issueId: string;
  assignedToId: string | null;
  users: { id: string; name: string }[];
  currentUserId?: string | null;
  accessLevel: AccessLevel;
  ownershipContext: OwnershipContext;
}

/** The Assignee row in the issue's Details (spec issue-detail §9.4). */
export function AssignIssueForm({
  issueId,
  assignedToId,
  users,
  currentUserId = null,
  accessLevel,
  ownershipContext,
}: AssignIssueFormProps): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<
    AssignIssueResult | undefined,
    FormData
  >(assignIssueAction, undefined);

  useEffect(() => {
    if (state && !state.ok) {
      toast.error(state.message);
    }
  }, [state]);

  const canAssign = checkPermission(
    "issues.update.triage",
    accessLevel,
    ownershipContext
  );

  if (!canAssign) {
    const assignedName =
      users.find((user) => user.id === assignedToId)?.name ?? null;
    return (
      <FieldRowStatic
        label="Assignee"
        value={{
          label: assignedName ?? "Unassigned",
          muted: assignedName === null,
          leading: <AssigneeInitial name={assignedName} />,
        }}
        testId="assignee-readonly"
      />
    );
  }

  return (
    <AssigneePicker
      assignedToId={assignedToId}
      users={users}
      currentUserId={currentUserId}
      isPending={isPending}
      onAssign={(userId) => {
        const formData = new FormData();
        formData.append("issueId", issueId);
        formData.append("assignedTo", userId ?? "");
        startTransition(() => {
          formAction(formData);
        });
      }}
    />
  );
}
