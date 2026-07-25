#!/usr/bin/env node
// .claude/hooks/block-direct-merge.cjs
// PreToolUse hook: blocks agent-initiated PR merges (PP-wi85).
//
// Blocks four shapes:
//   1. `gh pr merge` (direct CLI merge)
//   2. `gh api .../pulls/N/merge` with a write method (REST merge)
//   3. `scripts/workflow/merge-pr.sh` (the gate-enforced merge script itself —
//      gate-enforcement is not a substitute for human sign-off)
//   4. mcp__github__merge_pull_request (MCP merge)
//
// ONE exception (PP-c0uy — the Dependabot carve-out): a command that is EXACTLY
//   [bash|sh] [path/]merge-pr.sh <number> --dependabot [--dry-run]
// and nothing else is allowed through. It is an anchored allowlist over the whole
// raw command — no chaining, no pipes, no redirects, no comments, no quoting, no
// env prefixes, no other flags. Shapes 1, 2 and 4 stay blocked unconditionally, as
// does every other `merge-pr.sh` shape.
//
// HONEST STATEMENT OF WHAT THIS HOOK NOW GUARANTEES:
// This hook sees only the command string. It CANNOT verify that the PR number in
// that string is actually Dependabot-authored, that every commit on it is
// bot-authored, or that the diff stays inside the dependency-bump path allowlist.
// It is, for this one path, a coarse *shape* filter — nothing more. The
// authoritative check is inside merge-pr.sh itself, which re-derives all three
// preconditions from the GitHub API and hard-REFUSEs on any failure. Before
// PP-c0uy this hook was a complete boundary ("no agent merge, period"); it is not
// that anymore, and no amount of regex here can restore it. Treat merge-pr.sh's
// preconditions as the security boundary and this hook as defense-in-depth.
//
// The human channel is unchanged: a `!`-prefixed command in Claude Code does not
// generate a PreToolUse event and so is never seen by this hook.

