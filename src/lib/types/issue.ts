import type {
  Issue,
  IssueComment,
  Machine,
  UserProfile,
  IssueImage,
} from "./database";
import type { ResolvedTimelineEvent } from "~/lib/timeline/types";

export type IssueCommentWithAuthor = Pick<
  IssueComment,
  "id" | "content" | "createdAt" | "updatedAt" | "isSystem"
> & {
  /** The stored event with its person references resolved for display. */
  eventData: ResolvedTimelineEvent | null;
  author?: Pick<UserProfile, "id" | "name"> | null;
  images: IssueImage[];
};

/** One row of an issue list page (issues-list §3). */
export type IssueListRow = Pick<
  Issue,
  | "id"
  | "issueNumber"
  | "title"
  | "status"
  | "severity"
  | "priority"
  | "frequency"
  | "createdAt"
  | "updatedAt"
  | "machineInitials"
  | "reporterName"
  | "assignedTo"
> & {
  machine: Pick<Machine, "id" | "name">;
  assignedToUser: Pick<UserProfile, "id" | "name"> | null;
};

// reporterEmail is intentionally excluded: the only query that produces this
// shape sets `columns: { reporterEmail: false }` to enforce CORE-SEC-007 email
// privacy at runtime, and no consumer of this type reads it. Omitting it here
// keeps the type honest and lets the exclusion be checked by the compiler.
export type IssueWithAllRelations = Omit<Issue, "reporterEmail"> & {
  machine: Pick<Machine, "id" | "name" | "ownerRequirements"> & {
    owner?: Pick<UserProfile, "id" | "name"> | null;
    invitedOwner?: {
      id: string;
      name: string;
    } | null;
  };
  reportedByUser?: Pick<UserProfile, "id" | "name"> | null;
  invitedReporter?: {
    id: string;
    name: string;
  } | null;
  assignedToUser?: Pick<UserProfile, "id" | "name"> | null;
  comments: IssueCommentWithAuthor[];
  watchers: { userId: string }[];
  images: IssueImage[];
};
