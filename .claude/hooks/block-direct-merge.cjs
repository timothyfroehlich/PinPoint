#!/usr/bin/env node
// .claude/hooks/block-direct-merge.cjs
// PreToolUse hook: governs agent-initiated merges into PinPoint. Explicit
// targets in other repositories follow that repository's own policy. Two
// outcomes, by channel — an ASK prompt for the gate-enforcing script, a hard
// DENY for the raw merge channels (PP-wi85 reversed for the script only, per
// Tim 2026-08-19).
//
// ASK (prompts Tim; exits 0 with a PreToolUse "ask" decision):
//   3. `scripts/workflow/merge-pr.sh` — the gate-enforced merge script. An agent
//      MAY invoke it; the hook turns the invocation into an approval prompt, so
//      the merge decision is still Tim's (he approves the prompt). A hook "ask"
//      prompts in EVERY permission mode, including bypassPermissions, so a
//      bypassPermissions subagent cannot merge silently. The script re-checks all
//      four merge gates (CI green, review marker pins head, threads resolved, no
//      conflict) at merge time, so approving the prompt is not approving an
//      un-gated merge.
//
// DENY (hard-blocks; exits 2 with a stderr message):
//   1. `gh pr merge` (direct CLI merge)
//   2. `gh api .../pulls/N/merge` with a write method (REST merge)
//   4. mcp__github__merge_pull_request (MCP merge)
//   For PinPoint targets, these three stay human-only-via-`!` because they
//   bypass merge-pr.sh's gate checks entirely — a raw merge runs no
//   CI/review/threads/conflict re-evaluation, so there is no safe agent path
//   through them. The only way an agent reaches a PinPoint merge is the
//   ask-gated script above.
//
// HOW IT MATCHES (PP-6t3c, PP-ar8a). This used to regex a quote-stripped copy of
// the command, which had the boundary wide open: `eval "gh pr merge 123"`,
// `sh -c "…merge-pr.sh…"`, `env gh pr merge`, `time gh pr merge` and
// `xargs -I{} gh pr merge {}` all ALLOWED on main, because the quote-stripping
// erased the payload and the wrapper list was hardcoded and short. It now
// resolves the effective command of every shell segment via
// lib/resolve-command.cjs and matches on that.
//
// POSTURE ON `unresolvable`: this is a hard boundary, so an unknowable command
// is treated as suspicious, not safe. When the resolver cannot statically know
// what runs (`eval "$CMD"`, `sh -c "$X"`, `$(pick) pr merge`), the raw command
// text is scanned for merge indicators and a hit BLOCKS. A resolvable command
// never reaches that scan, so prose — `echo "run merge-pr.sh"`, `rg` over docs,
// `bd comments add "… merge-pr.sh …"` — still passes.

const { resolveCommand } = require("./lib/resolve-command.cjs");

// Raw-text indicators, used ONLY on the unresolvable path. Deliberately looser
// than the resolved matchers — `$(pick) pr merge 1` and `eval "$CMD"` (with the
// merge text elsewhere in the command) have no `gh` token adjacent to the
// subcommand. Prose never reaches here: a resolvable command returns before the
// scan, and only a dynamic COMMAND SLOT, a dynamic `eval`/`sh -c` payload, or
// an unbalanced quote makes a command unresolvable.
const RAW_MERGE_INDICATORS = [
  { pattern: /\bpr\s+merge\b/, kind: "merge", detail: "gh pr merge" },
  {
    pattern: /\/pulls\/\d+\/merge\b/,
    kind: "merge",
    detail: "gh api PUT .../merge",
  },
  {
    pattern: /\bmerge-pr\.sh\b/,
    kind: "merge-script",
    detail: "scripts/workflow/merge-pr.sh",
  },
];

const HELP_FLAGS = new Set(["--help", "-h"]);
const WRITE_METHODS = new Set(["PUT", "POST"]);
const MERGE_API_PATH = /\/pulls\/\d+\/merge\b/;
const API_REPOSITORY_PATH =
  /(?:^|\/)repos\/([^/]+)\/([^/]+)\/pulls\/\d+\/merge\b/;
