/**
 * Resend Invitation Button Component
 * Client component for resending invitation emails
 */

"use client";

import { useActionState } from "react";
import { Button } from "~/components/ui/button";
import { MailIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { resendInvitationAction } from "~/lib/actions/admin-actions";
import { useEffect } from "react";

interface ResendInvitationButtonProps {
  invitationId: string;
  email: string;
  className?: string;
}

export function ResendInvitationButton({
  invitationId,
  email,
  className,
}: ResendInvitationButtonProps): JSX.Element {
  const [state, formAction, isPending] = useActionState(
    resendInvitationAction,
    null,
  );

  // Handle state changes
  useEffect(() => {
    if (state?.success) {
      toast.success(state.message ?? `Invitation resent to ${email}`);
    } else if (state?.success === false) {
      const normalizedError = state.error.trim();
      toast.error(
        normalizedError && normalizedError.length > 0
          ? normalizedError
          : "Failed to resend invitation",
      );
    }
  }, [state, email]);

  return (
    <form action={formAction}>
      <input type="hidden" name="invitationId" value={invitationId} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={isPending}
        className={className}
      >
        {isPending ? (
          <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <MailIcon className="h-4 w-4 mr-2" />
        )}
        {isPending ? "Sending..." : "Resend Invitation"}
      </Button>
    </form>
  );
}
