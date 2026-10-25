#!/usr/bin/env node
// PreToolUse (Bash) hook: backs up the `Bash(gh pr merge *--admin*)` deny rules.
// `gh pr merge` is allowed without a prompt once Tim says merge (AGENTS.md §2.2.6),
// and `--admin` would use the ruleset's admin bypass and skip every merge gate.
// A permission glob only sees the literal text, which quoting, variables, globs,
// case (macOS paths ignore it), aliases and line continuations all get around.
// So this hook is an allowlist over the whole input, not a shell parser:
//   - input that says `merge` and names gh, a shell or `eval`/`xargs`, or has a
//     character that may expand (`$`, a backtick, a glob, a brace, `~`) must be,
//     in full, exactly `gh pr merge <N>` with only --auto, --squash and
//     --delete-branch: no separators, wrappers, functions or other commands
//     around it. A search such as `rg 'gh pr merge'` is refused too; search for
//     `pr merge` instead, or run the search separately;
//   - input that says `admin` next to `gh` or `merge` is refused;
//   - input that names gh and defines an alias is refused.
// Every test runs after removing line continuations, quotes and backslashes.
// The residual is code that builds the flag inside another program, such as a
// script file run separately.
// Exit 2 blocks the call and shows stderr to Claude; anything else allows it.

const ALLOWED_MERGE = /^gh pr merge \d+(?: --(?:auto|squash|delete-branch))*$/;
const NAMES_GH = /\bgh\b/i;
const SHELL_WORD = /(?:^|[\s/;&|(){}])(?:(?:ba|z|da|k|c|tc|fi)?sh|eval|xargs|source|exec|\.)(?:[\s;&|(){}]|$)/i;
const MAY_EXPAND = /[$`*?[\]{}~]/;

/** Why the input is refused, or "" when it is fine. */
function refusal(command) {
  const joined = command.replace(/\\\r?\n/g, "");
  const plain = joined.replace(/["'\\]/g, "");
  if (/admin/i.test(plain) && /\bgh\b|\bmerge\b/i.test(plain)) return "it mentions admin alongside gh or merge";
  if (NAMES_GH.test(plain) && /\balias\b/i.test(plain) && /\b(?:set|import)\b/i.test(plain)) {
    return "it defines a gh alias";
  }
  if (!/\bmerge\b/i.test(plain)) return "";
  const mayRunGh = NAMES_GH.test(plain) || SHELL_WORD.test(plain) || MAY_EXPAND.test(joined);
  if (mayRunGh && !ALLOWED_MERGE.test(joined.trim())) {
    return "a merge command must be, on its own, exactly `gh pr merge <PR>` with only --auto, --squash and --delete-branch";
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