const PULL_URL = /^https?:\/\/[^/]+\/([^/]+)\/([^/]+)\/pull\/\d+(?:[/?#]|$)/;
const PINPOINT_REPOSITORY = "timothyfroehlich/pinpoint";

// gh flags that consume the NEXT token as their value. Skipping their values
// keeps a repo selector from splitting the subcommand chain: `gh pr --repo o/r
// merge 1` must read as `pr merge`, not `pr`, `o/r`, `merge`.
const GH_VALUE_FLAGS = new Set(["-R", "--repo", "--hostname"]);

/** gh's positional arguments — flag values removed, so the subcommand chain is
 *  contiguous. Flags with `=` carry their value inline and need no skipping. */
function ghPositionals(args) {
  const positionals = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("-")) {
      if (GH_VALUE_FLAGS.has(a)) i++;
      continue;
    }
    positionals.push(a);
  }
  return positionals;
}

/** Normalize a static [HOST/]OWNER/REPO selector. Dynamic or malformed values
 *  return null so the guard fails closed rather than guessing their target. */
function normalizeRepository(value) {
  const raw = String(value || "").trim();
  if (!raw || /[\s$`{}*?]/.test(raw)) return null;

  const pullUrl = PULL_URL.exec(raw);
  if (pullUrl) return `${pullUrl[1]}/${pullUrl[2]}`.toLowerCase();

  const parts = raw.replace(/\.git$/, "").split("/");
  if (parts.length !== 2 && parts.length !== 3) return null;
  const owner = parts.at(-2);
  const repository = parts.at(-1);
  if (
    !owner ||
    !repository ||
    !/^[A-Za-z0-9_.-]+$/.test(owner) ||
    !/^[A-Za-z0-9_.-]+$/.test(repository)
  ) {
    return null;
  }
  return `${owner}/${repository}`.toLowerCase();
}

/** Return an explicit repository target when gh received one. `explicit` with
 *  a null repository means the command tried to name a target dynamically or
 *  ambiguously, which remains protected. */
function ghRepositoryTarget(args, environment = {}) {
  let explicit = false;
  let ambiguous = false;
  const repositories = [];
  const record = (value) => {
    explicit = true;
    const repository = normalizeRepository(value);
    if (repository === null) ambiguous = true;
    else repositories.push(repository);
  };

  if (Object.hasOwn(environment, "GH_REPO")) {
    record(environment.GH_REPO);
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-R" || arg === "--repo") {
      record(args[i + 1] || null);
      i++;
      continue;
    }
    const equals = /^(?:-R|--repo)=(.*)$/.exec(arg);
    if (equals) {
      record(equals[1]);
      continue;
    }
    const attachedShort = /^-R(.+)$/.exec(arg);
    if (attachedShort) {
      record(attachedShort[1]);
    }
  }

  for (const arg of args) {
    if (PULL_URL.test(arg)) {
      record(arg);
    }
  }

  for (const arg of args) {
    const path = API_REPOSITORY_PATH.exec(arg);
    if (path) {
      record(`${path[1]}/${path[2]}`);
    }
  }

  if (!explicit) return { explicit: false, repository: null };
  const unique = new Set(repositories);
  return {
    explicit: true,
    repository: ambiguous || unique.size !== 1 ? null : repositories[0],
  };
}

function mcpRepositoryTarget(toolInput) {
  if (!toolInput || typeof toolInput !== "object" || Array.isArray(toolInput)) {
    return { explicit: false, repository: null };
  }
  const owner = toolInput.owner;
  const repository = toolInput.repo;
  if (owner === undefined && repository === undefined) {
    return { explicit: false, repository: null };
  }
  if (typeof owner !== "string" || typeof repository !== "string") {
    return { explicit: true, repository: null };
  }
  return {
    explicit: true,
    repository: normalizeRepository(`${owner}/${repository}`),
  };
}

function isProtectedTarget(target) {
  return (
    !target.explicit ||
    target.repository === null ||
    target.repository === PINPOINT_REPOSITORY
  );
}

/** Does `args` invoke `gh api` against a pulls/N/merge path with a write method? */
function isGhApiMerge(args) {
  if (!args.some((a) => MERGE_API_PATH.test(a))) return false;
  let hasWriteMethod = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-X" || a === "--method") {
      if (WRITE_METHODS.has(String(args[i + 1] || "").toUpperCase())) {
        hasWriteMethod = true;
      }
      continue;
    }
    const eq = /^(?:-X|--method)=(.+)$/.exec(a);
    if (eq && WRITE_METHODS.has(eq[1].toUpperCase())) hasWriteMethod = true;
  }
  if (!hasWriteMethod) return false;
  // `api` must be gh's subcommand, not a value of some flag.
  return ghPositionals(args).includes("api");
}

/** Does `args` invoke `gh pr merge`? Adjacency in the positional chain, so
 *  `gh -R o/r pr merge` matches while `gh pr list --search "pr merge"` — where
 *  the search string is ONE quoted token — does not. */
function isGhPrMerge(args) {
  const positionals = ghPositionals(args);
  return positionals.some(
    (a, i) => a === "pr" && positionals[i + 1] === "merge"
  );
}

/**
 * Pure classifier. Returns { block, kind, detail }.
 *   kind: "merge" | "merge-script" | null
 * Exported so verify-guard-stack.cjs can probe that this guard still BLOCKS a
 * known-bad command, not merely that it is still registered.
 */
function classifyMerge(toolName, toolInput) {
  if (toolName === "mcp__github__merge_pull_request") {
    if (!isProtectedTarget(mcpRepositoryTarget(toolInput))) {
      return { block: false, kind: null, detail: "" };
    }
    return { block: true, kind: "merge", detail: "MCP merge_pull_request" };
  }
  if (toolName !== "Bash") return { block: false, kind: null, detail: "" };

  const cmd =
    typeof toolInput === "string"
      ? toolInput
      : String((toolInput && toolInput.command) || "");
  const { segments, unresolvable } = resolveCommand(cmd);

  for (const segment of segments) {
    if (segment.name === "merge-pr.sh") {
      return {
        block: true,
        kind: "merge-script",
        detail: "scripts/workflow/merge-pr.sh",
      };
    }
    if (segment.name !== "gh") continue;
    // `gh pr merge --help` / `gh api --help` document rather than merge.
    if (segment.args.some((a) => HELP_FLAGS.has(a))) continue;
    if (isGhPrMerge(segment.args)) {
      if (
        !isProtectedTarget(
          ghRepositoryTarget(segment.args, segment.environment)
        )
      ) {
        continue;
      }
      return { block: true, kind: "merge", detail: "gh pr merge" };
    }
    if (isGhApiMerge(segment.args)) {
      if (
        !isProtectedTarget(
          ghRepositoryTarget(segment.args, segment.environment)
        )
      ) {
        continue;
      }
      return { block: true, kind: "merge", detail: "gh api PUT .../merge" };
    }
  }

  if (unresolvable.length > 0) {
    for (const { pattern, kind, detail } of RAW_MERGE_INDICATORS) {
      if (pattern.test(cmd)) {
        return { block: true, kind, detail: `${detail} (inside an unresolvable command)` };
      }
    }
  }

  return { block: false, kind: null, detail: "" };
}

module.exports = { classifyMerge };

// --- Hook entrypoint ----------------------------------------------------------
// Only run as a hook when invoked directly (not when require()'d by a test or by
// the guard-stack canary).
if (require.main === module) {
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

    const { block, kind, detail } = classifyMerge(
      payload.tool_name || "",
      payload.tool_input || {}
    );

    if (!block) {
      process.exit(0);
    }

    // merge-pr.sh: ask, don't deny. An agent may invoke the gate-enforced merge
    // script, but the invocation is turned into an approval prompt so Tim signs
    // off (PP-wi85 reversed for this channel only, per Tim 2026-08-19). A
    // PreToolUse "ask" decision prompts in every permission mode — including
    // bypassPermissions — so a bypassPermissions subagent cannot merge silently.
    // The script re-checks all four merge gates at merge time, so approving the
    // prompt is not approving an un-gated merge.
    if (kind === "merge-script") {
      const reason =
        "merge-pr.sh runs the gate-enforced merge (CI green, review marker pins " +
        "head, threads resolved, no conflict — all re-checked at merge time). " +
        `Approve to let Tim sign off on the merge. [matched: ${detail}]`;
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "ask",
            permissionDecisionReason: reason,
          },
        })
      );
      process.exit(0);
    }

    // gh pr merge / gh api PUT .../merge / MCP merge_pull_request stay hard-denied.
    // They bypass merge-pr.sh's gate re-evaluation, so there is no safe agent path
    // through them — merging via these channels is human-only, via a `!`-prefixed
    // command a human types (which never generates a PreToolUse event).
    console.error(
      `Direct merge blocked: ${detail}. This channel skips merge-pr.sh's gate checks, so it ` +
        "stays human-only. Either run the gate-enforced script yourself — " +
        "`bash scripts/workflow/merge-pr.sh <PR> --human` (Tim approves the prompt) — or hand Tim " +
        "the command to run himself: ! scripts/workflow/merge-pr.sh <PR> --human"
    );
    process.exit(2);
  });
}
