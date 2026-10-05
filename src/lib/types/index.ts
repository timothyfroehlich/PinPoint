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
  IssueFrequency,
  PinballmapRuntimeState,
} from "./database";

export {
  ISSUE_SEVERITY_VALUES,
  ISSUE_PRIORITY_VALUES,
  ISSUE_FREQUENCY_VALUES,
} from "./database";

export type { UserContext, UserRole } from "./user";
export type { ReportMode } from "./user";
export { USER_ROLES, REPORT_MODE_VALUES } from "./user";

export type {
  IssueCommentWithAuthor,
  IssueListItem,
  IssueListRow,
  IssueWithAllRelations,
} from "./issue";

export type { UnifiedUser, UserStatus, MachineOwner } from "./user";

export {
  MACHINE_VIEW_FIELD_IDS,
  type MachineViewBuiltInView,
  type MachineViewFieldId,
  type MachineViewHealth,
  type MachineViewOwnerOption,
  type MachinePresenceWidgetStatus,
  type MachineViewPageSize,
  type MachineViewPresetId,
  type MachineViewResult,
  type MachineViewRow,
  type MachineViewSavedState,
  type MachineViewSavedViews,
  type MachineViewSavedViewSummary,
  type MachineViewScope,
  type MachineViewSortDirection,
  type MachineViewState,
  type MachineViewSummary,
} from "./machine-view";

export {
  LIST_HOSTS,
  LIST_PAGE_SIZES,
  SAVED_VIEW_NAME_MAX,
  type DefaultViewTarget,
  type ListBuiltInView,
  type ListHost,
  type ListPageSize,
  type ListSavedViews,
  type ListSavedViewSummary,
  type SavedViewError,
  type StoredSavedView,
} from "./list-view";

export { type IssueListSummary } from "./summary-widget";
