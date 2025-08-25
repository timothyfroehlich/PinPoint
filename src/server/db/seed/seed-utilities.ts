/**
 * Shared Seed Utilities - Unified Patterns & DRY Compliance
 *
 * Centralized utilities to eliminate code duplication across seed files.
 * Provides consistent logging, validation, error handling, and ID mapping.
 *
 * Replaces scattered patterns with:
 * - SeedLogger: Unified logging with consistent prefixes
 * - SeedValidator: Reusable validation logic
 * - SeedMapper: ID resolution to eliminate switch statements
 * - SeedError: Standardized error handling
 */

import { SEED_TEST_IDS, STATIC_MAPPINGS } from "./constants";
import { env } from "~/env.js";

// ============================================================================
// Types & Interfaces
// ============================================================================

export type SeedTarget = "local:pg" | "local:sb" | "preview";
export type DataAmount = "minimal" | "full";

export interface SeedResult<T> {
  success: boolean;
  data: T;
  recordsCreated: number;
  duration: number;
  errors?: string[];
}

export interface ValidationResult {
  success: boolean;
  errors: string[];
}

export interface SeedConfig {
  target: SeedTarget;
  dataAmount: DataAmount;
  environment: string;
  supabaseUrl?: string;
  requiresAuth: boolean;
  requiresConfirmation: boolean;
}

// ============================================================================
// Seed Logger - Unified Logging System
// ============================================================================

export class SeedLogger {
  private static isTestMode = env.NODE_ENV === "test" || Boolean(env.VITEST);

  /**
   * Log minimal progress message
   */
  static info(message: string): void {
    if (!this.isTestMode) {
      console.log(`[SEED] ${message}`);
    }
  }

  /**
   * Log completion with checkmark
   */
  static success(message: string): void {
    if (!this.isTestMode) {
      console.log(`[SEED] ✅ ${message}`);
    }
  }

  /**
   * Log error with context
   */
  static error(context: string, error: unknown): void {
    console.error(`[SEED] ❌ ${context}:`, error);
  }

  /**
   * Log warning with context (only for important safety messages)
   */
  static warn(message: string): void {
    if (!this.isTestMode) {
      console.log(`[SEED] ⚠️  ${message}`);
    }
  }
}

// ============================================================================
// Seed Validator - Reusable Validation Logic
// ============================================================================

export class SeedValidator {
  private static readonly VALID_TARGETS: SeedTarget[] = [
    "local:pg",
    "local:sb",
    "preview",
  ];
  private static readonly VALID_DATA_AMOUNTS: DataAmount[] = [
    "minimal",
    "full",
  ];

  /**
   * Validate seed target parameter
   */
  static validateTarget(target: string): target is SeedTarget {
    return this.VALID_TARGETS.includes(target as SeedTarget);
  }

  /**
   * Validate data amount parameter
   */
  static validateDataAmount(dataAmount: string): dataAmount is DataAmount {
    return this.VALID_DATA_AMOUNTS.includes(dataAmount as DataAmount);
  }

  /**
   * Validate environment-specific requirements
   */
  static validateEnvironment(
    target: SeedTarget,
    supabaseUrl?: string,
  ): ValidationResult {
    const errors: string[] = [];

    // Preview environment validation
    if (target === "preview") {
      if (!supabaseUrl?.includes("supabase.co")) {
        errors.push(
          "Preview environment requires remote Supabase URL (must contain 'supabase.co')",
        );
      }
    }

    return {
      success: errors.length === 0,
      errors,
    };
  }

