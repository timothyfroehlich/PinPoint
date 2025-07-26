/**
 * Shared tooling configuration for PinPoint
 *
 * This file centralizes file patterns and settings used across:
 * - TypeScript configs (tsconfig.json, tsconfig.test-utils.json, tsconfig.tests.json)
 * - ESLint config (eslint.config.js)
 * - Vitest config (vitest.config.ts)
 *
 * Approach: Industry-standard explicit inclusion patterns
 * - Each tool explicitly includes only the files it should process
 * - Clear separation between production, test utilities, and test files
 * - Follows patterns documented by TypeScript ESLint and Vitest
 */

/**
 * File inclusion patterns for different code contexts
 * These patterns explicitly define what each tool should process
 */
export const INCLUDE_PATTERNS = {
  // Production source code - strictest standards
  production: ["./src/**/*.{ts,tsx}"],

  // Test utility files - moderate standards (reusable test code)
  testUtils: ["./src/test/**/*.{ts,tsx}"],

  // Test files - relaxed standards (pragmatic testing patterns)
  tests: [
    "./src/**/*.test.{ts,tsx}",
    "./src/**/*.spec.{ts,tsx}",
    "./src/**/__tests__/**/*.{ts,tsx}",
    "./src/integration-tests/**/*.{ts,tsx}",
    "./e2e/**/*.{ts,tsx}",
  ],

  // Build and configuration files
  config: ["./*.config.{js,ts}", "./scripts/**/*.{js,ts}", "./prisma/**/*.ts"],
} as const;

/**
 * Exclusion patterns for production code
 * Used by tools that need to exclude test files from production rules
 */
export const EXCLUDE_PATTERNS = {
  production: [
    "./src/test/**/*",
    "./src/**/*.test.*",
    "./src/**/*.spec.*",
    "./src/**/__tests__/**/*",
    "./src/integration-tests/**/*",
  ],
} as const;

/**
 * TypeScript compiler configurations for different contexts
 * Based on @tsconfig/* packages for consistency
 */
export const TYPESCRIPT_CONFIGS = {
  // Production: @tsconfig/strictest equivalent
  production: {
    strict: true,
    exactOptionalPropertyTypes: true,
    noUncheckedIndexedAccess: true,
    noImplicitReturns: true,
    noFallthroughCasesInSwitch: true,
    noUncheckedSideEffectImports: true,
  },

  // Test utilities: @tsconfig/recommended equivalent
  testUtils: {
    strict: true,
    strictNullChecks: true,
    noImplicitReturns: true,
    noFallthroughCasesInSwitch: true,
    // Allow more flexibility than production
    exactOptionalPropertyTypes: false,
    noUncheckedIndexedAccess: false,
  },

  // Tests: Relaxed for pragmatic testing
  tests: {
    strict: false,
    // Allow any types and flexible patterns for mocking
    noImplicitAny: false,
    strictNullChecks: false,
    exactOptionalPropertyTypes: false,
    noUncheckedIndexedAccess: false,
  },
} as const;

/**
 * ESLint rule configurations by context
 */
export const ESLINT_RULES = {
  // Production code - strict type safety
  production: {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unsafe-assignment": "error",
    "@typescript-eslint/no-unsafe-argument": "error",
    "@typescript-eslint/no-unsafe-call": "error",
    "@typescript-eslint/no-unsafe-member-access": "error",
    "@typescript-eslint/no-unsafe-return": "error",
    "@typescript-eslint/no-unsafe-enum-comparison": "error",
  },

  // Test utilities - moderate warnings
  testUtils: {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unsafe-assignment": "warn",
    "@typescript-eslint/no-unsafe-argument": "warn",
    "@typescript-eslint/no-unsafe-call": "warn",
    "@typescript-eslint/no-unsafe-member-access": "warn",
    "@typescript-eslint/no-unsafe-return": "warn",
    "@typescript-eslint/no-unsafe-enum-comparison": "warn",
  },

  // Test files - allow pragmatic patterns
  tests: {
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unsafe-assignment": "off",
    "@typescript-eslint/no-unsafe-argument": "off",
    "@typescript-eslint/no-unsafe-call": "off",
    "@typescript-eslint/no-unsafe-member-access": "off",
    "@typescript-eslint/no-unsafe-return": "off",
    "@typescript-eslint/no-unsafe-enum-comparison": "off",
    "@typescript-eslint/explicit-function-return-type": "off",
    // E2E test specific relaxations
    "@typescript-eslint/restrict-template-expressions": "off",
    "@typescript-eslint/require-await": "off",
    "@typescript-eslint/no-unused-vars": "off",
  },
} as const;

/**
 * Helper functions for converting between tool-specific pattern formats
 */
export const convertPatterns = {
  /**
   * Convert inclusion patterns for ESLint (no './' prefix)
   */
  forESLint: (patterns: readonly string[]): string[] => {
    return patterns.map((pattern) =>
      pattern.startsWith("./") ? pattern.slice(2) : pattern,
    );
  },

  /**
   * Convert inclusion patterns for TypeScript configs (no './' prefix)
   */
  forTSConfig: (patterns: readonly string[]): string[] => {
    return patterns.map((pattern) =>
      pattern.startsWith("./") ? pattern.slice(2) : pattern,
    );
  },
} as const;

/**
 * Standard severity levels for consistent tooling
 */
export const SEVERITY = {
  ERROR: "error",
  WARN: "warn",
  OFF: "off",
} as const;

// Type exports for better IDE support
export type IncludePatternsKey = keyof typeof INCLUDE_PATTERNS;
export type TypeScriptConfigKey = keyof typeof TYPESCRIPT_CONFIGS;
export type ESLintRulesKey = keyof typeof ESLINT_RULES;
