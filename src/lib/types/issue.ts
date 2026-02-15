import type {
  Issue,
  IssueComment,
  Machine,
  UserProfile,
  IssueImage,
} from "./database";

export type IssueCommentWithAuthor = Pick<
  IssueComment,
  "id" | "content" | "createdAt" | "updatedAt" | "isSystem"
> & {
  author?: Pick<UserProfile, "id" | "name" | "avatarUrl"> | null;
  images: IssueImage[];
};

export type IssueListItem = Pick<
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
  reportedByUser?: Pick<UserProfile, "id" | "name"> | null;
  invitedReporter?: Pick<UserProfile, "id" | "name"> | null;
  assignedToUser?: Pick<UserProfile, "id" | "name"> | null;
};

export type IssueWithAllRelations = Issue & {
  machine: Pick<Machine, "id" | "name"> & {
    owner?: Pick<UserProfile, "id" | "name"> | null;
    invitedOwner?: {
      id: string;
      name: string;
    } | null;
  };
  reportedByUser?: Pick<UserProfile, "id" | "name" | "avatarUrl"> | null;
  invitedReporter?: {
    id: string;
    name: string;
  } | null;
  assignedToUser?: Pick<UserProfile, "id" | "name"> | null;
  comments: IssueCommentWithAuthor[];
  watchers: { userId: string }[];
  images: IssueImage[];
};
