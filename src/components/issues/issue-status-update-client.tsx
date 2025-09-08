"use client";

import { useActionState } from "react";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { updateIssueStatusAction } from "~/lib/actions/issue-actions";

interface IssueStatusUpdateClientProps {
  issueId: string;
  currentStatusId: string;
  currentStatusName: string;
  availableStatuses?: {
    id: string;
    name: string;
    category: "NEW" | "IN_PROGRESS" | "RESOLVED";
  }[];
}

// Fallback status options - used only if availableStatuses prop is not provided
const FALLBACK_STATUS_OPTIONS = [
  { id: "status-new", name: "Open", category: "NEW" as const },
  {
    id: "status-investigating",
    name: "Investigating",
    category: "IN_PROGRESS" as const,
  },
  {
    id: "status-in-progress",
    name: "In Progress",
    category: "IN_PROGRESS" as const,
  },
  {
    id: "status-testing",
    name: "Testing Fix",
    category: "IN_PROGRESS" as const,
  },
  { id: "status-resolved", name: "Resolved", category: "RESOLVED" as const },
  { id: "status-closed", name: "Closed", category: "RESOLVED" as const },
];

export function IssueStatusUpdateClient({
  issueId,
  currentStatusId,
  currentStatusName,
  availableStatuses,
}: IssueStatusUpdateClientProps): JSX.Element {
  const statusOptions = availableStatuses ?? FALLBACK_STATUS_OPTIONS;

  const [state, formAction, isPending] = useActionState(
    updateIssueStatusAction.bind(null, issueId),
    null,
  );

  return (
    <form action={formAction} className="space-y-3">
      <Select
        name="statusId"
        defaultValue={currentStatusId}
        disabled={isPending}
      >
        <SelectTrigger>
          <SelectValue placeholder={currentStatusName} />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((status) => (
            <SelectItem key={status.id} value={status.id}>
              {status.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {state && !state.success && (
        <p className="text-error text-sm">{state.error}</p>
      )}

      {state && state.success && (
        <p className="text-tertiary text-sm">✅ Status updated successfully</p>
      )}

      <Button type="submit" disabled={isPending} size="sm" className="w-full">
        {isPending ? "Updating..." : "Update Status"}
      </Button>
    </form>
  );
}