let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => {
  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    // Malformed payload — fail open to avoid breaking other hooks.
    process.exit(0);
  }

  const tool = payload.tool_name || "";
  const toolInput = payload.tool_input || {};

  let isMergeAttempt = false;
  let isMergeScriptAttempt = false;
  let detail = "";

  if (tool === "Bash") {
    const cmd = String(toolInput.command || "");
    // Strip quoted content so mentions in `echo`/`rg`/docs/heredocs don't false-positive.
    const stripped = cmd
      .replace(/'[^']*'/g, "''")
      .replace(/"(?:\\.|[^"\\])*"/g, '""');
    const cmdStart = /(?:^|;|&&|\|\||\||&|\n|\$\(|<\(|\(|`)\s*/;

    // Prefix gate: skip gh-related regex work when nothing gh-related is present, and
    // pass any --help invocation symmetrically (`gh pr merge --help`, `gh api --help`).
    if (cmd.includes("gh") && !/--help\b/.test(cmd)) {
      const ghMerge = new RegExp(cmdStart.source + "gh\\s+pr\\s+merge\\b");
      if (ghMerge.test(stripped)) {
        isMergeAttempt = true;
        detail = "gh pr merge";
      }
      // gh api ... /pulls/N/merge — AND three patterns so flag order doesn't matter.
      // mergePath is the cheapest discriminator — test first to short-circuit.
      const mergePath = /\/pulls\/\d+\/merge\b/;
      const writeMethod = /(?:-X|--method)[\s=]+(?:PUT|POST)\b/;
      const ghApiStart = new RegExp(cmdStart.source + "gh\\s+api\\b");
      if (mergePath.test(stripped) && writeMethod.test(stripped) && ghApiStart.test(stripped)) {
        isMergeAttempt = true;
        detail = "gh api PUT .../merge";
      }
    }

    // scripts/workflow/merge-pr.sh — TRIGGER on any mention in the quote-stripped
    // command, then allow through only the one exact carve-out shape below.
    //
    // The trigger deliberately does NOT try to recognize a command-start position.
    // It used to, and that was an open-ended blacklist of invocation wrappers: it
    // grew `env`, then bare `VAR=val`, then `do|then|else`, and STILL let a full
    // `--human` merge through under `eval`, `exec`, `command`, `time`, `nohup`,
    // `xargs`, `{ …; }`, and `case … in … esac`. Enumerating shell wrappers never
    // converges. Since the carve-out is now an anchored whole-command allowlist,
    // the trigger doesn't need to locate a command start at all — it only needs to
    // notice that merge-pr.sh is named at all, and let the allowlist adjudicate.
    // That kills the entire wrapper class at once, including wrappers nobody has
    // thought of yet.
    //
    // Keeping the trigger on `stripped` preserves the quoted-mention exemptions:
    // `echo "…merge-pr.sh…"` and `rg "merge-pr.sh" docs/` are unaffected. The cost
    // is that an *unquoted* mention (`rg merge-pr.sh docs/`, `shellcheck
    // scripts/workflow/merge-pr.sh`) now gets refused — quote the path and it works.
    // That is the correct direction to be wrong in.
    if (/merge-pr\.sh/.test(stripped)) {
      // Dependabot carve-out (PP-c0uy). This is an ALLOWLIST, not a blacklist:
      // the ENTIRE raw command must be exactly one merge-pr.sh invocation with
      // exactly the permitted arguments, anchored ^...$. Anything else at all —
      // a second command, a pipe, a redirect, a `#` comment, an `env`/VAR= prefix,
      // a quote anywhere, any extra flag — falls through and stays blocked.
      //
      // WHY AN ALLOWLIST, AND WHY AGAINST `cmd` RATHER THAN `stripped`:
      // The first cut of this scanned `stripped` for widening flags and blocked
      // if it found one. That was fail-OPEN, because quote-stripping hides a flag
      // from the scanner while the shell still passes it through. All of these
      // were allowed, and all of them actually execute a full `--human` merge of
      // an arbitrary PR:
      //   merge-pr.sh 123 "--human" # --dependabot
      //   merge-pr.sh 123 --hum""an # --dependabot
      //   merge-pr.sh 123 --dependabot; eval "merge-pr.sh 456 --human"
      // Matching a blacklist against a *mangled* copy of the string the shell
      // will run is unsound in principle — every quoting trick is a bypass. An
      // anchored allowlist against the raw string has the opposite failure mode:
      // an unanticipated shape is refused, which is merely inconvenient.
      //
      // Regex notes:
      //   [ \t] not \s   — \s matches newlines, which would let a second line ride
      //                    along inside the anchors. Horizontal space only.
      //   \/?[A-Za-z0-9_.] — the path may start with `/` or `./` but NOT `-`, so
      //                    `sh -c/merge-pr.sh …` can't pass `-c` off as a path.
      //   \d             — ASCII 0-9 (no /u flag), so no Unicode-digit surprises.
      //   $              — end-of-input in JS without /m; a trailing newline does
      //                    not satisfy it.
      const DEPENDABOT_CARVE_OUT =
        /^[ \t]*(?:(?:bash|sh)[ \t]+)?(?:\/?[A-Za-z0-9_.][A-Za-z0-9_.\-/]*\/)?merge-pr\.sh[ \t]+\d+[ \t]+--dependabot(?:[ \t]+--dry-run)?[ \t]*$/;

      if (!DEPENDABOT_CARVE_OUT.test(cmd)) {
        isMergeScriptAttempt = true;
        detail = "scripts/workflow/merge-pr.sh";
      }
    }
  } else if (tool === "mcp__github__merge_pull_request") {
    isMergeAttempt = true;
    detail = "MCP merge_pull_request";
  }

  if (isMergeScriptAttempt) {
    console.error(
      "Merge is human-only. You cannot run merge-pr.sh. Finish the PR (CI green, reviews " +
        "resolved, screenshots posted if UI), then hand Tim the exact command to run himself: " +
        "! scripts/workflow/merge-pr.sh <PR> --human\n" +
        "(The only agent-usable shape is exactly `merge-pr.sh <PR> --dependabot [--dry-run]` " +
        "on a Dependabot dependency-bump PR — as the WHOLE command. No chaining, pipes, " +
        "redirects, comments, quoting, env prefixes, or other flags.)"
    );
    process.exit(2);
  }

  if (!isMergeAttempt) {
    process.exit(0);
  }

  // Block. No bypass sentinel — `gh pr merge`, `gh api ... /merge` and the MCP merge
  // have no agent-usable escape hatch (PP-wi85); the Dependabot carve-out (PP-c0uy)
  // applies only to merge-pr.sh, which enforces its own preconditions. If merge-pr.sh
  // itself is broken and a hotfix must ship, that is a human decision made in a
  // human-run shell, not a hook bypass.
  console.error(
    `Direct merge blocked: ${detail}. Merging is human-only — hand Tim the exact command to ` +
      "run himself: ! scripts/workflow/merge-pr.sh <PR> --human"
  );
  process.exit(2);
});
