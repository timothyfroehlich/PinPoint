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
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedFrequency, setSelectedFrequency] =
    useState<IssueFrequency>(currentFrequency);
  const [pendingFrequency, setPendingFrequency] =
    useState<IssueFrequency | null>(null);
  const [state, formAction, isPending] = useActionState<
    UpdateIssueFrequencyResult | undefined,
    FormData
  >(updateIssueFrequencyAction, undefined);

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

  // Auto-submit form when pending frequency changes
  useEffect(() => {
    if (pendingFrequency !== null && formRef.current) {
      const form = formRef.current;
      startTransition(() => {
        form.requestSubmit();
      });
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
    <form
      ref={formRef}
      action={formAction}
      className="space-y-2"
      data-form="update-frequency"
    >
      <input type="hidden" name="issueId" value={issueId} />
      <input type="hidden" name="frequency" value={selectedFrequency} />
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
