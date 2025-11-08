"use client";

import { useState } from "react";
import { PencilIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { IssueEditFormClient } from "./issue-edit-form-client";

interface IssueEditDialogClientProps {
  issueId: string;
  currentTitle: string;
  currentDescription: string | null;
}

export function IssueEditDialogClient({
  issueId,
  currentTitle,
  currentDescription,
}: IssueEditDialogClientProps): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Edit issue"
        >
          <PencilIcon className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Issue</DialogTitle>
          <DialogDescription>
            Update the issue title and description. Changes will be saved immediately.
          </DialogDescription>
        </DialogHeader>
        <IssueEditFormClient
          issueId={issueId}
          currentTitle={currentTitle}
          currentDescription={currentDescription}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
