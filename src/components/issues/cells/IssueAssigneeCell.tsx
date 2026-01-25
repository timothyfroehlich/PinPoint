"use client";

import * as React from "react";
import { Loader2, CheckCircle2, X } from "lucide-react";
import { cn } from "~/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import type { IssueListItem } from "~/lib/types";

export interface UserOption {
  id: string;
  name: string;
}

interface AssigneeCellProps {
  issue: IssueListItem;
  users: UserOption[];
  onUpdate: (userId: string | null) => void;
  isUpdating: boolean;
}

/**
 * Specialized table cell for issue assignee
 *
 * Renders a dropdown menu that allows assigning the issue to a user or unassigning
 * Shows loading state during updates
 */
export function IssueAssigneeCell({
  issue,
  users,
  onUpdate,
  isUpdating,
}: AssigneeCellProps): React.JSX.Element {
  return (
    <td
      className="p-1 min-w-[150px] max-w-[150px]"
      data-testid="issue-cell-assignee"
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={isUpdating}>
          <button
            className={cn(
              "text-xs font-medium leading-tight hover:bg-muted/80 px-3 py-3 rounded-md transition-colors w-full text-left",
              isUpdating && "opacity-50 cursor-not-allowed"
            )}
          >
            {isUpdating ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 text-muted-foreground" />
                <span>{issue.assignedToUser?.name ?? "Unassigned"}</span>
              </div>
            ) : (
              <span className="line-clamp-2">
                {issue.assignedToUser?.name ?? "Unassigned"}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="min-w-[200px] max-h-[300px] overflow-y-auto"
        >
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Assign To
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => onUpdate(null)}
          >
            <div className="h-4 w-4 rounded-full bg-muted flex items-center justify-center">
              <X className="h-2 w-2 text-muted-foreground" />
            </div>
            <span className="flex-1 text-muted-foreground italic">
              Unassigned
            </span>
            {!issue.assignedToUser && (
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
            )}
          </DropdownMenuItem>
          {users.map((user) => (
            <DropdownMenuItem
              key={user.id}
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => onUpdate(user.id)}
            >
              <span className="flex-1">{user.name}</span>
              {issue.assignedTo === user.id && (
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </td>
  );
}
