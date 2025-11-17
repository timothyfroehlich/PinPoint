// Shared TypeScript types for PinPoint
// Export reusable domain types here as the project grows

export type {
  UserProfile,
  Machine,
  Issue,
  IssueComment,
  NewUserProfile,
  NewMachine,
  NewIssue,
  NewIssueComment,
  UserRole,
  IssueStatus,
  IssueSeverity,
} from "./database";

export type { IssueCommentWithAuthor, IssueWithAllRelations } from "./issue";
