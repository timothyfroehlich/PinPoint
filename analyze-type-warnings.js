#!/usr/bin/env node

import { ESLint } from "eslint";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function analyzeTypeWarnings() {
  const eslint = new ESLint({
    cwd: __dirname,
  });

  const results = await eslint.lintFiles(["src/**/*.ts", "src/**/*.tsx"]);

  const typeWarnings = {};
  const subsystemMap = {
    auth: /\/(auth|middleware)\.ts/,
    issue: /\/issue[\w.]*\.ts/,
    services: /\/services\//,
    database: /\/(db|provider)\.ts/,
    test: /\/(test|__tests__|\.test\.)/,
    machine: /\/machine[\w.]*\.ts/,
    location: /\/location[\w.]*\.ts/,
    comment: /\/comment[\w.]*\.ts/,
    upload: /\/upload/,
    external: /\/(opdb|pinballmap)/,
  };

  for (const result of results) {
    const warnings = result.messages.filter(
      (msg) =>
        msg.severity === 1 &&
        (msg.ruleId?.includes("no-unsafe-") ||
          msg.ruleId?.includes("no-explicit-any") ||
          msg.ruleId?.includes("explicit-function-return-type")),
    );

    if (warnings.length > 0) {
      const relativePath = path.relative(__dirname, result.filePath);

      // Categorize by subsystem
      let subsystem = "other";
      for (const [key, pattern] of Object.entries(subsystemMap)) {
        if (pattern.test(relativePath)) {
          subsystem = key;
          break;
        }
      }

      if (!typeWarnings[subsystem]) {
        typeWarnings[subsystem] = [];
      }

      typeWarnings[subsystem].push({
        file: relativePath,
        count: warnings.length,
        warnings: warnings.map((w) => w.ruleId),
      });
    }
  }

  // Print summary
  console.log("Type Safety Warnings by Subsystem:\n");
  for (const [subsystem, files] of Object.entries(typeWarnings)) {
    const total = files.reduce((sum, f) => sum + f.count, 0);
    console.log(`${subsystem}: ${total} warnings in ${files.length} files`);
    files.slice(0, MAX_DISPLAYED_FILES).forEach((f) => {
      console.log(`  - ${f.file} (${f.count} warnings)`);
    });
    if (files.length > MAX_DISPLAYED_FILES) {
      console.log(`  ... and ${files.length - MAX_DISPLAYED_FILES} more files`);
    }
    console.log();
  }
}

analyzeTypeWarnings().catch(console.error);
