"use client";

import type React from "react";
import { useState, useActionState, useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  updateIssuePriorityAction,
  type UpdateIssuePriorityResult,
} from "~/app/(app)/issues/actions";
import { PrioritySelect } from "~/components/issues/fields/PrioritySelect";
import { type IssuePriority } from "~/lib/types";
import { IssueBadge } from "~/components/issues/IssueBadge";
import {
  getPermissionDeniedReason,
  getPermissionState,
  type OwnershipContext,
} from "~/lib/permissions/helpers";
import { type AccessLevel } from "~/lib/permissions/matrix";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

interface UpdateIssuePriorityFormProps {
  issueId: string;
  currentPriority: IssuePriority;
  accessLevel: AccessLevel;
  ownershipContext: OwnershipContext;
}

/**
 * Form component for updating issue priority with progressive enhancement.
 * Uses useActionState for form submission with client-side validation.
 */
export function UpdateIssuePriorityForm({
  issueId,
  currentPriority,
  accessLevel,
  ownershipContext,
}: UpdateIssuePriorityFormProps): React.JSX.Element {
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedPriority, setSelectedPriority] =
    useState<IssuePriority>(currentPriority);
  const [pendingPriority, setPendingPriority] = useState<IssuePriority | null>(
    null
  );
  const [state, formAction, isPending] = useActionState<
    UpdateIssuePriorityResult | undefined,
    FormData
  >(updateIssuePriorityAction, undefined);
  const permissionState = getPermissionState(
    "issues.update.priority",
    accessLevel,
    ownershipContext
  );
  const deniedReason = permissionState.allowed
    ? null
    : getPermissionDeniedReason(
        "issues.update.priority",
        accessLevel,
        ownershipContext
      );

  // Auto-submit form when pending priority changes
  useEffect(() => {
    if (pendingPriority !== null && formRef.current) {
      formRef.current.requestSubmit();
      setPendingPriority(null);
    }
  }, [pendingPriority]);

  const handleValueChange = (newPriority: IssuePriority): void => {
    setSelectedPriority(newPriority);
    setPendingPriority(newPriority);
  };

  if (
    !permissionState.allowed &&
    permissionState.reason === "unauthenticated"
  ) {
    return (
      <IssueBadge type="priority" value={currentPriority} showTooltip={false} />
    );
  }

  const selectControl = (
    <PrioritySelect
      value={selectedPriority}
      onValueChange={handleValueChange}
      disabled={isPending || !permissionState.allowed}
    />
  );

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-2"
      data-form="update-priority"
    >
      <input type="hidden" name="issueId" value={issueId} />
      <input type="hidden" name="priority" value={selectedPriority} />
      <div className="relative" title={deniedReason ?? undefined}>
        {permissionState.allowed ? (
          selectControl
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>{selectControl}</TooltipTrigger>
              <TooltipContent>{deniedReason}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {isPending && (
          <div className="absolute right-10 top-1/2 -translate-y-1/2 pointer-events-none">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
      {state && !state.ok && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}
    </form>
  );
}
