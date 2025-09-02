/**
 * Test Types
 *
 * Type definitions for test utilities, mock objects, and test scenarios.
 * Centralizes test-related interfaces for reuse across test files.
 */

// Mock data interfaces for seed-based testing
export interface MockUser {
  id: string;
  name: string;
  email: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

export interface MockOrganization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface MockMachine {
  id: string;
  name: string;
  model_id: string;
  location_id: string;
  organization_id: string;
  status: "active" | "maintenance" | "retired";
  created_at: string;
  updated_at: string;
}

export interface MockIssue {
  id: string;
  title: string;
  description: string;
  machine_id: string;
  organization_id: string;
  status_id: string;
  priority_id: string;
  assigned_to_id: string | null;
  created_by_id: string;
  created_at: string;
  updated_at: string;
}

export interface MockIssueStatus {
  id: string;
  name: string;
  organization_id: string;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface MockPriority {
  id: string;
  name: string;
  organization_id: string;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
