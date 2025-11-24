import type { Issue, IssueComment, Machine, UserProfile } from "./database";

export type IssueCommentWithAuthor = Pick<
  IssueComment,
  "id" | "content" | "createdAt" | "isSystem"
> & {
  author?: Pick<UserProfile, "id" | "name"> | null;
};

export type IssueListItem = Issue & {
  machine: Pick<Machine, "id" | "name">;
  reportedByUser?: Pick<UserProfile, "id" | "name"> | null;
  assignedToUser?: Pick<UserProfile, "id" | "name"> | null;
};

export type IssueWithAllRelations = Issue & {
  machine: Pick<Machine, "id" | "name">;
  reportedByUser?: Pick<UserProfile, "id" | "name"> | null;
  assignedToUser?: Pick<UserProfile, "id" | "name"> | null;
  comments: IssueCommentWithAuthor[];
};
