"use client";

import type React from "react";
import { useState, useActionState, useEffect, startTransition } from "react";
import {
  updateIssueFrequencyAction,
  type UpdateIssueFrequencyResult,
} from "~/app/(app)/issues/actions";
import { FrequencySelect } from "~/components/issues/fields/FrequencySelect";
import { MetadataDrawer } from "~/components/issues/fields/MetadataDrawer";
import { type IssueFrequency } from "~/lib/types";
import { IssueBadge } from "~/components/issues/IssueBadge";
import { FREQUENCY_CONFIG } from "~/lib/issues/status";
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

interface UpdateIssueFrequencyFormProps {
  issueId: string;
  currentFrequency: IssueFrequency;
  accessLevel: AccessLevel;
  ownershipContext: OwnershipContext;
  compact?: boolean;
}

const frequencyOptions: IssueFrequency[] = [
  "intermittent",
  "frequent",
  "constant",
];

export function UpdateIssueFrequencyForm({
  issueId,
  currentFrequency,
  accessLevel,
  ownershipContext,
  compact = false,
}: UpdateIssueFrequencyFormProps): React.JSX.Element {
  const [selectedFrequency, setSelectedFrequency] =
    useState<IssueFrequency>(currentFrequency);
  const [state, formAction, isPending] = useActionState<
    UpdateIssueFrequencyResult | undefined,
    FormData
  >(updateIssueFrequencyAction, undefined);

  useEffect(() => {
    if (state && !state.ok) {
      setSelectedFrequency(currentFrequency);
      toast.error(state.message);
    }
  }, [state, currentFrequency]);

  const permissionState = getPermissionState(
    "issues.update.reporting",
    accessLevel,
    ownershipContext
  );
  const deniedReason = permissionState.allowed
    ? null
    : getPermissionDeniedReason(
        "issues.update.reporting",
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
  const handleValueChange = (newFrequency: IssueFrequency): void => {
    setSelectedFrequency(newFrequency);
    const formData = new FormData();
    formData.append("issueId", issueId);
    formData.append("frequency", newFrequency);
    startTransition(() => {
      formAction(formData);
    });
  };

  if (
    !permissionState.allowed &&
    permissionState.reason === "unauthenticated"
  ) {
    return (
      <IssueBadge
        type="frequency"
        value={currentFrequency}
        showTooltip={false}
      />
    );
  }

  const control = compact ? (
    <MetadataDrawer
      title="Frequency"
      options={frequencyOptions.map((frequency) => ({
        value: frequency,
        label: FREQUENCY_CONFIG[frequency].label,
        icon: FREQUENCY_CONFIG[frequency].icon,
        iconColor: FREQUENCY_CONFIG[frequency].iconColor,
        testId: `frequency-option-${frequency}`,
      }))}
      currentValue={selectedFrequency}
      onSelect={handleValueChange}
      disabled={isPending || !permissionState.allowed}
      trigger={
        <button
          type="button"
          className="w-full disabled:cursor-not-allowed"
          disabled={isPending || !permissionState.allowed}
          data-testid="issue-frequency-trigger"
        >
          <IssueBadge
            type="frequency"
            value={selectedFrequency}
            variant="strip"
            size="lg"
            className="w-full min-w-0"
            showTooltip={false}
          />
        </button>
      }
    />
  ) : (
    <FrequencySelect
      value={selectedFrequency}
      onValueChange={handleValueChange}
      disabled={isPending || !permissionState.allowed}
    />
  );

  return (
    // No `action` prop, no hidden inputs: submits are dispatched manually
    // from `handleValueChange` above via `formAction(formData)`, never via
    // native form submission (see comment there for why). Kept as a
    // `<form>` element (rather than a `<div>`) purely so existing
    // `form[data-form="update-frequency"]` selectors keep matching; it is
    // not natively submittable, so don't add an `action` or a submit
    // control back onto it.
    <form
      onSubmit={(event) => {
        event.preventDefault();
      }}
      className="space-y-2"
      data-form="update-frequency"
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
