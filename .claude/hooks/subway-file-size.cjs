#!/usr/bin/env node
/**
 * .claude/hooks/subway-file-size.cjs
 *
 * PreToolUse hook for Claude Code (Read) and Antigravity (view_file).
 * Intercepts full file reads on files exceeding $SUBWAY_MIN_LINES (default: 350)
 * and redirects the agent to `scripts/subway read` (Gemini Flash), keeping
 * heavy payloads off the primary agent's playfield (context window).
 *
 * Targeted reads (offset/limit or StartLine/EndLine slices <= threshold) pass through.
 * Fails open if no GEMINI_API_KEY is configured or if subway script is absent.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

function hasGeminiKey(projectDir) {
  // 1. Environment variable
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    return true;
  }

  // 2. Dedicated config file (~/.config/pinpoint/gemini_api_key)
  const configPath = path.join(os.homedir(), ".config", "pinpoint", "gemini_api_key");
  try {
    if (fs.existsSync(configPath) && fs.readFileSync(configPath, "utf8").trim()) {
      return true;
    }
  } catch {
    /* ignore unreadable config file */
  }

  // 3. Global Claude settings (~/.claude/settings.json)
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

  // 4. Project-level .env.local
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
  const rawPath = toolInput.file_path || toolInput.path || toolInput.AbsolutePath;

  let minLines = parseInt(
    process.env.SUBWAY_MIN_LINES || process.env.SHUNT_MIN_LINES || "350",
    10
  );
  if (isNaN(minLines) || minLines < 1) {
    minLines = 350;
  }

  // Allow targeted reads:
  // - offset or limit is specified
  // - or StartLine/EndLine slice is smaller than minLines
  if (toolInput.offset != null || toolInput.limit != null) {
    process.exit(0);
  }
  if (toolInput.StartLine != null && toolInput.EndLine != null) {
    const range = Math.abs(toolInput.EndLine - toolInput.StartLine);
    if (range <= minLines) {
      process.exit(0);
    }
  }

  if (!rawPath) {
    process.exit(0);
  }

  // Resolve path relative to projectDir or cwd
  const resolvedPath = path.isAbsolute(rawPath)
    ? rawPath
    : path.resolve(projectDir, rawPath);

  if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
    process.exit(0);
  }

  // Fail-open: if no Gemini key is configured, allow normal read
  if (!hasGeminiKey(projectDir)) {
    process.exit(0);
  }

  // Fail-open: if scripts/subway or scripts/bulk-read is not present, allow normal read
  const hasSubway =
    fs.existsSync(path.join(projectDir, "scripts", "subway")) ||
    fs.existsSync(path.join(projectDir, "scripts", "bulk-read"));
  if (!hasSubway) {
    process.exit(0);
  }

  const lines = countLines(resolvedPath);
  if (lines <= minLines) {
    process.exit(0);
  }

  const relativePath = path.relative(projectDir, resolvedPath);
  const reason =
    `File is ${lines} lines (threshold: ${minLines}). ` +
    `Route this read through the Subway to save context tokens: ` +
    `scripts/subway read --question "<what you want to know>" --paths "${relativePath}". ` +
    `If you need exact content for editing, re-read with offset/limit (or StartLine/EndLine) for just the section you need.`;

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

main().catch(() => process.exit(0));
