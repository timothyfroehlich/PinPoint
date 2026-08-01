"use client";

import type React from "react";
import { useState, useActionState, useEffect, startTransition } from "react";
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
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
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
  const [selectedStatus, setSelectedStatus] =
    useState<IssueStatus>(currentStatus);
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

  useEffect(() => {
    if (state && !state.ok) {
      setSelectedStatus(currentStatus);
      toast.error(state.message);
    }
  }, [state, currentStatus]);

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
  const handleValueChange = (newStatus: IssueStatus): void => {
    setSelectedStatus(newStatus);
    const formData = new FormData();
    formData.append("issueId", issueId);
    formData.append("status", newStatus);
    startTransition(() => {
      formAction(formData);
    });
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
    // No `action` prop, no hidden inputs: submits are dispatched manually
    // from `handleValueChange` above via `formAction(formData)`, never via
    // native form submission (see comment there for why). Kept as a
    // `<form>` element (rather than a `<div>`) purely so existing
    // `form[data-form="update-status"]` selectors keep matching; it is not
    // natively submittable, so don't add an `action` or a submit control
    // back onto it.
    <form
      onSubmit={(event) => {
        event.preventDefault();
      }}
      className="space-y-2"
      data-form="update-status"
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
