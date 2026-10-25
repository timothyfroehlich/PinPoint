#!/usr/bin/env node
// PreToolUse (Bash) hook: backs up the `Bash(gh pr merge *--admin*)` deny rules.
// `gh pr merge` is allowed without a prompt once Tim says merge (AGENTS.md §2.2.6),
// and `--admin` would use the ruleset's admin bypass and skip every merge gate.
// A permission glob only sees the literal text, which quoting, variables, globs,
// case (macOS paths ignore it), aliases and line continuations all get around.
// So this hook is an allowlist, not a shell parser:
//   - a command that says `merge` and runs gh, something that may expand to gh
//     (a glob, a variable, a brace, `~`), or a shell or `eval`/`xargs` must be
//     exactly `gh pr merge <N>` with only --auto, --squash and --delete-branch;
//   - a command that says `admin` next to `gh` or `merge` is refused, after
//     removing line continuations, quotes and backslashes;
//   - a gh-like command that defines an alias is refused.
// The residual is code that builds the flag inside another program, such as a
// script file run separately.
// Exit 2 blocks the call and shows stderr to Claude; anything else allows it.

const ALLOWED_MERGE = /^gh pr merge \d+(?: --(?:auto|squash|delete-branch))*$/;
// Words that only prefix the real command.
const WRAPPERS = new Set(["env", "command", "exec", "nohup", "time", "sudo", "builtin"]);
const SHELLS = /^(?:.*\/)?(?:ba|z|da|k|c|tc|fi)?sh$|^(?:eval|xargs|source|\.)$/i;
const MAY_EXPAND = /[$`*?[\]{}~]/;

/** The segment's command word, skipping wrappers and VAR=value assignments. */
function commandWord(segment) {
  const words = segment.trim().split(/\s+/);
  for (const word of words) {
    if (WRAPPERS.has(word) || /^\w+=/.test(word)) continue;
    return word;
  }
  return "";
}

function isGhLike(word) {
  const plain = word.replace(/["'\\]/g, "");
  return /^(?:.*\/)?gh$/i.test(plain) || MAY_EXPAND.test(word) || SHELLS.test(plain);
}

/** Why the command is refused, or "" when it is fine. */
function refusal(command) {
  const joined = command.replace(/\\\r?\n/g, "");
  const plain = joined.replace(/["'\\]/g, "");
  if (/admin/i.test(plain) && /\bgh\b|\bmerge\b/i.test(plain)) return "it mentions admin alongside gh or merge";
  for (const segment of joined.split(/[;&|()\n]+/)) {
    const word = commandWord(segment);
    if (!word || !isGhLike(word)) continue;
    if (/\balias\b/i.test(segment) && /\b(?:set|import)\b/i.test(segment)) return "it defines a gh alias";
    if (/\bmerge\b/i.test(segment) && !ALLOWED_MERGE.test(segment.trim())) {
      return "a merge command must be exactly `gh pr merge <PR>` with only --auto, --squash and --delete-branch";
    }
  }
  return "";
}

let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => {
  let payload = {};
  try {
    payload = JSON.parse(input) ?? {};
  } catch {
    // Malformed payload → allow.
  }
  const reason = payload.tool_name === "Bash" ? refusal(String(payload.tool_input?.command ?? "")) : "";
  if (!reason) return;
  console.error(
    `gh pr merge blocked: ${reason}. Agents never use --admin: the ruleset's admin bypass is Tim's own ` +
      `emergency hatch (AGENTS.md §2.2.6). Run the merge on its own as literal text, ` +
      "`gh pr merge <PR> --squash` or `gh pr merge <PR> --auto --squash`; if GitHub refuses, a gate is unmet."
  );
  process.exit(2);
});
