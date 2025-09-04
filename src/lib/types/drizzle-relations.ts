import type {
  Machine,
  Model,
  Location,
  Issue,
  IssueStatus,
  Priority,
  User,
  Comment,
} from "./db";

export type MachineWithRelations = Machine & {
  model?: Model | null;
  location?: Location | null;
};

export type IssueWithRelations = Issue & {
  machine?: Machine | null;
  status?: IssueStatus | null;
  priority?: Priority | null;
  assignedTo?: User | null;
  createdBy?: User | null;
};

export type CommentWithRelations = Comment & {
  author?: User | null;
  issue?: Issue | null;
};