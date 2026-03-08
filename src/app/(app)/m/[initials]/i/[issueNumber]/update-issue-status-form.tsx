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
import { STATUS_CONFIG, STATUS_GROUPS } from "~/lib/issues/status";
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
import { toast } from "sonner";

interface UpdateIssueStatusFormProps {
  issueId: string;
  currentStatus: IssueStatus;
  accessLevel: AccessLevel;
  ownershipContext: OwnershipContext;
  compact?: boolean;
}

const statusOptions = [
  ...STATUS_GROUPS.new,
  ...STATUS_GROUPS.in_progress,
  ...STATUS_GROUPS.closed,
].map((status) => ({
  value: status,
  label: STATUS_CONFIG[status].label,
  description: STATUS_CONFIG[status].description,
  icon: STATUS_CONFIG[status].icon,
  iconColor: STATUS_CONFIG[status].iconColor,
  testId: `status-option-${status}`,
}));

export function UpdateIssueStatusForm({
  issueId,
  currentStatus,
  accessLevel,
  ownershipContext,
  compact = false,
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

  // Handle action result
  useEffect(() => {
    if (state?.ok) {
      toast.success("Status updated");
    } else if (state?.ok === false) {
      toast.error(state.message);
    }
  }, [state]);

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

  const control = compact ? (
    <MetadataDrawer
      title="Status"
      options={statusOptions}
      currentValue={selectedStatus}
      onSelect={handleValueChange}
      disabled={isPending || !permissionState.allowed}
      trigger={
        <button
          type="button"
          className="w-full disabled:cursor-not-allowed"
          disabled={isPending || !permissionState.allowed}
          data-testid="issue-status-trigger"
        >
          <IssueBadge
            type="status"
            value={selectedStatus}
            variant="strip"
            size="lg"
            className="w-full min-w-0"
            showTooltip={false}
          />
        </button>
      }
    />
  ) : (
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
