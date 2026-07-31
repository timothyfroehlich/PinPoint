"use client";

import type React from "react";
import { useState, useActionState, useEffect, startTransition } from "react";
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
 * Form component for updating issue priority.
 * Uses useActionState for form submission with client-side validation.
 * Dispatches the action directly rather than via `<form action={...}>` — see PP-0fvr.
 */
export function UpdateIssuePriorityForm({
  issueId,
  currentPriority,
  accessLevel,
  ownershipContext,
  compact = false,
}: UpdateIssuePriorityFormProps): React.JSX.Element {
  const [selectedPriority, setSelectedPriority] =
    useState<IssuePriority>(currentPriority);
  const [state, formAction, isPending] = useActionState<
    UpdateIssuePriorityResult | undefined,
    FormData
  >(updateIssuePriorityAction, undefined);

  useEffect(() => {
    if (state && !state.ok) {
      setSelectedPriority(currentPriority);
      toast.error(state.message);
    }
  }, [state, currentPriority]);

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

  // Dispatch the action directly instead of routing through a native
  // `<form>` submission. `@radix-ui/react-select` >=2.3.3 attaches a
  // `reset` listener to the form it participates in and replays the
  // Select's *initial* value through `onValueChange` when that event fires;
  // React 19 auto-resets a `<form action={...}>` once the action settles,
  // so a native submit here would emit a second, spurious `onValueChange`
  // carrying the stale value shortly after every real selection (PP-0fvr).
  // Building `FormData` by hand and calling the `useActionState` dispatch
  // ourselves means no `<form>` is ever submitted, so neither React's
  // auto-reset nor Radix's reset listener ever fires.
  const handleValueChange = (newPriority: IssuePriority): void => {
    setSelectedPriority(newPriority);
    const formData = new FormData();
    formData.append("issueId", issueId);
    formData.append("priority", newPriority);
    startTransition(() => {
      formAction(formData);
    });
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
    // No `action` prop, no hidden inputs: submits are dispatched manually
    // from `handleValueChange` above via `formAction(formData)`, never via
    // native form submission (see comment there for why). Kept as a
    // `<form>` element (rather than a `<div>`) purely so existing
    // `form[data-form="update-priority"]` selectors keep matching; it is
    // not natively submittable, so don't add an `action` or a submit
    // control back onto it.
    <form
      onSubmit={(event) => {
        event.preventDefault();
      }}
      className="space-y-2"
      data-form="update-priority"
    >
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
          <Tooltip>
            <TooltipTrigger asChild>
              {compact ? <span className="block">{control}</span> : control}
            </TooltipTrigger>
            <TooltipContent>{deniedReason}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </form>
  );
}
