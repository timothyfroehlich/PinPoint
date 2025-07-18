// TypeScript interfaces for Issue Detail components

export interface IssueStatus {
  id: string;
  name: string;
  color?: string;
  category: "NEW" | "IN_PROGRESS" | "RESOLVED";
}

export interface Priority {
  id: string;
  name: string;
  color?: string;
  order: number;
}

export interface User {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

export interface Model {
  id: string;
  name: string;
  manufacturer: string | null;
  year: number | null;
}

export interface Location {
  id: string;
  name: string;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  address?: string; // Computed property for display
}

export interface Machine {
  id: string;
  name: string;
  serialNumber?: string | null;
  qrCodeId: string;
  model: Model;
  location: Location;
}

export interface Comment {
  id: string;
  content: string;
  isInternal: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  author: User;
  createdBy: User; // Alias for compatibility
}

export interface Attachment {
  id: string;
  filename: string;
  url: string;
  contentType: string;
  size: number;
  createdAt: Date;
}

export interface IssueActivity {
  id: string;
  type:
    | "CREATED"
    | "STATUS_CHANGED"
    | "ASSIGNED"
    | "PRIORITY_CHANGED"
    | "COMMENTED"
    | "COMMENT_DELETED"
    | "ATTACHMENT_ADDED"
    | "MERGED"
    | "RESOLVED"
    | "REOPENED"
    | "SYSTEM";
  field: string;
  oldValue?: string | null;
  newValue?: string | null;
  changedAt: Date;
  actor?: User | null;
}

export interface IssueWithDetails {
  id: string;
  title: string;
  description: string | null;
  consistency?: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date | null;
  organizationId: string;
  machineId: string;
  statusId: string;
  priorityId: string;
  createdById: string;
  assignedToId?: string | null;
  machine: Machine;
  priority: Priority;
  status: IssueStatus;
  createdBy: User;
  assignedTo?: User | null;
  comments: Comment[];
  attachments: Attachment[];
  activities?: IssueActivity[];
}
