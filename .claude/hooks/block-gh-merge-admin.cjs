#!/usr/bin/env node
// PreToolUse (Bash) hook: backs up the `Bash(gh pr merge *--admin*)` deny rules.
// `gh pr merge` is allowed without a prompt once Tim says merge (AGENTS.md §2.2.6),
// and `--admin` would use the ruleset's admin bypass and skip every merge gate.
// A permission glob only sees the literal text, so `--ad""min`, `--adm\in`,
// `$FLAG`, a `GH` spelling (macOS paths are case-insensitive), a `g?` glob or a
// gh alias slip past it. Deliberately broad rather than a shell parser: after
// removing line continuations, quotes and backslashes, it refuses any command
// that says `admin` next to `gh` or `merge`, any merge command that uses shell
// expansion (a real merge command is always literal), and any new gh alias.
// The residual is code that builds the flag in another process, such as a
// script file run separately.
// Exit 2 blocks the call and shows stderr to Claude; anything else allows it.

// `gh` … `merge` within one command; `gh pr merge` and `gh pr -R x merge` alike.
const GH_MERGE = /(?:^|[^\w-])gh\s[^;&|\n]*\bmerge\b/i;
const EXPANSION = /[$`]|\b(?:eval|xargs)\b/i;

/** Why the command is refused, or "" when it is fine. */
function refusal(command) {
  const plain = command.replace(/\\\r?\n/g, "").replace(/["'\\]/g, "");
  if (/admin/i.test(plain) && /\bgh\b|\bmerge\b/i.test(plain)) return "it mentions admin alongside gh or merge";
  if (/\bgh\s+alias\s+(?:set|import)\b/i.test(plain)) return "it defines a gh alias";
  if (GH_MERGE.test(plain) && EXPANSION.test(command)) return "it uses shell expansion ($, backticks, eval or xargs)";
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
