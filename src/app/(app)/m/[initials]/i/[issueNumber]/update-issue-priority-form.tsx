"use client";

import type React from "react";
import { useState, useActionState, useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  updateIssuePriorityAction,
  type UpdateIssuePriorityResult,
} from "~/app/(app)/issues/actions";
import { PrioritySelect } from "~/components/issues/fields/PrioritySelect";
import { MetadataDrawer } from "~/components/issues/fields/MetadataDrawer";
import { PRIORITY_CONFIG } from "~/lib/issues/status";
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
  compact?: boolean;
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
  compact,
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
    "issues.update.triage",
    accessLevel,
    ownershipContext
  );
  const deniedReason = permissionState.allowed
    ? null
    : getPermissionDeniedReason(
        "issues.update.triage",
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

  const selectControl = compact ? (
    <MetadataDrawer<IssuePriority>
      title="Priority"
      options={(Object.keys(PRIORITY_CONFIG) as IssuePriority[]).map(
        (priority) => ({
          value: priority,
          label: PRIORITY_CONFIG[priority].label,
          icon: PRIORITY_CONFIG[priority].icon,
          iconColor: PRIORITY_CONFIG[priority].iconColor,
        })
      )}
      currentValue={selectedPriority}
      onSelect={handleValueChange}
      disabled={isPending || !permissionState.allowed}
      trigger={
        <button
          type="button"
          data-testid="issue-priority-select-mobile"
          className="text-left"
          disabled={isPending || !permissionState.allowed}
        >
          <IssueBadge
            type="priority"
            value={selectedPriority}
            showTooltip={false}
          />
        </button>
      }
    />
  ) : (
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