  /**
   * Comprehensive validation of all seed parameters
   */
  static validateAll(params: {
    target: string;
    dataAmount: string;
    environment: string;
    supabaseUrl?: string;
  }): ValidationResult {
    const errors: string[] = [];

    // Parameter validation
    if (!this.validateTarget(params.target)) {
      errors.push(
        `Invalid target: ${String(params.target)}. Valid targets: ${this.VALID_TARGETS.join(", ")}`,
      );
    }

    if (!this.validateDataAmount(params.dataAmount)) {
      errors.push(
        `Invalid data amount: ${String(params.dataAmount)}. Valid amounts: ${this.VALID_DATA_AMOUNTS.join(", ")}`,
      );
    }

    // Environment validation
    if (this.validateTarget(params.target)) {
      const envValidation = this.validateEnvironment(
        params.target,
        params.supabaseUrl,
      );
      errors.push(...envValidation.errors);
    }

    // Safety check for preview mode in development
    if (params.target === "preview" && params.environment === "development") {
      errors.push(
        "Preview target is not allowed in development environment. Use 'local:sb' instead.",
      );
    }

    return {
      success: errors.length === 0,
      errors,
    };
  }

  /**
   * Show usage help for invalid parameters
   */
  static showUsage(): void {
    console.error(
      "Usage: tsx src/server/db/seed/index.ts <target> <dataAmount>",
    );
    console.error("");
    console.error("Targets:");
    console.error("  local:pg  - PostgreSQL-only seeding for CI tests");
    console.error("  local:sb  - Local Supabase seeding for development");
    console.error("  preview   - Remote preview environment seeding");
    console.error("");
    console.error("Data Amounts:");
    console.error(
      "  minimal   - Basic test data (3 users, 6 machines, 10 issues)",
    );
    console.error(
      "  full      - Complete sample data (3 users, 60+ machines, 200+ issues)",
    );
    console.error("");
    console.error("Examples:");
    console.error("  tsx src/server/db/seed/index.ts local:sb minimal");
    console.error("  tsx src/server/db/seed/index.ts preview full");
  }
}

// ============================================================================
// Seed Mapper - ID Resolution Without Switch Statements
// ============================================================================

export class SeedMapper {
  /**
   * Get membership ID for user email and organization
   * Replaces switch statements with mapping object lookups
   */
  static getMembershipId(email: string, organization_id: string): string {
    const mapping =
      STATIC_MAPPINGS.EMAIL_TO_MEMBERSHIP[
        email as keyof typeof STATIC_MAPPINGS.EMAIL_TO_MEMBERSHIP
      ];
    if (!mapping) {
      throw new SeedError(
        "MAPPER",
        `get membership ID for unknown email: ${email}`,
      );
    }

    const isPrimary = organization_id === SEED_TEST_IDS.ORGANIZATIONS.primary;
    return isPrimary ? mapping.primary : mapping.competitor;
  }

  /**
   * Get priority ID for priority name and organization
   * Replaces switch statements with mapping object lookups
   */
  static getPriorityId(priorityName: string, organization_id: string): string {
    const mapping =
      STATIC_MAPPINGS.PRIORITY_NAMES[
        priorityName as keyof typeof STATIC_MAPPINGS.PRIORITY_NAMES
      ];
    if (!mapping) {
      throw new SeedError(
        "MAPPER",
        `get priority ID for unknown priority: ${priorityName}`,
      );
    }

    const isPrimary = organization_id === SEED_TEST_IDS.ORGANIZATIONS.primary;
    return isPrimary ? mapping.primary : mapping.competitor;
  }

  /**
   * Get status ID for status name and organization
   * Replaces switch statements with mapping object lookups
   */
  static getStatusId(statusName: string, organization_id: string): string {
    const mapping =
      STATIC_MAPPINGS.STATUS_NAMES[
        statusName as keyof typeof STATIC_MAPPINGS.STATUS_NAMES
      ];
    if (!mapping) {
      throw new SeedError(
        "MAPPER",
        `get status ID for unknown status: ${statusName}`,
      );
    }

    const isPrimary = organization_id === SEED_TEST_IDS.ORGANIZATIONS.primary;
    return isPrimary ? mapping.primary : mapping.competitor;
  }

