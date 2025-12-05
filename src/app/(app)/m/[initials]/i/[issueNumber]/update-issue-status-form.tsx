"use client";

import type React from "react";
import { useActionState } from "react";
import { Button } from "~/components/ui/button";
import {
  updateIssueStatusAction,
  type UpdateIssueStatusResult,
} from "~/app/(app)/issues/actions";
import { type IssueStatus } from "~/lib/types";

interface UpdateIssueStatusFormProps {
  issueId: string;
  currentStatus: IssueStatus;
}

const statusOptions: IssueStatus[] = ["new", "in_progress", "resolved"];

export function UpdateIssueStatusForm({
  issueId,
  currentStatus,
}: UpdateIssueStatusFormProps): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<
    UpdateIssueStatusResult | undefined,
    FormData
  >(updateIssueStatusAction, undefined);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="issueId" value={issueId} />
      <select
        name="status"
        defaultValue={currentStatus}
        className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
        data-testid="issue-status-select"
      >
        {statusOptions.map((status) => (
          <option
            key={status}
            value={status}
            data-testid={`status-option-${status}`}
          >
            {status === "in_progress"
              ? "In Progress"
              : status.charAt(0).toUpperCase() + status.slice(1)}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" className="w-full" disabled={isPending}>
        {isPending ? "Updating..." : "Update Status"}
      </Button>
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
