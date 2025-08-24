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

export default tseslint.config(
  // TypeScript ESLint base configurations
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    // Enable type-aware linting with multi-config support
    languageOptions: {
      parserOptions: {
        // Multiple tsconfig files for different contexts
        project: [
          "./tsconfig.json",
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
      promise: promisePlugin,
      "unused-imports": unusedImportsPlugin,
      // Phase 0: Modern security and quality plugins
      vitest: vitestPlugin,
      security: securityPlugin,
      "@microsoft/sdl": sdlPlugin,
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

      // Custom Drizzle safety (replaces abandoned plugin)
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
      ],

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
    files: convertPatterns.forESLint(INCLUDE_PATTERNS.tests),
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
    ],
  },
);
