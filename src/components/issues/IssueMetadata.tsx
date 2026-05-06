import type React from "react";
import { AssignIssueForm } from "~/app/(app)/m/[initials]/i/[issueNumber]/assign-issue-form";
import { UpdateIssueStatusForm } from "~/app/(app)/m/[initials]/i/[issueNumber]/update-issue-status-form";
import { UpdateIssueSeverityForm } from "~/app/(app)/m/[initials]/i/[issueNumber]/update-issue-severity-form";
import { UpdateIssuePriorityForm } from "~/app/(app)/m/[initials]/i/[issueNumber]/update-issue-priority-form";
import { UpdateIssueFrequencyForm } from "~/app/(app)/m/[initials]/i/[issueNumber]/update-issue-frequency-form";
import { type OwnershipContext } from "~/lib/permissions/helpers";
import { type AccessLevel } from "~/lib/permissions/matrix";
import { type IssueWithAllRelations } from "~/lib/types";
import { cn } from "~/lib/utils";

interface IssueMetadataUser {
  id: string;
  name: string;
}

// Mirrors fields read by AssignIssueForm and the Update{Status,Priority,Severity,Frequency} forms.
type IssueMetadataIssue = Pick<
  IssueWithAllRelations,
  "id" | "assignedTo" | "status" | "priority" | "severity" | "frequency"
>;

interface IssueMetadataProps {
  issue: IssueMetadataIssue;
  allUsers: IssueMetadataUser[];
  currentUserId: string | null;
  accessLevel: AccessLevel;
  ownershipContext: OwnershipContext;
}

export function IssueMetadata({
  issue,
  allUsers,
  currentUserId,
  accessLevel,
  ownershipContext,
}: IssueMetadataProps): React.JSX.Element {
  return (
    <div className="@container">
      <div
        data-testid="issue-metadata-grid"
        className="grid grid-cols-1 @xl:grid-cols-2 rounded-lg border border-outline-variant bg-card"
      >
        <Row label="Assignee" testId="issue-metadata-row-assignee" spanBothAtXl>
          <AssignIssueForm
            issueId={issue.id}
            assignedToId={issue.assignedTo}
            users={allUsers}
            currentUserId={currentUserId}
            accessLevel={accessLevel}
            ownershipContext={ownershipContext}
          />
        </Row>
        <Row label="Status" testId="issue-metadata-row-status">
          <UpdateIssueStatusForm
            issueId={issue.id}
            currentStatus={issue.status}
            accessLevel={accessLevel}
            ownershipContext={ownershipContext}
          />
        </Row>
        <Row
          label="Priority"
          testId="issue-metadata-row-priority"
          leftBorderAtXl
        >
          <UpdateIssuePriorityForm
            issueId={issue.id}
            currentPriority={issue.priority}
            accessLevel={accessLevel}
            ownershipContext={ownershipContext}
          />
        </Row>
        <Row
          label="Severity"
          testId="issue-metadata-row-severity"
          lastInColumnAtXl
        >
          <UpdateIssueSeverityForm
            issueId={issue.id}
            currentSeverity={issue.severity}
            accessLevel={accessLevel}
            ownershipContext={ownershipContext}
          />
        </Row>
        <Row
          label="Frequency"
          testId="issue-metadata-row-frequency"
          leftBorderAtXl
        >
          <UpdateIssueFrequencyForm
            issueId={issue.id}
            currentFrequency={issue.frequency}
            accessLevel={accessLevel}
            ownershipContext={ownershipContext}
          />
        </Row>
      </div>
    </div>
  );
}

interface RowProps {
  label: string;
  testId: string;
  children: React.ReactNode;
  leftBorderAtXl?: boolean;
  spanBothAtXl?: boolean;
  /** True for the bottom-left cell at @xl: 2-column layout. Without this, the
   *  cell still draws a `border-b` (since `last:` only matches the very last
   *  DOM child) and the bottom edge of the grid is asymmetric. */
  lastInColumnAtXl?: boolean;
}

function Row({
  label,
  testId,
  children,
  leftBorderAtXl,
  spanBothAtXl,
  lastInColumnAtXl,
}: RowProps): React.JSX.Element {
  return (
    <div
      data-testid={testId}
      className={cn(
        "grid grid-cols-[90px_1fr] items-center gap-3 px-4 py-2.5 min-h-[44px]",
        "border-b border-outline-variant/40 last:border-b-0",
        leftBorderAtXl && "@xl:border-l @xl:border-outline-variant/40",
        spanBothAtXl && "@xl:col-span-2",
        lastInColumnAtXl && "@xl:border-b-0"
      )}
    >
      <span className="text-xs uppercase tracking-wide text-muted-foreground font-bold">
        {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
