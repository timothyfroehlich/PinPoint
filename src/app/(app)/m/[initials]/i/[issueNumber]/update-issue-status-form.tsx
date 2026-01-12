"use client";

import type React from "react";
import { useState, useActionState, useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  updateIssueStatusAction,
  type UpdateIssueStatusResult,
} from "~/app/(app)/issues/actions";
import { StatusSelect } from "~/components/issues/fields/StatusSelect";
import type { IssueStatus } from "~/lib/types";

interface UpdateIssueStatusFormProps {
  issueId: string;
  currentStatus: IssueStatus;
}

export function UpdateIssueStatusForm({
  issueId,
  currentStatus,
}: UpdateIssueStatusFormProps): React.JSX.Element {
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedStatus, setSelectedStatus] =
    useState<IssueStatus>(currentStatus);
  const [pendingStatus, setPendingStatus] = useState<IssueStatus | null>(null);
  const [state, formAction, isPending] = useActionState<
    UpdateIssueStatusResult | undefined,
    FormData
  >(updateIssueStatusAction, undefined);

  // Auto-submit form when pending status changes
  useEffect(() => {
    if (pendingStatus !== null && formRef.current) {
      formRef.current.requestSubmit();
      setPendingStatus(null);
    }
  }, [pendingStatus]);

  const handleValueChange = (newStatus: IssueStatus): void => {
    setSelectedStatus(newStatus);
    setPendingStatus(newStatus);
  };

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-2"
      data-form="update-status"
    >
      <input type="hidden" name="issueId" value={issueId} />
      <input type="hidden" name="status" value={selectedStatus} />
      <div className="relative">
        <StatusSelect
          value={selectedStatus}
          onValueChange={handleValueChange}
          disabled={isPending}
        />
        {isPending && (
          <div className="absolute right-10 top-1/2 -translate-y-1/2 pointer-events-none">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
      {state?.ok && (
        <p className="text-sm text-success" data-testid="status-update-success">
          Status updated successfully
        </p>
      )}
      {state && !state.ok && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}
    </form>
  );
}
