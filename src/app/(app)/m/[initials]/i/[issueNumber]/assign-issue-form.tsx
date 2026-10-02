"use client";

import type React from "react";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  startTransition,
} from "react";
import { toast } from "sonner";
import {
  assignIssueAction,
  type AssignIssueResult,
} from "~/app/(app)/issues/actions";
import {
  AssigneeInitial,
  AssigneePicker,
} from "~/components/issues/AssigneePicker";
import {
  FieldRowStatic,
  FieldRowWithFeedback,
} from "~/components/issues/fields/IssueFieldRow";
import {
  checkPermission,
  type OwnershipContext,
} from "~/lib/permissions/helpers";
import { type AccessLevel } from "~/lib/permissions/matrix";
import {
  withTransportFailure,
  type TransportFailure,
} from "./transport-failure";

const assignOrFail = withTransportFailure(assignIssueAction);

interface AssignIssueFormProps {
  issueId: string;
  assignedToId: string | null;
  users: { id: string; name: string }[];
  currentUserId?: string | null;
  accessLevel: AccessLevel;
  ownershipContext: OwnershipContext;
}

/**
 * The Assignee row in the issue's Details (spec issue-detail §9.4). A failed
 * save shows as a toast and inline under the row; a successful one is
 * announced to screen readers.
 */
export function AssignIssueForm({
  issueId,
  assignedToId,
  users,
  currentUserId = null,
  accessLevel,
  ownershipContext,
}: AssignIssueFormProps): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<
    AssignIssueResult | TransportFailure | undefined,
    FormData
  >(assignOrFail, undefined);
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Who the in-flight save assigns, as the announcement words it.
  const savingNameRef = useRef<string | null>(null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      if (savingNameRef.current) {
        setAnnouncement(`Assignee changed to ${savingNameRef.current}`);
      }
    } else {
      setError(state.message);
      toast.error(state.message);
    }
    savingNameRef.current = null;
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
    <FieldRowWithFeedback announcement={announcement} error={error}>
      <AssigneePicker
        assignedToId={assignedToId}
        users={users}
        currentUserId={currentUserId}
        isPending={isPending}
        onAssign={(userId) => {
          if (isPending) return;
          setError(null);
          setAnnouncement("");
          savingNameRef.current =
            userId === null
              ? "Unassigned"
              : (users.find((user) => user.id === userId)?.name ?? null);
          const formData = new FormData();
          formData.append("issueId", issueId);
          formData.append("assignedTo", userId ?? "");
          startTransition(() => {
            formAction(formData);
          });
        }}
      />
    </FieldRowWithFeedback>
  );
}
