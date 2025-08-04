// eslint.config.js

import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";
import importPlugin from "eslint-plugin-import";
import promisePlugin from "eslint-plugin-promise";
import unusedImportsPlugin from "eslint-plugin-unused-imports";
import {
  INCLUDE_PATTERNS,
  ESLINT_RULES,
  convertPatterns,
} from "./tooling.config.js";

export default tseslint.config(
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,
  // Add type-aware configs for strict type checking
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    // Enable type-aware linting with multi-config support
    languageOptions: {
      parserOptions: {
        // Multiple tsconfig files for different contexts
        project: [
          "./tsconfig.json",
          "./tsconfig.test-utils.json",
          "./tsconfig.tests.json",
          "./tsconfig.config.json",
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
      import: importPlugin,
      promise: promisePlugin,
      "unused-imports": unusedImportsPlugin,
    },
    rules: {
      // Existing Next.js rules
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,

      // Rule to enforce use of validated env object
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message:
            "Use the 'env' object from '~/env.js' instead of 'process.env'. It is validated and type-safe. See src/env.js for available variables and T3 Env documentation: https://env.t3.gg/docs/introduction",
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

      // Rule for import order
      "import/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
            "object",
            "type",
          ],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],

      // Prevent deep relative imports - encourage use of ~/path aliases
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../../*", "../../../*", "../../../../*"],
              message:
                "Use the '~/' path alias instead of deep relative imports (../../). This improves maintainability and prevents broken imports when files are moved.",
            },
          ],
        },
      ],

      // Rules for promises
      "promise/catch-or-return": ["error", { allowFinally: true }],
      "promise/no-nesting": "warn",

      // Type-aware rules from shared config
      ...ESLINT_RULES.production,

      // Additional strict rules for better type safety
      "@typescript-eslint/explicit-function-return-type": [
        "warn",
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
          allowDirectConstAssertionInArrowFunctions: true,
        },
      ],

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
  {
    // Override: Test utilities - moderate standards
    files: convertPatterns.forESLint(INCLUDE_PATTERNS.testUtils),
    rules: {
      // Use shared rules configuration
      ...ESLINT_RULES.testUtils,
      // Allow process.env for test utilities
      "no-restricted-properties": "off",
    },
  },
  {
    // Override: Test files - relaxed standards for pragmatic testing
    files: convertPatterns.forESLint(INCLUDE_PATTERNS.tests),
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
    // Override: Allow env import in prisma files (documented exception)
    // Prisma files need environment access for seeding and migrations
    // Should use validated env object from ~/env.js when possible
    files: ["prisma/**/*.ts"],
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
    files: ["scripts/**/*.ts"],
    plugins: {
      "unused-imports": unusedImportsPlugin,
    },
    rules: {
      // Allow require() in scripts
      "@typescript-eslint/no-require-imports": "off",
      // Allow process.env in scripts (build/utility scripts need direct env access)
      "no-restricted-properties": "off",
      // Keep unused imports checking but allow unused vars in catch blocks
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
          caughtErrors: "none", // Allow unused error variables in catch blocks
        },
      ],
    },
  },
  {
    // Disable type-aware linting for scripts to avoid tsconfig issues
    files: ["scripts/**/*.ts"],
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
      "src/_archived_frontend/**/*",
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
    ],
  },
);
