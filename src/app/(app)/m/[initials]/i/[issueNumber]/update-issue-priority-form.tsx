"use client";

import type React from "react";
import {
  useState,
  useActionState,
  useRef,
  useEffect,
  startTransition,
} from "react";
import {
  updateIssuePriorityAction,
  type UpdateIssuePriorityResult,
} from "~/app/(app)/issues/actions";
import { PrioritySelect } from "~/components/issues/fields/PrioritySelect";
import { MetadataDrawer } from "~/components/issues/fields/MetadataDrawer";
import { type IssuePriority } from "~/lib/types";
import { IssueBadge } from "~/components/issues/IssueBadge";
import { PRIORITY_CONFIG } from "~/lib/issues/status";
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
import { cn } from "~/lib/utils";
import { toast } from "sonner";

interface UpdateIssuePriorityFormProps {
  issueId: string;
  currentPriority: IssuePriority;
  accessLevel: AccessLevel;
  ownershipContext: OwnershipContext;
  compact?: boolean;
}

const priorityOptions: IssuePriority[] = ["low", "medium", "high"];

/**
 * Form component for updating issue priority with progressive enhancement.
 * Uses useActionState for form submission with client-side validation.
 */
export function UpdateIssuePriorityForm({
  issueId,
  currentPriority,
  accessLevel,
  ownershipContext,
  compact = false,
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

  useEffect(() => {
    if (state && !state.ok) {
      toast.error(state.message);
    }
  }, [state]);

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
      const form = formRef.current;
      startTransition(() => {
        form.requestSubmit();
      });
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

  const control = compact ? (
    <MetadataDrawer
      title="Priority"
      options={priorityOptions.map((priority) => ({
        value: priority,
        label: PRIORITY_CONFIG[priority].label,
        icon: PRIORITY_CONFIG[priority].icon,
        iconColor: PRIORITY_CONFIG[priority].iconColor,
        testId: `priority-option-${priority}`,
      }))}
      currentValue={selectedPriority}
      onSelect={handleValueChange}
      disabled={isPending || !permissionState.allowed}
      trigger={
        <button
          type="button"
          className="w-full disabled:cursor-not-allowed"
          disabled={isPending || !permissionState.allowed}
          data-testid="issue-priority-trigger"
        >
          <IssueBadge
            type="priority"
            value={selectedPriority}
            variant="strip"
            size="lg"
            className="w-full min-w-0"
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
      <div
        className={cn(
          "relative",
          isPending && "opacity-50 pointer-events-none"
        )}
        title={deniedReason ?? undefined}
      >
        {permissionState.allowed ? (
          control
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                {compact ? <span className="block">{control}</span> : control}
              </TooltipTrigger>
              <TooltipContent>{deniedReason}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </form>
  );
}
