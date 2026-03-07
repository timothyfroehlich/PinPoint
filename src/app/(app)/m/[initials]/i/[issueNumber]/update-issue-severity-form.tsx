"use client";

import type React from "react";
import { useState, useActionState, useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";
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

const SEVERITY_DRAWER_OPTIONS = (
  Object.entries(SEVERITY_CONFIG) as [
    IssueSeverity,
    (typeof SEVERITY_CONFIG)[IssueSeverity],
  ][]
).map(([value, config]) => ({
  value,
  label: config.label,
  icon: config.icon,
  iconColor: config.iconColor,
}));

interface UpdateIssueSeverityFormProps {
  issueId: string;
  currentSeverity: IssueSeverity;
  accessLevel: AccessLevel;
  ownershipContext: OwnershipContext;
  compact?: boolean | undefined;
}

export function UpdateIssueSeverityForm({
  issueId,
  currentSeverity,
  accessLevel,
  ownershipContext,
  compact,
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

  const compactControl = compact ? (
    <MetadataDrawer
      title="Severity"
      options={SEVERITY_DRAWER_OPTIONS}
      currentValue={selectedSeverity}
      onSelect={handleValueChange}
      disabled={isPending || !permissionState.allowed}
      trigger={
        <button type="button" className="cursor-pointer">
          <IssueBadge
            type="severity"
            value={selectedSeverity}
            showTooltip={false}
          />
        </button>
      }
    />
  ) : null;

  const selectControl = (
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
