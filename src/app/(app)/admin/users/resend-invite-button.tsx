"use client";

import type * as React from "react";
import { useTransition } from "react";
import { Button } from "~/components/ui/button";
import { MailCheck } from "lucide-react";
import { resendInvite } from "./actions";
import { toast } from "sonner";

interface ResendInviteButtonProps {
  userId: string;
}

export function ResendInviteButton({
  userId,
}: ResendInviteButtonProps): React.JSX.Element {
  const [isPending, startTransition] = useTransition();

  function handleResend(): void {
    startTransition(async () => {
      try {
        await resendInvite(userId);
        toast.success("Invitation resent successfully");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to resend invitation"
        );
      }
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 text-xs"
      onClick={handleResend}
      disabled={isPending}
    >
      <MailCheck className="mr-2 size-3" />
      {isPending ? "Sending..." : "Resend Invite"}
    </Button>
  );
}
