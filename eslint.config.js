// eslint.config.js

import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";
import promisePlugin from "eslint-plugin-promise";
import unusedImportsPlugin from "eslint-plugin-unused-imports";
// Phase 0: Modern security and quality plugins
import vitestPlugin from "@vitest/eslint-plugin";
import securityPlugin from "eslint-plugin-security";
import sdlPlugin from "@microsoft/eslint-plugin-sdl";
import {
  INCLUDE_PATTERNS,
  ESLINT_RULES,
  convertPatterns,
} from "./tooling.config.js";
// Custom ESLint rules
import noLegacyAuthImports from "./eslint-rules/no-legacy-auth-imports.js";
import noDuplicateAuthResolution from "./eslint-rules/no-duplicate-auth-resolution.js";
import noMissingCacheWrapper from "./eslint-rules/no-missing-cache-wrapper.js";
import noDirectSupabaseClient from "./eslint-rules/no-direct-supabase-client.js";

export default tseslint.config(
  // TypeScript ESLint base configurations
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    // Enable type-aware linting with explicit project configuration
    languageOptions: {
      parserOptions: {
        // Use explicit project paths for reliable type checking
        project: [
          "./tsconfig.json",
          "./tsconfig.config.json",
          "./tsconfig.tests.json",
          "./tsconfig.seed.json",
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  {
    // Main configuration for all TS/TSX files
    files: convertPatterns.forESLint(INCLUDE_PATTERNS.production),
    plugins: {
      "@next/next": nextPlugin,
      promise: promisePlugin,
      "unused-imports": unusedImportsPlugin,
      // Phase 0: Modern security and quality plugins
      vitest: vitestPlugin,
      security: securityPlugin,
      "@microsoft/sdl": sdlPlugin,
      // Custom rules
      legacyAuth: {
        rules: {
          "no-legacy-auth-imports": noLegacyAuthImports,
        },
      },
      duplicateAuth: {
        rules: {
          "no-duplicate-auth-resolution": noDuplicateAuthResolution,
        },
      },
      missingCache: {
        rules: {
          "no-missing-cache-wrapper": noMissingCacheWrapper,
        },
      },
      directSupabase: {
        rules: {
          "no-direct-supabase-client": noDirectSupabaseClient,
        },
      },
    },
    rules: {
      // Existing Next.js rules
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,

      // Phase 0: Modern security and quality rules

      // Security hardening (Phase 0)
      // Critical security vulnerabilities
      "security/detect-eval-with-expression": "error",
      "security/detect-non-literal-require": "error",
      "security/detect-child-process": "error",
      "security/detect-object-injection": "warn", // Many false positives in TypeScript
      "security/detect-unsafe-regex": "error",
      "security/detect-possible-timing-attacks": "warn", // Can be noisy in tests

      // Web security essentials
      "@microsoft/sdl/no-inner-html": "error",
      "@microsoft/sdl/no-document-write": "error",
      "@microsoft/sdl/no-insecure-url": "error",
      "@microsoft/sdl/no-postmessage-star-origin": "error",

      // Test quality (only for test files - will be properly scoped)
      "vitest/consistent-test-it": "off", // Enable only in test files
      "vitest/no-disabled-tests": "off", // Enable only in test files
      "vitest/no-focused-tests": "off", // Enable only in test files

      // Custom Drizzle safety and Lane B cache enforcement
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name='delete']:not([arguments.0])",
          message: "DELETE operations must include WHERE clause",
        },
        {
          selector:
            "CallExpression[callee.property.name='update']:not([arguments.0])",
          message: "UPDATE operations must include WHERE clause",
        },
        // Lane B: Cache() rules for data fetching functions only (too broad - disabled for now)
        // Use the custom missingCache/no-missing-cache-wrapper rule instead for more targeted detection
      ],

      // Rule to enforce use of validated env object
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message:
            "Use the 'env' object from '~/env' (server context) or utilities from '~/lib/environment-client' (client context) instead of 'process.env'. For server: import { env } from '~/env'. For client: import { isDevelopment } from '~/lib/environment-client'. See T3 Env documentation: https://env.t3.gg/docs/introduction",
        },
      ],

      // Rules for unused imports
      "@typescript-eslint/no-unused-vars": "off", // Disable base rule to use unused-imports plugin
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],

      // Prevent deep relative imports - encourage use of ~/path aliases
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "~/server/auth/legacy-adapters",
              message:
                "Legacy auth adapters have been removed. Use getRequestAuthContext() from ~/server/auth/context instead.",
            },
          ],
          patterns: [
            {
              group: ["../../*", "../../../*", "../../../../*"],
              message:
                "Use the '~/' path alias instead of deep relative imports (../../). This improves maintainability and prevents broken imports when files are moved.",
            },
            // Lane B: DAL cross-import prevention
            {
              group: ["../lib/dal/*", "../../lib/dal/*"],
              message:
                "Use '~/lib/dal/*' alias instead of relative DAL imports",
            },
            {
              group: ["**/organization-context", "../organization-context"],
              message:
                "Import getRequestAuthContext from '~/server/auth/context' instead",
            },
          ],
        },
      ],

      // Use TypeScript ESLint's import sorting instead of eslint-plugin-import
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "separate-type-imports",
        },
      ],

      // Rules for promises
      "promise/catch-or-return": ["error", { allowFinally: true }],
      "promise/no-nesting": "warn",

      // Type-aware rules from shared config
      ...ESLINT_RULES.production,

      // Additional strict rules for better type safety (upgraded from warn to error)
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
          allowDirectConstAssertionInArrowFunctions: true,
          // Lane B enhancement: Require return types for all async functions
          allowConciseArrowFunctionExpressionsStartingWithVoid: false,
        },
      ],

      // Custom rules for legacy auth prevention
      "legacyAuth/no-legacy-auth-imports": "error",

      // Lane B: Enhanced ESLint enforcement rules
      "duplicateAuth/no-duplicate-auth-resolution": "error", // Critical safety
      "missingCache/no-missing-cache-wrapper": "warn", // Start as warning, escalate later
      "directSupabase/no-direct-supabase-client": "error", // SSR safety

      // Ban problematic TypeScript comment directives
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-expect-error": "allow-with-description",
          "ts-ignore": true,
          "ts-nocheck": true,
          "ts-check": false,
          minimumDescriptionLength: 10,
        },
      ],

      // Allow bracket notation for transformer utilities working with Record<string, unknown>
      "@typescript-eslint/dot-notation": [
        "error",
        {
          allowIndexSignaturePropertyAccess: true,
        },
      ],
    },
  },
  {
    // Guardrails for app code (exclude server code)
    // Target app code files but explicitly exclude directories where exported
    // types/interfaces are allowed (negated globs are used for exclusions).
    files: [
      "src/**/*.{ts,tsx}",
      "!src/lib/types/**",
      "!src/components/**",
      "!src/**/__tests__/**",
      "!e2e/**",
      "!src/server/db/**",
      "!supabase/**",
      "!RSC_MIGRATION/**",
      "!docs/**",
    ],
    rules: {
      // App code must not depend directly on DB schema/types or low-level server modules
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "~/server/db/schema",
              message:
                "Import DB model types via '~/lib/types' (Db.*) per CORE-TS-003. Do not import schema directly in app code.",
            },
            {
              name: "~/server/db/types",
              message:
                "Import DB model types via '~/lib/types' (Db.*) per CORE-TS-003. Do not import server DB types directly in app code.",
            },
            {
              name: "~/lib/dal/issues",
              importNames: ["IssueFilters"],
              message:
                "Import IssueFilters from '~/lib/types' (filters) per CORE-TS-002. DAL does not export this type.",
            },
            {
              name: "~/lib/dal/machines",
              importNames: ["MachineFilters"],
              message:
                "Import MachineFilters from '~/lib/types' (filters) per CORE-TS-002. DAL does not export this type.",
            },
            {
              name: "@supabase/supabase-js",
              importNames: ["createClient"],
              message:
                "Use '~/lib/supabase/server' createClient() wrapper for SSR per CORE-SSR-001.",
            },
          ],
          patterns: [
            {
              group: [
                "~/server/db/**",
                "../server/db/**",
                "../../server/db/**",
                "../../../server/db/**",
              ],
              message:
                "Do not import server DB modules in app code. Use '~/lib/types' for types and service boundaries per CORE-TS-003.",
            },
            {
              group: ["../../*", "../../../*", "../../../../*"],
              message:
                "Use the '~/' path alias instead of deep relative imports (../../).",
            },
          ],
        },
      ],
      // Type declaration location enforcement removed - was too restrictive
      // Component props, external API types, and module-specific interfaces
      // should remain co-located with their code. Only truly reusable business
      // domain types should be centralized via code review when duplication occurs.
    },
  },
  {
    // Allow type-only search param re-exports in the types barrel
    files: ["src/lib/types/search.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    // Allow server imports in lib/types for type definitions
    files: ["src/lib/types/**/*.ts"],
    rules: {
      "no-restricted-imports": "off",
      "no-restricted-syntax": "off",
    },
  },
  {
    // Allow server imports in DAL layer for data access abstraction
    files: ["src/lib/dal/**/*.ts"],
    rules: {
      "no-restricted-imports": "off",
      "no-restricted-syntax": "off",
    },
  },
  {
    // Allow server imports in server-side API routers
    files: ["src/server/api/**/*.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    // Allow server imports in server-side services
    files: ["src/server/services/**/*.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    // Allow server imports in server-side auth modules
    files: ["src/server/auth/**/*.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    // Allow server imports in test helpers
    files: ["src/test/**/*.ts"],
    rules: {
      "no-restricted-imports": "off",
      "no-restricted-syntax": "off",
    },
  },
  {
    // Allow server imports in server DB layer (already excluded by main rule but explicitly adding)
    files: ["src/server/db/**/*.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    // Allow server imports in lib services layer
    files: ["src/lib/services/**/*.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    // Allow server-only imports and type exports in organization context module (moved to end)
    files: ["src/lib/organization-context.ts"],
    rules: {
      "no-restricted-imports": "off",
      "no-restricted-syntax": "off",
    },
  },
  {
    // Allow server imports in Server Actions (server-side execution)
    files: ["src/lib/actions/**/*.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    // Strategic exemptions: API layer files - allow necessary tRPC patterns (limited scope)
    files: ["src/server/api/routers/**/*.ts"],
    rules: {
      // Only disable specific unsafe rules that are commonly needed for tRPC
      "@typescript-eslint/no-unsafe-assignment": "off", // tRPC input/output handling
      "@typescript-eslint/no-unsafe-member-access": "off", // tRPC context access
      "@typescript-eslint/no-unsafe-call": "off", // tRPC procedure calls
      // Keep other safety rules enabled
    },
  },
  {
    // Strategic exemptions: Database query files - allow necessary Drizzle patterns (limited scope)
    files: ["src/server/db/queries/**/*.ts", "src/server/db/schema/**/*.ts"],
    rules: {
      // Only disable specific unsafe rules that are commonly needed for Drizzle ORM
      "@typescript-eslint/no-unsafe-assignment": "off", // Drizzle query results
      "@typescript-eslint/no-unsafe-member-access": "off", // Drizzle column access
      "@typescript-eslint/no-unsafe-call": "off", // Drizzle query methods
      // Keep other safety rules enabled for better type safety
    },
  },
  {
    // Override: Allow process.env in the env file itself
    files: ["src/env.js"],
    rules: {
      "no-restricted-properties": "off",
    },
  },
  {
    // Override: Allow process.env in version utility (documented exception)
    // This is needed because npm_package_version is only available via npm environment
    // and is not a configuration variable that should go through T3 env validation
    files: ["src/utils/version.ts"],
    rules: {
      "no-restricted-properties": "off",
    },
  },
  {
    // Override: Config files - moderate standards for build/setup files
    files: convertPatterns.forESLint(INCLUDE_PATTERNS.config),
    rules: {
      // Use test utilities rules for config files (moderate standards)
      ...ESLINT_RULES.testUtils,
      // Allow process.env for config files
      "no-restricted-properties": "off",
      // Disable strictNullChecks-dependent rules (config files may not use strict settings)
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-unnecessary-boolean-literal-compare": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
    },
  },
  // Override: Test utilities - moderate standards
  // NOTE: Disabled - test infrastructure archived to .archived-tests-2025-08-23/
  // {
  //   files: convertPatterns.forESLint(INCLUDE_PATTERNS.testUtils),
  //   rules: {
  //     ...ESLINT_RULES.testUtils,
  //     "no-restricted-properties": "off",
  //     "@typescript-eslint/consistent-type-imports": "off",
  //   },
  // },
  {
    // Override: Test files - relaxed standards for pragmatic testing
    files: [
      ...convertPatterns.forESLint(INCLUDE_PATTERNS.tests),
      "src/test/**/*.ts",
    ],
    plugins: {
      vitest: vitestPlugin,
    },
    rules: {
      // Use shared rules configuration
      ...ESLINT_RULES.tests,
      // Allow process.env for test mocking
      "no-restricted-properties": "off",
      // Disable strictNullChecks-dependent rules (tests use relaxed TypeScript)
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-unnecessary-boolean-literal-compare": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      // Allow unbound methods in tests (Vitest expect calls are safe)
      "@typescript-eslint/unbound-method": "off",
      // Allow dynamic imports in tests (can't use import type)
      "@typescript-eslint/consistent-type-imports": "off",

      // Phase 0: Test quality rules (enabled for test files)
      "vitest/consistent-test-it": "error",
      "vitest/no-disabled-tests": "warn",
      "vitest/no-focused-tests": "error",
    },
  },
  {
    // Override: E2E test files - relaxed standards for pragmatic testing
    files: ["e2e/**/*.{ts,tsx}"],
    rules: {
      // Allow process.env for test mocking
      "no-restricted-properties": "off",
      // Disable strictNullChecks-dependent rules (E2E tests use relaxed TypeScript)
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-unnecessary-boolean-literal-compare": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      "@typescript-eslint/no-inferrable-types": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/await-thenable": "off",
      // Allow dynamic imports in E2E tests (can't use import type)
      "@typescript-eslint/consistent-type-imports": "off",
      // Allow Playwright test patterns
      "@typescript-eslint/no-confusing-void-expression": "off", // Common in Playwright expect() patterns
      "@typescript-eslint/no-floating-promises": "off", // Playwright handles promises internally
    },
  },
  {
    // Legacy override: Allow process.env in remaining test paths
    files: ["**/test/**"],
    rules: {
      "no-restricted-properties": "off",
    },
  },
  {
    // Override: Allow process.env in tRPC provider for base URL
    files: ["src/trpc/react.tsx"],
    rules: {
      "no-restricted-properties": "off",
    },
  },
  {
    // Disable type-aware linting for JavaScript files
    files: ["**/*.js", "**/*.cjs", "**/*.mjs"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // Configuration for scripts - more relaxed rules for build/utility scripts
    files: ["scripts/**/*.{ts,js,cjs,mjs}"],
    plugins: {
      "unused-imports": unusedImportsPlugin,
    },
    rules: {
      // Allow require() in scripts
      "@typescript-eslint/no-require-imports": "off",
      // Allow process.env in scripts (build/utility scripts need direct env access)
      "no-restricted-properties": "off",
      // Allow bracket notation for process.env in scripts (TypeScript strictest vs pragmatic access)
      "@typescript-eslint/dot-notation": "off",
      // Disable strict type checking rules for pragmatic scripts
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      // Keep unused imports checking but allow unused vars in scripts
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": "off", // Allow unused vars in scripts
      "@typescript-eslint/no-unused-vars": "off", // Allow unused vars in scripts
    },
  },
  {
    // Disable type-aware linting for scripts to avoid tsconfig issues
    files: ["scripts/**/*.{ts,js,cjs,mjs}"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // Override: Allow drizzle-orm patterns in schema files
    // Drizzle ORM requires patterns that conflict with @tsconfig/strictest
    files: ["src/server/db/schema/*.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
    },
  },
  {
    // Global ignores
    ignores: [
      ".next/",
      "node_modules/",
      "drizzle/",
      "coverage/**/*", // Test coverage files
      "test-results/**/*", // Playwright test results
      "src/_archived_frontend/**/*",
      ".claude/**/*",
      ".archived-tests-2025-08-23/**/*", // Archived test files
      "src/test/templates/**/*.ts", // Template files excluded from linting
      "src/test/templates/**/*.tsx", // Template files excluded from linting
      "src/test/archived-templates/**/*.ts", // Archived template files excluded from linting
      "add-location-seed.ts", // Temporary script file
      "next-env.d.ts", // Next.js generated file
      "eslint.config.js",
      "prettier.config.js",
      "next.config.js",
      "postcss.config.js",
      "tailwind.config.ts",
      "vitest.config.ts",
      "vitest.coverage-test.config.ts",
      "vite.config.ts",
      "jest.config.js",
      "playwright.config.ts",
      "tooling.config.js",
      "tooling.config.ts",
      "supabase/migrations/**/*", // Generated migration files
    ],
  },
);
