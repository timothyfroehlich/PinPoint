// eslint.config.js
// @ts-check - Enable TypeScript checking for this file

import tseslint from "typescript-eslint";
// @ts-expect-error - No TypeScript declarations available
import nextPlugin from "@next/eslint-plugin-next";
import importPlugin from "eslint-plugin-import";
// @ts-expect-error - No TypeScript declarations available
import promisePlugin from "eslint-plugin-promise";
import unusedImportsPlugin from "eslint-plugin-unused-imports";

export default tseslint.config(
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,
  {
    // Main configuration for all TS/TSX files
    files: ["src/**/*.{ts,tsx}"],
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

      // Rules for promises
      "promise/catch-or-return": ["error", { allowFinally: true }],
      "promise/no-nesting": "warn",
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
    // Override: Allow process.env in test files (documented exception)
    // Tests legitimately need to mock environment variables and check NODE_ENV
    files: ["**/__tests__/**", "**/*.test.ts", "**/*.test.tsx", "**/test/**"],
    rules: {
      "no-restricted-properties": "off",
    },
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
    ],
  },
);
