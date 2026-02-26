"use client";

import type React from "react";
import { useActionState } from "react";
import {
  assignIssueAction,
  type AssignIssueResult,
} from "~/app/(app)/issues/actions";
import { AssigneePicker } from "~/components/issues/AssigneePicker";
import {
  getPermissionDeniedReason,
  getPermissionState,
  type OwnershipContext,
} from "~/lib/permissions/helpers";
import { type AccessLevel } from "~/lib/permissions/matrix";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

interface AssignIssueFormProps {
  issueId: string;
  assignedToId: string | null;
  users: { id: string; name: string }[];
  currentUserId?: string | null;
  accessLevel: AccessLevel;
  ownershipContext: OwnershipContext;
}

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
  const permissionState = getPermissionState(
    "issues.update.assignee",
    accessLevel,
    ownershipContext
  );
  const deniedReason = permissionState.allowed
    ? null
    : getPermissionDeniedReason(
        "issues.update.assignee",
        accessLevel,
        ownershipContext
      );
  const assignedUserName =
    users.find((user) => user.id === assignedToId)?.name ?? "Unassigned";

  if (
    !permissionState.allowed &&
    permissionState.reason === "unauthenticated"
  ) {
    return (
      <div
        className="rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
        data-testid="assignee-readonly"
      >
        {assignedUserName}
      </div>
    );
  }

  const picker = (
    <AssigneePicker
      assignedToId={assignedToId}
      users={users}
      currentUserId={currentUserId}
      isPending={isPending}
      disabled={!permissionState.allowed}
      disabledReason={deniedReason}
      onAssign={(userId) => {
        const formData = new FormData();
        formData.append("issueId", issueId);
        formData.append("assignedTo", userId ?? "");
        formAction(formData);
      }}
    />
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="issueId" value={issueId} />
      {permissionState.allowed ? (
        picker
      ) : (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{picker}</TooltipTrigger>
            <TooltipContent>{deniedReason}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {state && !state.ok && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}
    </form>
  );
}
