import { eslint } from "@betterer/eslint";
import { typescript } from "@betterer/typescript";
import {
  INCLUDE_PATTERNS,
  EXCLUDE_PATTERNS,
  TYPESCRIPT_CONFIGS,
  convertPatterns,
} from "./tooling.config";

export default {
  // Production code - strictest enforcement (blocks CI)
  "typescript strict (production)": () =>
    typescript("./tsconfig.json", TYPESCRIPT_CONFIGS.production)
      .include(...convertPatterns.forBetterer(INCLUDE_PATTERNS.production))
      .exclude(...EXCLUDE_PATTERNS.production),

  // Test utilities - moderate tracking (warns but doesn't block)
  "typescript recommended (test-utils)": () =>
    typescript(
      "./tsconfig.test-utils.json",
      TYPESCRIPT_CONFIGS.testUtils,
    ).include(...convertPatterns.forBetterer(INCLUDE_PATTERNS.testUtils)),

  // Track any-usage in production code
  "no explicit any (production)": () =>
    eslint({ rules: { "@typescript-eslint/no-explicit-any": "error" } })
      .include(...convertPatterns.forBetterer(INCLUDE_PATTERNS.production))
      .exclude(...EXCLUDE_PATTERNS.production),
};
