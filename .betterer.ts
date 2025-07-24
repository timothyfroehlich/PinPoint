import { eslint } from "@betterer/eslint";
import { typescript } from "@betterer/typescript";

export default {
  // Production code - strictest enforcement (blocks CI)
  "typescript strict (production)": () =>
    typescript("./tsconfig.json", {
      strict: true,
      exactOptionalPropertyTypes: true,
      noUncheckedIndexedAccess: true,
    })
      .include("./src/**/*.{ts,tsx}")
      .exclude(
        "./src/test/**/*",
        "./src/**/*.test.*",
        "./src/**/__tests__/**/*",
      ),

  // Test utilities - moderate tracking (warns but doesn't block)
  "typescript recommended (test-utils)": () =>
    typescript("./tsconfig.test-utils.json", {
      strict: true,
      strictNullChecks: true,
    })
      .include("./src/test/**/*.{ts,tsx}")
      .exclude("./src/**/*.test.*"),

  // Track any-usage in production code
  "no explicit any (production)": () =>
    eslint({ rules: { "@typescript-eslint/no-explicit-any": "error" } })
      .include("./src/**/*.{ts,tsx}")
      .exclude(
        "./src/test/**/*",
        "./src/**/*.test.*",
        "./src/**/__tests__/**/*",
      ),
};
