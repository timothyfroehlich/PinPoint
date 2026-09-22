"use client";

import type * as React from "react";
import { useTransition } from "react";
import { Button } from "~/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { UserX } from "lucide-react";
import { removeInvitedUser } from "./actions";
import { toast } from "sonner";

interface RemoveInvitedUserButtonProps {
  userId: string;
  userName: string;
}

export function RemoveInvitedUserButton({
  userId,
  userName,
}: RemoveInvitedUserButtonProps): React.JSX.Element {
  const [isPending, startTransition] = useTransition();

  function handleRemove(): void {
    startTransition(async () => {
      try {
        await removeInvitedUser(userId);
        toast.success("Invitation removed successfully");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to remove invitation"
        );
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          aria-label={`Remove invitation for ${userName}`}
        >
          <UserX className="mr-2 size-3" />
          Remove
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove invitation?</AlertDialogTitle>
          <AlertDialogDescription>
            This will cancel {userName}&apos;s pending invitation. This cannot
            be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleRemove}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? "Removing..." : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
