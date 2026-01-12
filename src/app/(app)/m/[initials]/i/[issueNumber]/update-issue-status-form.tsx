"use client";

import type React from "react";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import {
  updateIssueStatusAction,
  type UpdateIssueStatusResult,
} from "~/app/(app)/issues/actions";
import {
  getIssueStatusLabel,
  STATUS_OPTIONS as statusOptions,
} from "~/lib/issues/status";
import type { IssueStatus } from "~/lib/types";

interface UpdateIssueStatusFormProps {
  issueId: string;
  currentStatus: IssueStatus;
}

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
      <div className="relative">
        <select
          name="status"
          defaultValue={currentStatus}
          aria-label="Update Issue Status"
          className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2 pr-10 text-sm text-on-surface disabled:opacity-50"
          data-testid="issue-status-select"
          disabled={isPending}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        >
          {statusOptions.map((status) => (
            <option
              key={status}
              value={status}
              data-testid={`status-option-${status}`}
            >
              {getIssueStatusLabel(status)}
            </option>
          ))}
        </select>
        {isPending && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
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
