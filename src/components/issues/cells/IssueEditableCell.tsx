"use client";

import * as React from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
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

interface EditableCellProps {
  issue: IssueListItem;
  field: string;
  config: {
    label: string;
    icon: LucideIcon;
    iconColor: string;
  };
  options: {
    value: string;
    label: string;
    icon: LucideIcon;
    iconColor: string;
  }[];
  onUpdate: (value: string) => void;
  isUpdating: boolean;
}

/**
 * Generic editable table cell for issue status, severity, priority, etc.
 *
 * Renders a dropdown menu with icon + label that allows updating a field
 * Shows loading state during updates
 */
export function IssueEditableCell({
  field,
  config,
  options,
  onUpdate,
  isUpdating,
}: EditableCellProps): React.JSX.Element {
  return (
    <td
      className="p-1 min-w-[150px] max-w-[150px]"
      data-testid={`issue-cell-${field}`}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={isUpdating}>
          <button
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium text-foreground leading-tight hover:bg-muted/80 px-3 py-3 rounded-md transition-colors w-full text-left",
              isUpdating && "opacity-50 cursor-not-allowed"
            )}
          >
            {isUpdating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 text-muted-foreground" />
            ) : (
              <config.icon
                className={cn("h-3.5 w-3.5 shrink-0", config.iconColor)}
              />
            )}
            <span className="line-clamp-1 flex-1">{config.label}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[180px]">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Update Field
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {options.map((opt) => (
            <DropdownMenuItem
              key={opt.value}
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => onUpdate(opt.value)}
            >
              <opt.icon className={cn("h-3.5 w-3.5", opt.iconColor)} />
              <span className="flex-1">{opt.label}</span>
              {opt.label === config.label && (
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </td>
  );
}
