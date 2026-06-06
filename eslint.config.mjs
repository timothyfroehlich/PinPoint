import js from "@eslint/js";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import unusedImportsPlugin from "eslint-plugin-unused-imports";
import promisePlugin from "eslint-plugin-promise";
import eslintCommentsPlugin from "@eslint-community/eslint-plugin-eslint-comments";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "dist/**",
      ".archived_v1/**",
      "*.config.js",
      "*.config.mjs",
      "*.config.ts",
      "*.config.cjs",
      "src/app/(app)/mockup/**",
      "src/components/mockups/**",
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "@typescript-eslint": typescriptEslint,
      "unused-imports": unusedImportsPlugin,
      promise: promisePlugin,
      "eslint-comments": eslintCommentsPlugin,
    },
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "no-undef": "off",
      "no-empty-pattern": ["error", { "allowObjectPatternsAsParameters": true }],

      // TypeScript recommended rules
      ...typescriptEslint.configs["recommended-type-checked"].rules,
      ...typescriptEslint.configs["stylistic-type-checked"].rules,

      // ===== Code Quality =====

      // Unused imports - catches dead code
      "@typescript-eslint/no-unused-vars": "off", // Disabled in favor of unused-imports
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

      // Explicit return types - prevents inference errors
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
          allowDirectConstAssertionInArrowFunctions: true,
        },
      ],

      // ===== Import Organization =====

      // Type imports - cleaner imports
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
        },
      ],

      // Prevent deep relative imports - use path aliases
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../../*", "../../../*", "../../../../*"],
              message:
                "Use '~/' path alias instead of deep relative imports (../../). This improves maintainability and prevents broken imports when files are moved.",
            },
          ],
        },
      ],

      // ===== TypeScript Safety =====

      // Strict any prevention
      "@typescript-eslint/no-explicit-any": "error",

      // Unnecessary condition checks (catches bugs)
      "@typescript-eslint/no-unnecessary-condition": "error",

      // Promise handling - prevents fire-and-forget bugs
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: {
            attributes: false, // Allow async event handlers in JSX
          },
        },
      ],
      "@typescript-eslint/no-floating-promises": "error",

      // Ban problematic TypeScript comments
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

      // ===== Promise Best Practices =====

      "promise/catch-or-return": ["error", { allowFinally: true }],
      "promise/no-nesting": "warn",
      "promise/no-promise-in-callback": "warn",
      "promise/no-callback-in-promise": "warn",
      "promise/no-return-wrap": "error",

      // ===== ESLint Comments =====

      // Prevent disabling strict type checks
      "eslint-comments/no-restricted-disable": [
        "error",
        "@typescript-eslint/no-explicit-any",
        "@typescript-eslint/no-unsafe-*",
      ],

      // Require description for all disable comments
      "eslint-comments/require-description": ["error", { ignore: [] }],

      // Remove stale disable comments
      "eslint-comments/no-unused-disable": "error",
    },
  },
  {
    // Test files use different tsconfig
    files: [
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "src/test/**/*",
      "e2e/**/*",
    ],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project: "./tsconfig.tests.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Allow any in tests for mocking
      "@typescript-eslint/no-explicit-any": "off",
      // Allow floating promises in tests (Vitest handles them)
      "@typescript-eslint/no-floating-promises": "off",
      // No explicit return types needed in tests
      "@typescript-eslint/explicit-function-return-type": "off",
      // Allow unused vars in tests (setup functions)
      "unused-imports/no-unused-vars": "off",

      // Disable strict type checks in tests (mocking often violates these)
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/unbound-method": "off",

      // Allow disabling rules in tests if needed (mocking often requires it)
      "eslint-comments/no-restricted-disable": "off",

      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "no-restricted-imports": "off",
    },
  },
  {
    // E2E-only anti-patterns
    files: ["e2e/**/*"],
    rules: {
      "no-restricted-properties": [
        "warn",
        {
          object: "page",
          property: "waitForTimeout",
          message:
            "Use Playwright assertions (auto-wait) instead of waitForTimeout",
        },
      ],
      "no-restricted-syntax": [
        "warn",
        {
          selector: "Literal[value=/.*@test\\.com/]",
          message:
            "Use TEST_USERS constants instead of hardcoded @test.com emails (getTestEmail() args are a known false positive)",
        },
        {
          selector: "TemplateElement[value.raw=/.*@test\\.com/]",
          message:
            "Use TEST_USERS constants instead of hardcoded @test.com emails",
        },
      ],
    },
  },
  {
    // Relaxed rules for config files
    files: [
      "*.config.ts",
      "*.config.js",
      "*.config.mjs",
      "*.config.cjs",
      "scripts/**/*",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "no-restricted-imports": "off",
      "eslint-comments/no-restricted-disable": "off",
    },
  },
  {
    // Seed scripts environment globals
    files: ["supabase/**/*.mjs"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // Enforce semantic Tailwind tokens, blocking raw palette classes and hardcoded hex values.
    // Design-layer files and tests are allowed.
    files: ["**/*.ts", "**/*.tsx"],
    ignores: [
      "src/lib/issues/status.ts",
      "src/lib/machines/status.ts",
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "e2e/**",
      "src/test/fixtures/**",
    ],
    plugins: {
      "better-tailwindcss": betterTailwindcss,
    },
    settings: {
      "better-tailwindcss": {
        entryPoint: "src/app/globals.css",
      },
    },
    rules: {
      "better-tailwindcss/no-restricted-classes": [
        "error",
        {
          restrict: [
            {
              pattern: "^(?:[^:]+:)*(?:bg|text|border|ring|fill|stroke|outline|divide|placeholder|caret|accent|decoration|shadow|from|via|to)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-[0-9]+(?:\\/[0-9]{1,3})?$",
              message: "Raw Tailwind palette classes are forbidden. Please use semantic tokens instead (e.g. bg-primary, text-destructive). See pinpoint-ui §Color System and pinpoint-design-bible §1.",
            },
            {
              pattern: "^(?:[^:]+:)*[a-z0-9-]+-\\[(?:[^\\]]*?)#[0-9a-fA-F]{3,8}(?:[^\\]]*?)\\](?:\\/.*)?$",
              message: "Hardcoded arbitrary hex values are forbidden. Please use semantic tokens instead (e.g. text-muted-foreground, bg-primary). See pinpoint-ui §Color System and pinpoint-design-bible §1.",
            },
          ],
        },
      ],
    },
  },
];
