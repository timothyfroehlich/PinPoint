"use client";

import type React from "react";
import { updateIssueStatusAction } from "~/app/(app)/issues/actions";
import {
  STATUS_CONFIG,
  STATUS_GROUPS,
  STATUS_GROUP_LABELS,
} from "~/lib/issues/status";
import { type IssueStatus } from "~/lib/types";
import type { FieldOption } from "~/components/issues/fields/IssueFieldRow";
import {
  checkPermission,
  type OwnershipContext,
} from "~/lib/permissions/helpers";
import { type AccessLevel } from "~/lib/permissions/matrix";
import { IssueFieldRowForm } from "./issue-field-row-form";

interface UpdateIssueStatusFormProps {
  issueId: string;
  currentStatus: IssueStatus;
  accessLevel: AccessLevel;
  ownershipContext: OwnershipContext;
}

const statusOptions: FieldOption<IssueStatus>[] = (
  ["new", "in_progress", "closed"] as const
).flatMap((group) =>
  STATUS_GROUPS[group].map((status) => ({
    value: status,
    label: STATUS_CONFIG[status].label,
    description: STATUS_CONFIG[status].description,
    icon: STATUS_CONFIG[status].icon,
    iconColor: STATUS_CONFIG[status].iconColor,
    group: STATUS_GROUP_LABELS[group],
    testId: `status-option-${status}`,
  }))
);

/** The Status row in the issue's Details (spec issue-detail §9). */
export function UpdateIssueStatusForm({
  issueId,
  currentStatus,
  accessLevel,
  ownershipContext,
}: UpdateIssueStatusFormProps): React.JSX.Element {
  return (
    <IssueFieldRowForm
      issueId={issueId}
      fieldName="status"
      label="Status"
      value={currentStatus}
      options={statusOptions}
      canEdit={checkPermission(
        "issues.update.reporting",
        accessLevel,
        ownershipContext
      )}
      action={updateIssueStatusAction}
      testId="issue-status-select"
    />
  );
}
