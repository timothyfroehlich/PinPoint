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
import { updateIssueAssignmentAction } from "~/lib/actions/issue-actions";

interface IssueAssignmentClientProps {
  issueId: string;
  currentAssigneeId?: string;
  currentAssigneeName?: string;
  availableUsers?: {
    id: string;
    name: string;
    email: string;
  }[];
}

// Mock user options - in real implementation, these would come from organization members
const DEFAULT_USER_OPTIONS = [
  { id: "unassigned", name: "Unassigned", email: "" },
  {
    id: "test-user-tim",
    name: "Tim Froehlich",
    email: "tim@austinpinball.com",
  },
  { id: "test-user-tech1", name: "Tech User", email: "tech@austinpinball.com" },
  {
    id: "test-user-manager",
    name: "Manager User",
    email: "manager@austinpinball.com",
  },
];

export function IssueAssignmentClient({
  issueId,
  currentAssigneeId,
  currentAssigneeName,
  availableUsers,
}: IssueAssignmentClientProps) {
  const userOptions = availableUsers || DEFAULT_USER_OPTIONS;

  const [state, formAction, isPending] = useActionState(
    updateIssueAssignmentAction.bind(null, issueId),
    null,
  );

  return (
    <form action={formAction} className="space-y-3">
      <Select
        name="assigneeId"
        defaultValue={currentAssigneeId || "unassigned"}
        disabled={isPending}
      >
        <SelectTrigger>
          <SelectValue placeholder={currentAssigneeName || "Unassigned"} />
        </SelectTrigger>
        <SelectContent>
          {userOptions.map((user) => (
            <SelectItem 
              key={user.id} 
              value={user.id === "unassigned" ? "" : user.id}
            >
              {user.name}
              {user.email && (
                <span className="text-xs text-muted-foreground ml-1">
                  ({user.email})
                </span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {state && !state.success && (
        <p className="text-red-600 text-sm">
          {state.error || "Failed to update assignment"}
        </p>
      )}

      {state && state.success && (
        <p className="text-green-600 text-sm">✅ Assignment updated successfully</p>
      )}

      <Button type="submit" disabled={isPending} size="sm" className="w-full">
        {isPending ? "Updating..." : "Update Assignment"}
      </Button>
    </form>
  );
}
