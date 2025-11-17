"use client";

/**
 * Issue Actions Component (Client Component)
 *
 * Provides action buttons/dropdowns for:
 * - Updating issue status
 * - Updating issue severity
 * - Assigning issue to a user
 */

import type React from "react";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Label } from "~/components/ui/label";
import type { Issue, UserProfile } from "~/lib/types";
import {
  updateIssueStatusAction,
  updateIssueSeverityAction,
  assignIssueAction,
} from "~/app/(app)/issues/actions";

interface IssueActionsProps {
  issue: Issue;
  users: { id: string; name: string }[];
  assignedUser: UserProfile | null;
}

export function IssueActions({
  issue,
  users,
  assignedUser,
}: IssueActionsProps): React.JSX.Element {
  const [isPending, startTransition] = useTransition();

  const handleStatusChange = (value: string): void => {
    startTransition(async () => {
      await updateIssueStatusAction(
        issue.id,
        value as "new" | "in_progress" | "resolved"
      );
    });
  };

  const handleSeverityChange = (value: string): void => {
    startTransition(async () => {
      await updateIssueSeverityAction(
        issue.id,
        value as "minor" | "playable" | "unplayable"
      );
    });
  };

  const handleAssigneeChange = (value: string): void => {
    startTransition(async () => {
      await assignIssueAction(issue.id, value === "unassigned" ? null : value);
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Status Selector */}
      <div className="space-y-2">
        <Label htmlFor="status" className="text-sm font-medium text-on-surface">
          Status
        </Label>
        <Select
          value={issue.status}
          onValueChange={handleStatusChange}
          disabled={isPending}
        >
          <SelectTrigger id="status" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Severity Selector */}
      <div className="space-y-2">
        <Label
          htmlFor="severity"
          className="text-sm font-medium text-on-surface"
        >
          Severity
        </Label>
        <Select
          value={issue.severity}
          onValueChange={handleSeverityChange}
          disabled={isPending}
        >
          <SelectTrigger id="severity" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="minor">Minor</SelectItem>
            <SelectItem value="playable">Playable</SelectItem>
            <SelectItem value="unplayable">Unplayable</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Assignee Selector */}
      <div className="space-y-2">
        <Label
          htmlFor="assignee"
          className="text-sm font-medium text-on-surface"
        >
          Assignee
        </Label>
        <Select
          value={assignedUser?.id ?? "unassigned"}
          onValueChange={handleAssigneeChange}
          disabled={isPending}
        >
          <SelectTrigger id="assignee" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Loading indicator */}
      {isPending && (
        <div className="col-span-full">
          <p className="text-sm text-on-surface-variant text-center">
            Updating...
          </p>
        </div>
      )}
    </div>
  );
}
