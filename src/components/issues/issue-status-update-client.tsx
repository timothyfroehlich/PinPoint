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

// Mock status options - in real implementation, these would come from props or a hook
const DEFAULT_STATUS_OPTIONS = [
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

// Placeholder action - will be replaced with actual Server Action
async function updateIssueStatusAction(
  issueId: string,
  _prevState: unknown,
  formData: FormData,
) {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const newStatusId = formData.get("statusId") as string;
  const selectedStatus = DEFAULT_STATUS_OPTIONS.find(
    (s) => s.id === newStatusId,
  );

  if (!selectedStatus) {
    return { error: "Invalid status selected" };
  }

  // In real implementation, this would update the database via Server Action
  console.log(`Would update issue ${issueId} to status ${selectedStatus.name}`);

  return {
    success: true,
    message: `Status updated to ${selectedStatus.name}`,
    newStatus: selectedStatus,
  };
}

export function IssueStatusUpdateClient({
  issueId,
  currentStatusId,
  currentStatusName,
  availableStatuses,
}: IssueStatusUpdateClientProps) {
  const statusOptions = availableStatuses ?? DEFAULT_STATUS_OPTIONS;

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

      {state?.error && <p className="text-error text-sm">{state.error}</p>}

      {state?.success && (
        <p className="text-tertiary text-sm">✅ {state.message}</p>
      )}

      <Button type="submit" disabled={isPending} size="sm" className="w-full">
        {isPending ? "Updating..." : "Update Status"}
      </Button>
    </form>
  );
}
