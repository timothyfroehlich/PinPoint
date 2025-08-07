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
  sampleData: "none" | "minimal" | "full";
  resetDatabase: boolean;
  authUsersEnabled: boolean;
}

export interface ValidationResult {
  valid: boolean;
  backend: "local-postgres" | "local-supabase" | "remote-supabase";
  details: string;
  errors?: string[];
}

export interface SeedingResult {
  success: boolean;
  organizationId?: string;
  usersCreated: number;
  sampleDataCreated: boolean;
  duration: number;
  errors?: string[];
}

export type SeedingTarget = "local:pg" | "local:sb" | "preview" | "prod";
