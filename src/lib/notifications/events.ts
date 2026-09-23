import type { IssueStatus } from "~/lib/issues/status";
import type { IssueFrequency, IssueSeverity } from "~/lib/types";

export type NotificationType =
  | "issue_assigned"
  | "issue_status_changed"
  | "new_comment"
  | "new_issue"
  | "machine_ownership_changed"
  | "mentioned";

export type NotificationChannelKey = "email" | "in_app" | "discord";

export type RecipientReason =
  | "assignee"
  | "mentioned"
  | "machine_owner"
  | "machine_watcher"
  | "issue_watcher"
  | "global_watcher"
  | "actor"
  | "ownership_added"
  | "ownership_removed";

interface NotificationEventBase {
  resourceId: string;
  actorId?: string | undefined;
  /** Safe public display name; the planner resolves a linked profile when omitted. */
  actorName?: string | undefined;
  includeActor?: boolean | undefined;
  additionalRecipientIds?: readonly string[] | undefined;
  /** Restrict an event candidate to specific channels. Defaults to all channels. */
  channelKeys?: readonly NotificationChannelKey[] | undefined;
  /** Persisted occurrence identifier used by external-channel idempotency. */
  eventId: string;
}

interface IssueEventBase extends NotificationEventBase {
  resourceType: "issue";
  issueTitle?: string | undefined;
  machineName?: string | undefined;
  formattedIssueId?: string | undefined;
}

export type NotificationEvent =
  | (IssueEventBase & {
      type: "new_issue";
      issueDescription?: string | undefined;
      severity?: IssueSeverity | undefined;
      frequency?: IssueFrequency | undefined;
    })
  | (IssueEventBase & {
      type: "issue_assigned";
      issueDescription?: string | undefined;
      severity?: IssueSeverity | undefined;
    })
  | (IssueEventBase & {
      type: "issue_status_changed";
      oldStatus: IssueStatus;
      newStatus: IssueStatus;
    })
  | (IssueEventBase & {
      type: "new_comment";
      commentContent?: string | undefined;
      commentId?: string | undefined;
      attachmentCount?: number | undefined;
    })
  | (IssueEventBase & {
      type: "mentioned";
      commentContent?: string | undefined;
      commentId?: string | undefined;
      attachmentCount?: number | undefined;
    })
  | (NotificationEventBase & {
      type: "machine_ownership_changed";
      resourceType: "machine";
      machineName?: string | undefined;
      machineInitials?: string | undefined;
      ownershipChange: "added" | "removed";
    });