  /**
   * Get role ID for role name and organization
   */
  static getRoleId(roleName: string, organization_id: string): string {
    const mapping =
      STATIC_MAPPINGS.ROLE_NAMES[
        roleName as keyof typeof STATIC_MAPPINGS.ROLE_NAMES
      ];
    if (!mapping) {
      throw new SeedError(
        "MAPPER",
        `get role ID for unknown role: ${roleName}`,
      );
    }

    const isPrimary = organization_id === SEED_TEST_IDS.ORGANIZATIONS.primary;
    return isPrimary ? mapping.primary : mapping.competitor;
  }

  /**
   * Get collection type ID for collection type name and organization
   * Replaces switch statements with mapping object lookups
   */
  static getCollectionTypeId(
    typeName: string,
    organization_id: string,
  ): string {
    const mapping =
      STATIC_MAPPINGS.COLLECTION_TYPE_NAMES[
        typeName as keyof typeof STATIC_MAPPINGS.COLLECTION_TYPE_NAMES
      ];
    if (!mapping) {
      throw new SeedError(
        "MAPPER",
        `get collection type ID for unknown type: ${typeName}`,
      );
    }

    const isPrimary = organization_id === SEED_TEST_IDS.ORGANIZATIONS.primary;
    return isPrimary ? mapping.primary : mapping.competitor;
  }
}

// ============================================================================
// Error Handling Utilities
// ============================================================================

export class SeedError extends Error {
  constructor(context: string, operation: string, cause?: unknown) {
    super(`[SEED:${context}] Failed to ${operation}`);
    this.name = "SeedError";
    this.cause = cause;
  }
}

/**
 * Execute function with consistent error handling context
 */
export async function withErrorContext<T>(
  context: string,
  operation: string,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw new SeedError(context, operation, error);
  }
}

/**
 * Create successful seed result
 */
export function createSeedResult<T>(
  data: T,
  recordsCreated: number,
  startTime: number,
): SeedResult<T> {
  return {
    success: true,
    data,
    recordsCreated,
    duration: Date.now() - startTime,
  };
}

/**
 * Create failed seed result
 */
export function createFailedSeedResult<T>(
  error: unknown,
  startTime: number,
): SeedResult<T> {
  return {
    success: false,
    data: {} as T,
    recordsCreated: 0,
    duration: Date.now() - startTime,
    errors: [error instanceof Error ? error.message : String(error)],
  };
}

// ============================================================================
// Configuration Builder
// ============================================================================

export class SeedConfigBuilder {
  private config: Partial<SeedConfig> = {};

  static forTarget(target: SeedTarget): SeedConfigBuilder {
    const builder = new SeedConfigBuilder();
    builder.config.target = target;
    return builder;
  }

  withDataAmount(dataAmount: DataAmount): this {
    this.config.dataAmount = dataAmount;
    return this;
  }

  withEnvironment(environment: string): this {
    this.config.environment = environment;
    return this;
  }

  withSupabaseUrl(supabaseUrl: string): this {
    this.config.supabaseUrl = supabaseUrl;
    return this;
  }

  build(): SeedConfig {
    const { target, dataAmount, environment, supabaseUrl } = this.config;

    if (!target || !dataAmount || !environment) {
      throw new SeedError(
        "CONFIG",
        "build config with missing required parameters",
      );
    }

    const config: SeedConfig = {
      target,
      dataAmount,
      environment,
      requiresAuth: target !== "local:pg",
      requiresConfirmation: target === "preview",
    };

    if (supabaseUrl) {
      config.supabaseUrl = supabaseUrl;
    }

    return config;
  }
}

// ============================================================================
// Safety & Confirmation Utilities
// ============================================================================

/**
 * Show safety warning and require confirmation for destructive operations
 */
export async function confirmDestructiveOperation(
  target: SeedTarget,
): Promise<void> {
  if (target !== "preview") return;

  SeedLogger.warn(
    "PREVIEW MODE - Will delete existing dev users! (3s to abort...)",
  );

  // Add brief delay for manual cancellation
  await new Promise((resolve) => setTimeout(resolve, 3000));
}
