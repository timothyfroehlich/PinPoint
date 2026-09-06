#!/usr/bin/env node
/**
 * .claude/hooks/subway-bash-read.cjs
 *
 * PreToolUse hook for Claude Code (Bash) and Antigravity (run_command).
 * Intercepts naked file reads (`cat`, `head`, `tail`, `less`, `more`) on files
 * exceeding $SUBWAY_MIN_LINES (default: 350) and redirects to `scripts/subway read`.
 *
 * Piped commands (`cat file | grep`) and redirections (`cat file > out`) pass through.
 * Uses `./lib/resolve-command.cjs` (PP-6t3c) for robust quote-aware command resolution.
 * Fails open if no GEMINI_API_KEY is configured or if subway script is absent.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { resolveCommand } = require("./lib/resolve-command.cjs");

function hasGeminiKey(projectDir) {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    return true;
  }

  const configPath = path.join(os.homedir(), ".config", "pinpoint", "gemini_api_key");
  try {
    if (fs.existsSync(configPath) && fs.readFileSync(configPath, "utf8").trim()) {
      return true;
    }
  } catch {
    /* ignore unreadable config file */
  }

  const claudeSettings = path.join(os.homedir(), ".claude", "settings.json");
  try {
    if (fs.existsSync(claudeSettings)) {
      const parsed = JSON.parse(fs.readFileSync(claudeSettings, "utf8"));
      if (parsed?.env?.GEMINI_API_KEY?.trim()) {
        return true;
      }
    }
  } catch {
    /* ignore unreadable settings file */
  }

  if (projectDir) {
    const envLocal = path.join(projectDir, ".env.local");
    try {
      if (fs.existsSync(envLocal)) {
        const content = fs.readFileSync(envLocal, "utf8");
        if (/^\s*GEMINI_API_KEY\s*=\s*['"]?[^'"\n]+/m.test(content)) {
          return true;
        }
      }
    } catch {
      /* ignore unreadable .env.local */
    }
  }

  return false;
}

function countLines(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    let count = 0;
    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] === 10) count++;
    }
    if (buffer.length > 0 && buffer[buffer.length - 1] !== 10) {
      count++;
    }
    return count;
  } catch {
    return 0;
  }
}

const READ_COMMANDS = new Set(["cat", "head", "tail", "less", "more"]);
// Flags that consume the next argument as their value
const FLAG_WITH_VALUE = new Set(["-n", "-c", "-s", "--lines", "--bytes"]);

async function main() {
  let inputData = "";
  for await (const chunk of process.stdin) {
    inputData += chunk;
  }

  if (!inputData.trim()) {
    process.exit(0);
  }

  let input;
  try {
    input = JSON.parse(inputData);
  } catch {
    process.exit(0);
  }

  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const toolInput = input.tool_input || input.toolCall?.args || {};
  const cmd = (toolInput.command || toolInput.CommandLine || "").trim();

  if (!cmd) {
    process.exit(0);
  }

  // Allow piped commands and redirections
  if (/[|>]/.test(cmd)) {
    process.exit(0);
  }

  // Fail-open: if no Gemini key is configured, allow normal execution
  if (!hasGeminiKey(projectDir)) {
    process.exit(0);
  }

  // Fail-open: if scripts/subway or scripts/bulk-read is not present, allow normal execution
  const hasSubway =
    fs.existsSync(path.join(projectDir, "scripts", "subway")) ||
    fs.existsSync(path.join(projectDir, "scripts", "bulk-read"));
  if (!hasSubway) {
    process.exit(0);
  }

  let minLines = parseInt(
    process.env.SUBWAY_MIN_LINES || process.env.SHUNT_MIN_LINES || "350",
    10
  );
  if (isNaN(minLines) || minLines < 1) {
    minLines = 350;
  }

  const { segments } = resolveCommand(cmd);

  for (const segment of segments) {
    if (!READ_COMMANDS.has(segment.command)) {
      continue;
    }

    const args = segment.args || [];
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (FLAG_WITH_VALUE.has(arg)) {
        i++; // skip flag value
        continue;
      }
      if (arg.startsWith("-")) {
        continue;
      }

      const resolvedPath = path.isAbsolute(arg)
        ? arg
        : path.resolve(projectDir, arg);

      if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
        const lines = countLines(resolvedPath);
        if (lines > minLines) {
          const relativePath = path.relative(projectDir, resolvedPath);
          const reason =
            `File is ${lines} lines (threshold: ${minLines}). ` +
            `Route this read through the Subway instead of ${segment.command}: ` +
            `scripts/subway read --question "<what you want to know>" --paths "${relativePath}".`;

          const output = {
            decision: "deny",
            reason,
            hookSpecificOutput: {
              hookEventName: "PreToolUse",
              permissionDecision: "deny",
              permissionDecisionReason: reason,
            },
          };

          process.stdout.write(JSON.stringify(output));
          process.exit(0);
        }
      }
    }
  }

  process.exit(0);
}

main().catch(() => process.exit(0));
