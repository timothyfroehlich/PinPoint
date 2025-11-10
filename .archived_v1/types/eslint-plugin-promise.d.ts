/**
 * Type declarations for eslint-plugin-promise
 *
 * This module provides promise-related ESLint rules but doesn't include TypeScript declarations.
 * Based on the plugin's exported structure from index.js
 */

declare module "eslint-plugin-promise" {
  import type { ESLint, Rule } from "eslint";

  interface PromisePlugin extends ESLint.Plugin {
    rules: Record<string, Rule.RuleModule>;
    rulesConfig: Record<string, number>;
    configs: {
      recommended: {
        plugins: string[];
        rules: Record<string, string>;
      };
      "flat/recommended": {
        name: string;
        plugins: { promise: PromisePlugin };
        rules: Record<string, string>;
      };
    };
  }

  const plugin: PromisePlugin;
  export = plugin;
}
