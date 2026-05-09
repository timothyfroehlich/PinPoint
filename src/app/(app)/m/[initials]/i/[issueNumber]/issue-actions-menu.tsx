"use client";

import type React from "react";
import { useState } from "react";
import { MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Button } from "~/components/ui/button";
import { ReassignMachineForm } from "./reassign-machine-form";

interface IssueActionsMenuProps {
  issueId: string;
  currentInitials: string;
  machines: { initials: string; name: string }[];
}

export function IssueActionsMenu({
  issueId,
  currentInitials,
  machines,
}: IssueActionsMenuProps): React.JSX.Element {
  const [reassignOpen, setReassignOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            data-testid="issue-actions-menu-trigger"
            aria-label="More actions"
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setReassignOpen(true);
            }}
            data-testid="issue-actions-menu-reassign"
          >
            Move to another machine…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ReassignMachineForm
        issueId={issueId}
        currentInitials={currentInitials}
        machines={machines}
        open={reassignOpen}
        onOpenChange={setReassignOpen}
      />
    </>
  );
}
