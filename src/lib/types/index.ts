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
  IssueConsistency,
} from "./database";

export type { UserContext, UserRole } from "./user";
export { USER_ROLES } from "./user";

export type {
  IssueCommentWithAuthor,
  IssueListItem,
  IssueWithAllRelations,
} from "./issue";

export type { UnifiedUser, UserStatus, MachineOwner } from "./user";
