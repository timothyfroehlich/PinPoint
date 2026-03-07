"use client";

import type React from "react";
import { useState, useActionState, useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  updateIssueStatusAction,
  type UpdateIssueStatusResult,
} from "~/app/(app)/issues/actions";
import { StatusSelect } from "~/components/issues/fields/StatusSelect";
import { MetadataDrawer } from "~/components/issues/fields/MetadataDrawer";
import { IssueBadge } from "~/components/issues/IssueBadge";
import type { IssueStatus } from "~/lib/types";
import {
  STATUS_CONFIG,
  STATUS_GROUPS,
  type IssueStatus as IssueStatusLiteral,
} from "~/lib/issues/status";
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

interface UpdateIssueStatusFormProps {
  issueId: string;
  currentStatus: IssueStatus;
  accessLevel: AccessLevel;
  ownershipContext: OwnershipContext;
  compact?: boolean | undefined;
}

// Build status options for MetadataDrawer from config
const STATUS_DRAWER_OPTIONS = [
  ...STATUS_GROUPS.new,
  ...STATUS_GROUPS.in_progress,
  ...STATUS_GROUPS.closed,
].map((status: IssueStatusLiteral) => {
  const config = STATUS_CONFIG[status];
  return {
    value: status,
    label: config.label,
    description: config.description,
    icon: config.icon,
    iconColor: config.iconColor,
  };
});

export function UpdateIssueStatusForm({
  issueId,
  currentStatus,
  accessLevel,
  ownershipContext,
  compact,
}: UpdateIssueStatusFormProps): React.JSX.Element {
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedStatus, setSelectedStatus] =
    useState<IssueStatus>(currentStatus);
  const [pendingStatus, setPendingStatus] = useState<IssueStatus | null>(null);
  const [state, formAction, isPending] = useActionState<
    UpdateIssueStatusResult | undefined,
    FormData
  >(updateIssueStatusAction, undefined);
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

  // Auto-submit form when pending status changes
  useEffect(() => {
    if (pendingStatus !== null && formRef.current) {
      formRef.current.requestSubmit();
      setPendingStatus(null);
    }
  }, [pendingStatus]);

  const handleValueChange = (newStatus: IssueStatus): void => {
    setSelectedStatus(newStatus);
    setPendingStatus(newStatus);
  };

  if (
    !permissionState.allowed &&
    permissionState.reason === "unauthenticated"
  ) {
    return (
      <IssueBadge type="status" value={currentStatus} showTooltip={false} />
    );
  }

  const compactControl = compact ? (
    <MetadataDrawer
      title="Status"
      options={STATUS_DRAWER_OPTIONS}
      currentValue={selectedStatus}
      onSelect={handleValueChange}
      disabled={isPending || !permissionState.allowed}
      trigger={
        <button type="button" className="cursor-pointer">
          <IssueBadge
            type="status"
            value={selectedStatus}
            showTooltip={false}
          />
        </button>
      }
    />
  ) : null;

  const selectControl = (
    <StatusSelect
      value={selectedStatus}
      onValueChange={handleValueChange}
      disabled={isPending || !permissionState.allowed}
    />
  );

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-2"
      data-form="update-status"
    >
      <input type="hidden" name="issueId" value={issueId} />
      <input type="hidden" name="status" value={selectedStatus} />
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
      {state?.ok && !compact && (
        <p className="text-sm text-success" data-testid="status-update-success">
          Status updated successfully
        </p>
      )}
      {state && !state.ok && !compact && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}
    </form>
  );
}
