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
  IssueStatus,
  IssueSeverity,
  IssuePriority,
} from "./database";

export type { UserRole } from "./user";

export type {
  IssueCommentWithAuthor,
  IssueListItem,
  IssueWithAllRelations,
} from "./issue";

export type { UnifiedUser, UserStatus, MachineOwner } from "./user";
