import { typescript } from "@betterer/typescript";

export default {
  // Track TypeScript strict mode errors - this is the most important metric
  "typescript strict mode": () =>
    typescript("./tsconfig.json", {
      strict: true,
      exactOptionalPropertyTypes: true,
      noUncheckedIndexedAccess: true,
      target: "ES2022", // Explicitly set target to match tsconfig.json
      lib: ["dom", "dom.iterable", "ES2022"], // Match tsconfig.json lib
    }).include("./src/**/*.{ts,tsx}"),
};
