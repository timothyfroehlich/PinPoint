import js from "@eslint/js";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import unusedImportsPlugin from "eslint-plugin-unused-imports";
import promisePlugin from "eslint-plugin-promise";

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
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "@typescript-eslint": typescriptEslint,
      "unused-imports": unusedImportsPlugin,
      promise: promisePlugin,
    },
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        process: "readonly",
        // Browser globals for client components
        document: "readonly",
        window: "readonly",
        navigator: "readonly",
        console: "readonly",
      },
    },
    rules: {
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
      globals: {
        // E2E tests run in Playwright (Node + browser APIs)
        fetch: "readonly",
        setTimeout: "readonly",
        process: "readonly",
        console: "readonly",
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
    },
  },
];
