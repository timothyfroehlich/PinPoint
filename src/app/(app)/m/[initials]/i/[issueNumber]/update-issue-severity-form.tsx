"use client";

import type React from "react";
import { updateIssueSeverityAction } from "~/app/(app)/issues/actions";
import { SEVERITY_CONFIG } from "~/lib/issues/status";
import { ISSUE_SEVERITY_VALUES, type IssueSeverity } from "~/lib/types";
import type { FieldOption } from "~/components/issues/fields/IssueFieldRow";
import {
  checkPermission,
  type OwnershipContext,
} from "~/lib/permissions/helpers";
import { type AccessLevel } from "~/lib/permissions/matrix";
import { IssueFieldRowForm } from "./issue-field-row-form";

interface UpdateIssueSeverityFormProps {
  issueId: string;
  currentSeverity: IssueSeverity;
  accessLevel: AccessLevel;
  ownershipContext: OwnershipContext;
}

const severityOptions: FieldOption<IssueSeverity>[] = ISSUE_SEVERITY_VALUES.map(
  (severity) => ({
    value: severity,
    label: SEVERITY_CONFIG[severity].label,
    icon: SEVERITY_CONFIG[severity].icon,
    iconColor: SEVERITY_CONFIG[severity].iconColor,
    testId: `severity-option-${severity}`,
  })
);

/** The Severity row in the issue's Details (spec issue-detail §9). */
export function UpdateIssueSeverityForm({
  issueId,
  currentSeverity,
  accessLevel,
  ownershipContext,
}: UpdateIssueSeverityFormProps): React.JSX.Element {
  return (
    <IssueFieldRowForm
      issueId={issueId}
      fieldName="severity"
      label="Severity"
      value={currentSeverity}
      options={severityOptions}
      canEdit={checkPermission(
        "issues.update.reporting",
        accessLevel,
        ownershipContext
      )}
      action={updateIssueSeverityAction}
      testId="issue-severity-select"
    />
  );
}
