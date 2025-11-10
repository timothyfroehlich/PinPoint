/**
 * Shared Types for Explicit Database Seeding
 *
 * Common interfaces and types used across seeding scripts.
 */

export interface UserData {
  name: string;
  email: string;
  role: string;
  bio?: string;
}

export interface SeedingConfig {
  users: UserData[];
  sample_data: "none" | "minimal" | "full";
  reset_database: boolean;
  auth_users_enabled: boolean;
}

export interface ValidationResult {
  valid: boolean;
  backend: "local-postgres" | "local-supabase" | "remote-supabase";
  details: string;
  errors?: string[];
}

export interface SeedingResult {
  success: boolean;
  organization_id?: string;
  users_created: number;
  sample_dataCreated: boolean;
  duration: number;
  errors?: string[];
}

export type SeedingTarget = "local:pg" | "local:sb" | "preview" | "prod";
