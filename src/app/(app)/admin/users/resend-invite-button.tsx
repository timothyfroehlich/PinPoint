"use client";

import type * as React from "react";
import { useTransition } from "react";
import { Button } from "~/components/ui/button";
import { MailCheck } from "lucide-react";
import { resendInvite } from "./actions";
import { toast } from "sonner";

interface ResendInviteButtonProps {
  userId: string;
  userName: string;
}

export function ResendInviteButton({
  userId,
  userName,
}: ResendInviteButtonProps): React.JSX.Element {
  const [isPending, startTransition] = useTransition();

  function handleResend(): void {
    startTransition(async () => {
      try {
        const result = await resendInvite(userId);

        if (result.ok) {
          toast.success("Invitation resent successfully");
        } else {
          toast.error(result.message);
        }
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
      loading={isPending}
      aria-label={`Resend invite to ${userName}`}
    >
      <MailCheck className="mr-2 size-3" />
      Resend Invite
    </Button>
  );
}
