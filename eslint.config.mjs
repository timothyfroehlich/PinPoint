import js from "@eslint/js";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import unusedImportsPlugin from "eslint-plugin-unused-imports";
import promisePlugin from "eslint-plugin-promise";
import eslintCommentsPlugin from "@eslint-community/eslint-plugin-eslint-comments";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import { pinpointTransactionPlugin } from "./eslint-rules/no-side-effects-in-transaction.mjs";

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
      pinpoint: pinpointTransactionPlugin,
    },
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        // Project service (typescript-eslint v8 recommended) instead of the
        // hand-maintained `project:` mappings this config used to carry (app /
        // tests / e2e blocks each pointing at their tsconfig). The service
        // resolves each linted file to its owning tsconfig the same way
        // tsserver does — root tsconfig.json (solution-style, PP-4k76) →
        // tsconfig.app.json / tsconfig.tests.json via references, and
        // e2e/tsconfig.json as the nearest config for e2e files. Classic
        // `project:` mode resolved cross-project imports through never-emitted
        // composite declarations, which made `eslint --fix`'s re-parse see
        // imported app types as error/any in test files and fail lint-staged
        // pre-commit with false positives (PP-v2ne).
        projectService: true,
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

      // ===== CORE-ARCH-011: no external side effects in db.transaction =====
      // Static backstop to the runtime tripwire (transaction-context.ts).
      // Implemented as a custom rule (not no-restricted-syntax) so it keeps its
      // own "error" severity slot — the e2e block owns no-restricted-syntax at
      // "warn" for an unrelated nudge, and flat config replaces (not merges)
      // rule options. Logic + rationale live in
      // ./eslint-rules/no-side-effects-in-transaction.mjs (single source of
      // truth, also exercised by src/test/eslint/*.test.ts).
      "pinpoint/no-side-effects-in-transaction": "error",

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
    // Test files (owned by tsconfig.tests.json; the project service in the
    // main block resolves that automatically — no per-block parserOptions).
    files: [
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "src/test/**/*",
    ],
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
    // E2E files use their own tsconfig (NodeNext resolution, separate from
    // tsconfig.tests.json's bundler resolution) — see e2e/tsconfig.json,
    // which the project service picks up as the nearest config for e2e
    // files. Same rule relaxations as the test-files block above
    // (mocking/test-data patterns are common to both).
    files: ["e2e/**/*"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "unused-imports/no-unused-vars": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/unbound-method": "off",
      "eslint-comments/no-restricted-disable": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "no-restricted-imports": "off",
    },
  },
  {
    // E2E-only anti-patterns.
    //
    // NOTE: this block redefines `no-restricted-syntax` (at "warn") for the
    // @test.com nudge. In flat config that REPLACES (does not merge) the rule's
    // options, so it must NOT also carry the CORE-ARCH-011 side-effect
    // selectors — they'd be dropped, or be dragged up to "error" and break the
    // documented `getTestEmail("…@test.com")` false positive. The CORE-ARCH-011
    // backstop instead lives in a separate custom rule
    // (`pinpoint/no-side-effects-in-transaction`, "error") in the main
    // `**/*.ts(x)` block above, which also matches `e2e/**/*.ts(x)` — so e2e
    // files are covered at "error" with no hole, while this block keeps its own
    // independent "warn" severity. (PP-2053.13.)
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
    // ===== React Hooks correctness (PP-k6jp) =====
    // eslint-config-next was installed but never loaded, so react-hooks rules
    // ran nowhere. Wire the plugin directly (not via the legacy next config) and
    // own the two core rules' severity ourselves. Scoped to app source under
    // src/ (both .ts custom hooks and .tsx client components); tests/e2e are
    // excluded — hook-render helpers there produce noise with no user impact.
    // rules-of-hooks catches conditional/looped hook calls (real bugs).
    // exhaustive-deps is a hard gate (error); pre-existing violations are
    // grandfathered inline with a `-- PP-k6jp` disable rather than risky
    // dependency-array edits, so this PR only ENABLES the rule cleanly.
    files: ["src/**/*.ts", "src/**/*.tsx"],
    ignores: [
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "src/test/**",
    ],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
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
