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
  email?: string | null; // Optional to match Drizzle schema
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
  serial_number?: string | null;
  qr_code_id: string | null;
  model: Model;
  location: Location;
}

export interface Comment {
  id: string;
  content: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
  author: User;
  createdBy: User; // Alias for compatibility - maps to author
}

export interface Attachment {
  id: string;
  file_name: string; // Match Drizzle field name
  url: string;
  file_type: string; // Match Drizzle field name
  created_at: Date;
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
  old_value?: string | null;
  new_value?: string | null;
  changed_at: Date;
  actor?: User | null;
}

export interface IssueWithDetails {
  id: string;
  title: string;
  description: string | null;
  consistency?: string | null;
  created_at: Date;
  updated_at: Date;
  resolved_at?: Date | null;
  reporter_email?: string | null; // For anonymous issue reporting
  submitter_name?: string | null; // Optional name for anonymous issue reporting
  organization_id: string;
  machine_id: string;
  status_id: string;
  priority_id: string;
  created_by_id: string | null;
  assigned_to_id?: string | null;
  machine: Machine;
  priority: Priority;
  status: IssueStatus;
  createdBy?: User | null;
  assignedTo?: User | null;
  comments: Comment[];
  attachments: Attachment[];
  activities?: IssueActivity[];
}
