"use client";

import type React from "react";
import { useTransition } from "react";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  updateIssueStatusAction,
  updateIssueSeverityAction,
  updateIssuePriorityAction,
  assignIssueAction,
} from "~/app/(app)/issues/actions";

import { type IssueWithAllRelations } from "~/lib/types";
import { AssigneePicker } from "~/components/issues/AssigneePicker";

interface SidebarActionsProps {
  issue: IssueWithAllRelations;
  allUsers: { id: string; name: string; email: string | null }[];
}

export function SidebarActions({
  issue,
  allUsers,
}: SidebarActionsProps): React.JSX.Element {
  const [isPending, startTransition] = useTransition();
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Assignee</Label>
        <AssigneePicker
          assignedToId={issue.assignedTo ?? null}
          users={allUsers}
          isPending={isPending}
          onAssign={(userId) => {
            startTransition(async () => {
              const formData = new FormData();
              formData.append("issueId", issue.id);
              formData.append("assignedTo", userId ?? "");
              await assignIssueAction(formData);
            });
          }}
        />
      </div>
      {/* Update Status */}
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Status</Label>
        <Select
          name="status"
          defaultValue={issue.status}
          onValueChange={(value) => {
            startTransition(async () => {
              const formData = new FormData();
              formData.append("issueId", issue.id);
              formData.append("status", value);
              await updateIssueStatusAction(formData);
            });
          }}
          disabled={isPending}
        >
          <SelectTrigger className="w-full" data-testid="issue-status-select">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new" data-testid="status-option-new">
              New
            </SelectItem>
            <SelectItem
              value="in_progress"
              data-testid="status-option-in_progress"
            >
              In Progress
            </SelectItem>
            <SelectItem value="resolved" data-testid="status-option-resolved">
              Resolved
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Update Severity */}
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Severity</Label>
        <Select
          name="severity"
          defaultValue={issue.severity}
          onValueChange={(value) => {
            startTransition(async () => {
              const formData = new FormData();
              formData.append("issueId", issue.id);
              formData.append("severity", value);
              await updateIssueSeverityAction(formData);
            });
          }}
          disabled={isPending}
        >
          <SelectTrigger className="w-full" data-testid="issue-severity-select">
            <SelectValue placeholder="Select severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="minor" data-testid="severity-option-minor">
              Minor
            </SelectItem>
            <SelectItem value="playable" data-testid="severity-option-playable">
              Playable
            </SelectItem>
            <SelectItem
              value="unplayable"
              data-testid="severity-option-unplayable"
            >
              Unplayable
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Update Priority */}
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Priority</Label>
        <Select
          name="priority"
          defaultValue={issue.priority}
          onValueChange={(value) => {
            startTransition(async () => {
              const formData = new FormData();
              formData.append("issueId", issue.id);
              formData.append("priority", value);
              await updateIssuePriorityAction(formData);
            });
          }}
          disabled={isPending}
        >
          <SelectTrigger className="w-full" data-testid="issue-priority-select">
            <SelectValue placeholder="Select priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low" data-testid="priority-option-low">
              Low
            </SelectItem>
            <SelectItem value="medium" data-testid="priority-option-medium">
              Medium
            </SelectItem>
            <SelectItem value="high" data-testid="priority-option-high">
              High
            </SelectItem>
            <SelectItem value="critical" data-testid="priority-option-critical">
              Critical
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
