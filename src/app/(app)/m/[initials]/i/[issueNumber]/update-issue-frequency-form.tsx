"use client";

import type React from "react";
import { useState, useActionState, useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";
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
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

const FREQUENCY_DRAWER_OPTIONS = (
  Object.entries(FREQUENCY_CONFIG) as [
    IssueFrequency,
    (typeof FREQUENCY_CONFIG)[IssueFrequency],
  ][]
).map(([value, config]) => ({
  value,
  label: config.label,
  icon: config.icon,
  iconColor: config.iconColor,
}));

interface UpdateIssueFrequencyFormProps {
  issueId: string;
  currentFrequency: IssueFrequency;
  accessLevel: AccessLevel;
  ownershipContext: OwnershipContext;
  compact?: boolean | undefined;
}

export function UpdateIssueFrequencyForm({
  issueId,
  currentFrequency,
  accessLevel,
  ownershipContext,
  compact,
}: UpdateIssueFrequencyFormProps): React.JSX.Element {
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedFrequency, setSelectedFrequency] =
    useState<IssueFrequency>(currentFrequency);
  const [pendingFrequency, setPendingFrequency] =
    useState<IssueFrequency | null>(null);
  const [state, formAction, isPending] = useActionState<
    UpdateIssueFrequencyResult | undefined,
    FormData
  >(updateIssueFrequencyAction, undefined);
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

  // Auto-submit form when pending frequency changes
  useEffect(() => {
    if (pendingFrequency !== null && formRef.current) {
      formRef.current.requestSubmit();
      setPendingFrequency(null);
    }
  }, [pendingFrequency]);

  const handleValueChange = (newFrequency: IssueFrequency): void => {
    setSelectedFrequency(newFrequency);
    setPendingFrequency(newFrequency);
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

  const compactControl = compact ? (
    <MetadataDrawer
      title="Frequency"
      options={FREQUENCY_DRAWER_OPTIONS}
      currentValue={selectedFrequency}
      onSelect={handleValueChange}
      disabled={isPending || !permissionState.allowed}
      trigger={
        <button type="button" className="cursor-pointer">
          <IssueBadge
            type="frequency"
            value={selectedFrequency}
            showTooltip={false}
          />
        </button>
      }
    />
  ) : null;

  const selectControl = (
    <FrequencySelect
      value={selectedFrequency}
      onValueChange={handleValueChange}
      disabled={isPending || !permissionState.allowed}
    />
  );

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-2"
      data-form="update-frequency"
    >
      <input type="hidden" name="issueId" value={issueId} />
      <input type="hidden" name="frequency" value={selectedFrequency} />
      <div className="relative" title={deniedReason ?? undefined}>
        {compact ? (
          compactControl
        ) : permissionState.allowed ? (
          selectControl
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>{selectControl}</TooltipTrigger>
              <TooltipContent>{deniedReason}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {isPending && !compact && (
          <div className="absolute right-10 top-1/2 -translate-y-1/2 pointer-events-none">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
      {state && !state.ok && !compact && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}
    </form>
  );
}
