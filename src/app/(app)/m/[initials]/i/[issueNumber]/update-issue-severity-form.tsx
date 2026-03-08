"use client";

import type React from "react";
import { useState, useActionState, useRef, useEffect } from "react";
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
  TooltipProvider,
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
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedSeverity, setSelectedSeverity] =
    useState<IssueSeverity>(currentSeverity);
  const [pendingSeverity, setPendingSeverity] = useState<IssueSeverity | null>(
    null
  );
  const [state, formAction, isPending] = useActionState<
    UpdateIssueSeverityResult | undefined,
    FormData
  >(updateIssueSeverityAction, undefined);

  useEffect(() => {
    if (state && !state.ok) {
      toast.error(state.message);
    }
  }, [state]);

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

  // Auto-submit form when pending severity changes
  useEffect(() => {
    if (pendingSeverity !== null && formRef.current) {
      formRef.current.requestSubmit();
      setPendingSeverity(null);
    }
  }, [pendingSeverity]);

  const handleValueChange = (newSeverity: IssueSeverity): void => {
    setSelectedSeverity(newSeverity);
    setPendingSeverity(newSeverity);
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
    <form
      ref={formRef}
      action={formAction}
      className="space-y-2"
      data-form="update-severity"
    >
      <input type="hidden" name="issueId" value={issueId} />
      <input type="hidden" name="severity" value={selectedSeverity} />
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
