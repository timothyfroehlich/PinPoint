"use client";

import type React from "react";
import { useState, useActionState, useEffect, startTransition } from "react";
import {
  updateIssueSeverityAction,
  type UpdateIssueSeverityResult,
} from "~/app/(app)/issues/actions";
import { SeveritySelect } from "~/components/issues/fields/SeveritySelect";
import { MetadataDrawer } from "~/components/issues/fields/MetadataDrawer";
import { type IssueSeverity } from "~/lib/types";
import { IssueBadge } from "~/components/issues/IssueBadge";
import { SEVERITY_CONFIG } from "~/lib/issues/status";
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

interface UpdateIssueSeverityFormProps {
  issueId: string;
  currentSeverity: IssueSeverity;
  accessLevel: AccessLevel;
  ownershipContext: OwnershipContext;
  compact?: boolean;
}

const severityOptions: IssueSeverity[] = [
  "cosmetic",
  "minor",
  "major",
  "unplayable",
];

export function UpdateIssueSeverityForm({
  issueId,
  currentSeverity,
  accessLevel,
  ownershipContext,
  compact = false,
}: UpdateIssueSeverityFormProps): React.JSX.Element {
  const [selectedSeverity, setSelectedSeverity] =
    useState<IssueSeverity>(currentSeverity);
  const [state, formAction, isPending] = useActionState<
    UpdateIssueSeverityResult | undefined,
    FormData
  >(updateIssueSeverityAction, undefined);

  useEffect(() => {
    if (state && !state.ok) {
      setSelectedSeverity(currentSeverity);
      toast.error(state.message);
    }
  }, [state, currentSeverity]);

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
  const handleValueChange = (newSeverity: IssueSeverity): void => {
    setSelectedSeverity(newSeverity);
    const formData = new FormData();
    formData.append("issueId", issueId);
    formData.append("severity", newSeverity);
    startTransition(() => {
      formAction(formData);
    });
  };

  if (
    !permissionState.allowed &&
    permissionState.reason === "unauthenticated"
  ) {
    return (
      <IssueBadge type="severity" value={currentSeverity} showTooltip={false} />
    );
  }

  const control = compact ? (
    <MetadataDrawer
      title="Severity"
      options={severityOptions.map((severity) => ({
        value: severity,
        label: SEVERITY_CONFIG[severity].label,
        icon: SEVERITY_CONFIG[severity].icon,
        iconColor: SEVERITY_CONFIG[severity].iconColor,
        testId: `severity-option-${severity}`,
      }))}
      currentValue={selectedSeverity}
      onSelect={handleValueChange}
      disabled={isPending || !permissionState.allowed}
      trigger={
        <button
          type="button"
          className="w-full disabled:cursor-not-allowed"
          disabled={isPending || !permissionState.allowed}
          data-testid="issue-severity-trigger"
        >
          <IssueBadge
            type="severity"
            value={selectedSeverity}
            variant="strip"
            size="lg"
            className="w-full min-w-0"
            showTooltip={false}
          />
        </button>
      }
    />
  ) : (
    <SeveritySelect
      value={selectedSeverity}
      onValueChange={handleValueChange}
      disabled={isPending || !permissionState.allowed}
    />
  );

  return (
    // No `action` prop, no hidden inputs: submits are dispatched manually
    // from `handleValueChange` above via `formAction(formData)`, never via
    // native form submission (see comment there for why). Kept as a
    // `<form>` element (rather than a `<div>`) purely so existing
    // `form[data-form="update-severity"]` selectors keep matching; it is
    // not natively submittable, so don't add an `action` or a submit
    // control back onto it.
    <form
      onSubmit={(event) => {
        event.preventDefault();
      }}
      className="space-y-2"
      data-form="update-severity"
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
