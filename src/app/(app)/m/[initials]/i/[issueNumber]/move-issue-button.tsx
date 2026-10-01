"use client";

import type React from "react";
import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "~/components/ui/button";
import { ReassignMachineForm } from "./reassign-machine-form";

interface MoveIssueButtonProps {
  issueId: string;
  currentInitials: string;
  machines: { initials: string; name: string }[];
}

/**
 * Move to another machine (spec issue-detail §4.5–§4.6): labeled on desktop,
 * icon-only on mobile, opening the move dialog.
 */
export function MoveIssueButton({
  issueId,
  currentInitials,
  machines,
}: MoveIssueButtonProps): React.JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className="size-11 shrink-0 p-0 text-muted-foreground hover:text-foreground md:h-9 md:w-auto md:gap-2 md:border md:border-outline-variant md:px-3 md:text-foreground"
        onClick={() => {
          setOpen(true);
        }}
        aria-label="Move to another machine"
        data-testid="issue-move-button"
      >
        <ArrowLeftRight className="size-4" aria-hidden="true" />
        <span className="hidden md:inline">Move</span>
      </Button>

      <ReassignMachineForm
        issueId={issueId}
        currentInitials={currentInitials}
        machines={machines}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
