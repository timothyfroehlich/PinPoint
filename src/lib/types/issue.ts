import type { Issue, IssueComment, Machine, UserProfile } from "./database";

export type IssueCommentWithAuthor = Pick<
  IssueComment,
  "id" | "content" | "createdAt" | "isSystem"
> & {
  author?: Pick<UserProfile, "id" | "name" | "email"> | null;
};

export type IssueListItem = Issue & {
  machine: Pick<Machine, "id" | "name">;
  reportedByUser?: Pick<UserProfile, "id" | "name" | "email"> | null;
  assignedToUser?: Pick<UserProfile, "id" | "name" | "email"> | null;
};

export type IssueWithAllRelations = Issue & {
  machine: Pick<Machine, "id" | "name"> & {
    owner?: Pick<UserProfile, "id" | "name"> | null;
    invitedOwner?: {
      id: string;
      name: string;
    } | null;
  };
  reportedByUser?: Pick<UserProfile, "id" | "name" | "email"> | null;
  invitedReporter?: {
    id: string;
    name: string;
    email: string | null;
  } | null;
  assignedToUser?: Pick<UserProfile, "id" | "name" | "email"> | null;
  comments: IssueCommentWithAuthor[];
  watchers: { userId: string }[];
};
