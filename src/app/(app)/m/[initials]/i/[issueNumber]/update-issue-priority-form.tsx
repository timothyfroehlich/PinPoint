"use client";

import type React from "react";
import { updateIssuePriorityAction } from "~/app/(app)/issues/actions";
import { PRIORITY_CONFIG } from "~/lib/issues/status";
import { ISSUE_PRIORITY_VALUES, type IssuePriority } from "~/lib/types";
import type { FieldOption } from "~/components/issues/fields/IssueFieldRow";
import {
  checkPermission,
  type OwnershipContext,
} from "~/lib/permissions/helpers";
import { type AccessLevel } from "~/lib/permissions/matrix";
import { IssueFieldRowForm } from "./issue-field-row-form";

interface UpdateIssuePriorityFormProps {
  issueId: string;
  currentPriority: IssuePriority;
  accessLevel: AccessLevel;
  ownershipContext: OwnershipContext;
}

const priorityOptions: FieldOption<IssuePriority>[] = ISSUE_PRIORITY_VALUES.map(
  (priority) => ({
    value: priority,
    label: PRIORITY_CONFIG[priority].label,
    icon: PRIORITY_CONFIG[priority].icon,
    iconColor: PRIORITY_CONFIG[priority].iconColor,
    testId: `priority-option-${priority}`,
  })
);

/** The Priority row in the issue's Details (spec issue-detail §9). */
export function UpdateIssuePriorityForm({
  issueId,
  currentPriority,
  accessLevel,
  ownershipContext,
}: UpdateIssuePriorityFormProps): React.JSX.Element {
  return (
    <IssueFieldRowForm
      issueId={issueId}
      fieldName="priority"
      label="Priority"
      value={currentPriority}
      options={priorityOptions}
      canEdit={checkPermission(
        "issues.update.triage",
        accessLevel,
        ownershipContext
      )}
      action={updateIssuePriorityAction}
      testId="issue-priority-select"
    />
  );
}
