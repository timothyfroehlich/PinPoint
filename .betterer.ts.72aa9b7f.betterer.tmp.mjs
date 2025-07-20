// .betterer.ts
import { typescript } from "@betterer/typescript";
import { eslint } from "@betterer/eslint";
var betterer_default = {
  // Track TypeScript strict mode errors
  "typescript strict mode": () => typescript("./tsconfig.json", {
    strict: true,
    exactOptionalPropertyTypes: true,
    noUncheckedIndexedAccess: true
  }).include("./src/**/*.{ts,tsx}"),
  // Track ESLint issues using the existing config
  "eslint production violations": () => eslint().include("./src/**/*.{ts,tsx}").exclude("./src/**/*.test.{ts,tsx}").exclude("./src/**/__tests__/**"),
  // Track ESLint issues in test files separately  
  "eslint test violations": () => eslint().include("./src/**/*.test.{ts,tsx}").include("./src/**/__tests__/**")
};
export {
  betterer_default as default
};
