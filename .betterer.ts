import { typescript } from "@betterer/typescript";

export default {
  // Track TypeScript strict mode errors - this is the most important metric
  "typescript strict mode": () =>
    typescript("./tsconfig.json", {
      strict: true,
      exactOptionalPropertyTypes: true,
      noUncheckedIndexedAccess: true,
    }).include("./src/**/*.{ts,tsx}"),
};
