"use client";

import type React from "react";
import { updateIssueFrequencyAction } from "~/app/(app)/issues/actions";
import { FREQUENCY_CONFIG } from "~/lib/issues/status";
import { ISSUE_FREQUENCY_VALUES, type IssueFrequency } from "~/lib/types";
import type { FieldOption } from "~/components/issues/fields/IssueFieldRow";
import {
  checkPermission,
  type OwnershipContext,
} from "~/lib/permissions/helpers";
import { type AccessLevel } from "~/lib/permissions/matrix";
import { IssueFieldRowForm } from "./issue-field-row-form";

interface UpdateIssueFrequencyFormProps {
  issueId: string;
  currentFrequency: IssueFrequency;
  accessLevel: AccessLevel;
  ownershipContext: OwnershipContext;
}

const frequencyOptions: FieldOption<IssueFrequency>[] =
  ISSUE_FREQUENCY_VALUES.map((frequency) => ({
    value: frequency,
    label: FREQUENCY_CONFIG[frequency].label,
    icon: FREQUENCY_CONFIG[frequency].icon,
    iconColor: FREQUENCY_CONFIG[frequency].iconColor,
    testId: `frequency-option-${frequency}`,
  }));

/** The Frequency row in the issue's Details (spec issue-detail §9). */
export function UpdateIssueFrequencyForm({
  issueId,
  currentFrequency,
  accessLevel,
  ownershipContext,
}: UpdateIssueFrequencyFormProps): React.JSX.Element {
  return (
    <IssueFieldRowForm
      issueId={issueId}
      fieldName="frequency"
      label="Frequency"
      value={currentFrequency}
      options={frequencyOptions}
      canEdit={checkPermission(
        "issues.update.reporting",
        accessLevel,
        ownershipContext
      )}
      action={updateIssueFrequencyAction}
      testId="issue-frequency-select"
    />
  );
}
