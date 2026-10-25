#!/usr/bin/env node
// PreToolUse (Bash) hook: backs up the `Bash(gh pr merge *--admin*)` deny rules.
// `gh pr merge` is allowed without a prompt once Tim says merge (AGENTS.md §2.2.6),
// and `--admin` would use the ruleset's admin bypass and skip every merge gate.
// A permission glob only sees the literal text, so `--ad""min`, `--adm\in` or
// `$FLAG` slip past it. This hook strips quotes and backslashes before
// looking, and refuses a merge whose text uses shell expansion: a real merge
// command is always literal. Deliberately a regex over the whole command, not a
// shell parser; the residual is code that builds the flag in another process.
// Exit 2 blocks the call and shows stderr to Claude; anything else allows it.

// `gh` … `merge` within one command; `gh pr merge` and `gh pr -R x merge` alike.
const GH_MERGE = /(?:^|[^\w-])gh\s[^;&|\n]*\bmerge\b/;
const EXPANSION = /[$`]|\b(?:eval|xargs)\b/;

/** Why the command is refused, or "" when it is fine. */
function refusal(command) {
  const plain = command.replace(/["'\\]/g, "");
  if (!GH_MERGE.test(plain)) return "";
  if (/admin/i.test(plain)) return "it passes --admin";
  if (EXPANSION.test(command)) return "it uses shell expansion ($, backticks, eval or xargs)";
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
