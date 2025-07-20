#!/usr/bin/env node

/**
 * Claude Code PostToolUse Hook for File Validation
 *
 * Automatically runs validation checks after file writes and provides
 * JSON-formatted feedback to Claude Code with blocking capability.
 */

import { execSync } from "child_process";
import { existsSync } from "fs";
import path from "path";

// Configuration
const TIMEOUT_MS = 10000; // 10 second timeout for validation commands
const MAX_ERRORS_TO_SHOW = 5; // Limit error output to keep response brief

/**
 * Execute command with timeout and capture output
 */
function runCommand(command, options = {}) {
  try {
    const output = execSync(command, {
      encoding: "utf8",
      timeout: TIMEOUT_MS,
      cwd: process.cwd(),
      ...options,
    });
    return { success: true, output: output.trim() };
  } catch (error) {
    return {
      success: false,
      output: error.stdout || error.message || "Command failed",
      stderr: error.stderr || "",
    };
  }
}

/**
 * Parse ESLint output to extract key issues
 */
function parseESLintOutput(output) {
  if (!output) return [];

  const lines = output.split("\n");
  const issues = [];

  for (const line of lines) {
    // Match ESLint format: filepath:line:col: error/warning message (rule)
    const match = line.match(
      /^(.+?):(\d+):(\d+):\s+(error|warning)\s+(.+?)\s+(.+)$/,
    );
    if (match) {
      const [, file, lineNum, , severity, message, rule] = match;
      issues.push({
        file: path.relative(process.cwd(), file),
        line: lineNum,
        severity,
        message: message.trim(),
        rule: rule.trim(),
      });
    }
  }

  return issues.slice(0, MAX_ERRORS_TO_SHOW); // Limit output
}

/**
 * Parse TypeScript compiler output
 */
function parseTypeScriptOutput(output) {
  if (!output) return [];

  const lines = output.split("\n");
  const issues = [];

  for (const line of lines) {
    // Match TS format: filepath(line,col): error TS#### message
    const match = line.match(
      /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/,
    );
    if (match) {
      const [, file, lineNum, , code, message] = match;
      issues.push({
        file: path.relative(process.cwd(), file),
        line: lineNum,
        code,
        message: message.trim(),
      });
    }
  }

  return issues.slice(0, MAX_ERRORS_TO_SHOW); // Limit output
}

/**
 * Check if file should be validated (TypeScript/JavaScript files)
 */
function shouldValidateFile(filePath) {
  const ext = path.extname(filePath);
  return (
    [".ts", ".tsx", ".js", ".jsx"].includes(ext) &&
    !filePath.includes("node_modules") &&
    !filePath.includes(".next") &&
    !filePath.includes("dist")
  );
}

/**
 * Main validation function
 */
function validateFile(filePath) {
  // Only validate TypeScript/JavaScript files
  if (!shouldValidateFile(filePath)) {
    return {
      decision: "approve",
      reason: "File type doesn't require validation",
    };
  }

  // Check if file exists
  if (!existsSync(filePath)) {
    return {
      decision: "approve",
      reason: "File was deleted or moved",
    };
  }

  const issues = [];
  let hasErrors = false;

  // 1. Run Prettier format check/fix
  const prettierResult = runCommand(`npx prettier --write "${filePath}"`);
  if (!prettierResult.success) {
    issues.push({
      tool: "prettier",
      message: "Formatting failed",
      details: prettierResult.output,
    });
  }

  // 2. Run ESLint on the specific file
  const eslintResult = runCommand(`npx eslint "${filePath}" --format=stylish`, {
    stdio: "pipe",
  });
  if (!eslintResult.success && eslintResult.output) {
    const eslintIssues = parseESLintOutput(eslintResult.output);
    if (eslintIssues.length > 0) {
      // Check if any are errors (not just warnings)
      const errors = eslintIssues.filter((issue) => issue.severity === "error");
      if (errors.length > 0) {
        hasErrors = true;
        issues.push({
          tool: "eslint",
          message: `${errors.length} ESLint errors found`,
          details: errors,
        });
      } else {
        issues.push({
          tool: "eslint",
          message: `${eslintIssues.length} ESLint warnings found`,
          details: eslintIssues,
        });
      }
    }
  }

  // 3. Quick TypeScript check (only if it's a TS file)
  if ([".ts", ".tsx"].includes(path.extname(filePath))) {
    const tscResult = runCommand(
      `npx tsc --noEmit --skipLibCheck "${filePath}"`,
      { stdio: "pipe" },
    );
    if (!tscResult.success && tscResult.output) {
      const tsIssues = parseTypeScriptOutput(tscResult.output);
      if (tsIssues.length > 0) {
        hasErrors = true;
        issues.push({
          tool: "typescript",
          message: `${tsIssues.length} TypeScript errors found`,
          details: tsIssues,
        });
      }
    }
  }

  // Determine response
  if (hasErrors) {
    return {
      decision: "block",
      reason: `Validation failed with ${issues.filter((i) => i.tool !== "prettier").length} issue(s)`,
      issues: issues,
    };
  } else if (issues.length > 0) {
    return {
      decision: "approve",
      reason: `File validated with ${issues.length} warning(s)`,
      issues: issues,
    };
  } else {
    return {
      decision: "approve",
      reason: "File validated successfully",
    };
  }
}

/**
 * Main entry point
 */
function main() {
  // Claude Code passes the file path as the first argument
  const filePath = process.argv[2];

  if (!filePath) {
    console.log(
      JSON.stringify({
        decision: "approve",
        reason: "No file path provided",
      }),
    );
    return;
  }

  const result = validateFile(filePath);
  console.log(JSON.stringify(result, null, 2));
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
