import type React from "react";
import Link from "next/link";
import { AssignIssueForm } from "~/app/(app)/m/[initials]/i/[issueNumber]/assign-issue-form";
import { UpdateIssueStatusForm } from "~/app/(app)/m/[initials]/i/[issueNumber]/update-issue-status-form";
import { UpdateIssueSeverityForm } from "~/app/(app)/m/[initials]/i/[issueNumber]/update-issue-severity-form";
import { UpdateIssuePriorityForm } from "~/app/(app)/m/[initials]/i/[issueNumber]/update-issue-priority-form";
import { UpdateIssueFrequencyForm } from "~/app/(app)/m/[initials]/i/[issueNumber]/update-issue-frequency-form";
import { ContextRow } from "~/components/issues/fields/IssueFieldRow";
import { ExactRelativeTime } from "~/components/issues/ExactRelativeTime";
import { WatchButton } from "~/components/issues/WatchButton";
import { formatDateTime } from "~/lib/dates";
import { getMachineOwnerName } from "~/lib/issues/owner";
import { resolveIssueReporter } from "~/lib/issues/utils";
import { type OwnershipContext } from "~/lib/permissions/helpers";
import { type AccessLevel } from "~/lib/permissions/matrix";
import { type IssueWithAllRelations } from "~/lib/types";

interface IssueDetailsUser {
  id: string;
  name: string;
}

interface IssueDetailsProps {
  issue: IssueWithAllRelations;
  allUsers: IssueDetailsUser[];
  currentUserId: string | null;
  accessLevel: AccessLevel;
  ownershipContext: OwnershipContext;
}

const cardClassName =
  "divide-y divide-outline-variant/40 overflow-hidden rounded-lg border border-outline-variant bg-card";
const linkClassName =
  "truncate font-medium text-foreground transition-colors duration-150 hover:text-primary";

/**
 * Details (spec issue-detail §9): the field rows, then the context rows. The
 * Details tab on mobile and the right column on desktop render the same two
 * cards.
 */
export function IssueDetails({
  issue,
  allUsers,
  currentUserId,
  accessLevel,
  ownershipContext,
}: IssueDetailsProps): React.JSX.Element {
  const ownerName = getMachineOwnerName(issue);
  const ownerId = issue.machine.owner?.id;
  const reporter = resolveIssueReporter(issue);
  const isWatching = currentUserId
    ? issue.watchers.some((watcher) => watcher.userId === currentUserId)
    : false;

  return (
    <div className="space-y-3">
      <div className={cardClassName} data-testid="issue-field-rows">
        <UpdateIssueStatusForm
          issueId={issue.id}
          currentStatus={issue.status}
          accessLevel={accessLevel}
          ownershipContext={ownershipContext}
        />
        <UpdateIssueSeverityForm
          issueId={issue.id}
          currentSeverity={issue.severity}
          accessLevel={accessLevel}
          ownershipContext={ownershipContext}
        />
        <UpdateIssuePriorityForm
          issueId={issue.id}
          currentPriority={issue.priority}
          accessLevel={accessLevel}
          ownershipContext={ownershipContext}
        />
        <UpdateIssueFrequencyForm
          issueId={issue.id}
          currentFrequency={issue.frequency}
          accessLevel={accessLevel}
          ownershipContext={ownershipContext}
        />
        <AssignIssueForm
          issueId={issue.id}
          assignedToId={issue.assignedTo}
          users={allUsers}
          currentUserId={currentUserId}
          accessLevel={accessLevel}
          ownershipContext={ownershipContext}
        />
      </div>

      <div className={cardClassName} data-testid="issue-context-rows">
        <ContextRow label="Machine">
          <Link
            href={`/m/${issue.machineInitials}`}
            className={linkClassName}
            data-testid="details-machine-link"
          >
            {issue.machine.name}
          </Link>
        </ContextRow>
        <ContextRow label="Owner" testId="details-owner">
          {ownerName && ownerId ? (
            <Link href={`/issues?owner=${ownerId}`} className={linkClassName}>
              {ownerName}
            </Link>
          ) : (
            <span
              className={
                ownerName
                  ? "truncate font-medium text-foreground"
                  : "text-muted-foreground"
              }
            >
              {ownerName ?? "None"}
            </span>
          )}
        </ContextRow>
        <ContextRow label="Reported" testId="details-reported">
          <span className="font-medium text-foreground">{reporter.name}</span>
          <ExactRelativeTime
            value={issue.createdAt.toISOString()}
            fallback={formatDateTime(issue.createdAt)}
          />
        </ContextRow>
        <ContextRow label="Updated" testId="details-updated">
          <ExactRelativeTime
            value={issue.updatedAt.toISOString()}
            fallback={formatDateTime(issue.updatedAt)}
            className="font-medium text-foreground"
          />
        </ContextRow>
        <ContextRow label="Watching" testId="details-watching">
          <WatchButton
            issueId={issue.id}
            watcherCount={issue.watchers.length}
            initialIsWatching={isWatching}
            canWatch={accessLevel !== "unauthenticated"}
          />
        </ContextRow>
      </div>
    </div>
  );
}
