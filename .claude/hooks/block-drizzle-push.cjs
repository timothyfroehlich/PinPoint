#!/usr/bin/env node
// .claude/hooks/block-drizzle-push.cjs
// PreToolUse hook (matcher: Bash): hard-blocks `drizzle-kit push` in every
// invocation shape.
//
// CORE-ARCH-009: schema changes go through `db:generate` + `db:migrate`.
// `drizzle-kit push` diffs the live database against the schema and applies the
// delta directly, producing NO migration file. The next `db:generate` then
// writes a migration against a snapshot that no longer matches reality, and the
// `prevId` chain in `drizzle/meta` silently forks. Recovery means hand-repairing
// binary-ish snapshot files (see the pinpoint-migration-conflicts skill), which
// is exactly the state that folder is never supposed to enter.
//
// Coverage before this hook was partial and easy to route around:
//   - `pnpm run db:_push` is a package.json tripwire that just errors out.
//   - `.claude/settings.json` denies `Bash(supabase db push:*)` — a different
//     command entirely.
// Neither stops `drizzle-kit push`, `pnpm exec drizzle-kit push`,
// `npx drizzle-kit push`, or `pnpm dlx drizzle-kit push`.
//
// Fails OPEN on malformed payloads and non-Bash tools.

// --- Pure classifier (unit-testable) -----------------------------------------
// Does this shell command actually INVOKE `drizzle-kit push`?
//
// A naive substring match is wrong, and wrong in a way that bites immediately:
// the first real-world firing of this hook blocked a `bd comments add "...
// drizzle-kit push ..."` whose prose merely NAMED the command. A hook that
// fires on prose is noise, and a noisy hook gets bypassed.
//
// So this resolves the effective command of each shell segment — the same
// technique block-main-worktree-branch-switch.cjs uses — and only blocks when
// that resolved command really is drizzle-kit (directly or via a package
// runner) with `push` as its subcommand.
//
// Deliberately does NOT match the sanctioned subcommands: generate, migrate,
// check, export, studio.

// Wrappers that don't consume the command slot themselves.
const WRAPPERS = new Set(["sudo", "env", "command", "time", "nice"]);
// Package runners, and the runner subcommands that precede the real binary.
const RUNNERS = new Set(["pnpm", "npm", "npx", "yarn", "bunx", "bun", "pnpx"]);
const RUNNER_SUBCOMMANDS = new Set(["exec", "dlx", "run", "x"]);
const ENV_ASSIGN = /^[A-Za-z_][A-Za-z0-9_]*[+:]?=/;

// Is this token the drizzle-kit binary? Accepts a bare name, a .js/.cjs/.mjs
// suffix, and any path ending in it (./node_modules/.bin/drizzle-kit).
function isDrizzleKit(token) {
  const base = String(token || "")
    .replace(/^["']|["']$/g, "")
    .split("/")
    .pop();
  return /^drizzle-kit(\.[cm]?js)?$/.test(base || "");
}

function classifyCommand(command) {
  const cmd = String(command || "");

  // Strip heredoc bodies first — commit messages legitimately explain why push
  // is banned. Same technique as block-dangerous-commands.cjs.
  const stripped = cmd.replace(/<<-?'?(\w+)'?[\s\S]*?\n\1/g, "");

  for (const rawSegment of stripped.split(/&&|\|\||;|\|/)) {
    const tokens = rawSegment.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;

    // Resolve the effective command: skip leading env assignments and wrappers.
    let i = 0;
    while (i < tokens.length) {
      const t = tokens[i];
      if (ENV_ASSIGN.test(t) || WRAPPERS.has(t)) {
        i++;
        continue;
      }
      break;
    }
    if (i >= tokens.length) continue;

    // Then step through a package runner and its subcommand, if present.
    if (RUNNERS.has(tokens[i])) {
      i++;
      while (i < tokens.length && RUNNER_SUBCOMMANDS.has(tokens[i])) i++;
    }
    if (i >= tokens.length) continue;

    // The resolved command must BE drizzle-kit. `echo "drizzle-kit push"`
    // resolves to `echo`; `bd comments add "... drizzle-kit push ..."` to `bd`.
    if (!isDrizzleKit(tokens[i])) continue;

    // Find the subcommand: the first non-flag token after the binary.
    for (let j = i + 1; j < tokens.length; j++) {
      const t = tokens[j];
      if (t.startsWith("-")) continue; // --config=x.ts, --force, ...
      // `push` or a legacy dialect-suffixed form like `push:pg`.
      if (/^push(:|$)/.test(t.replace(/^["']|["']$/g, ""))) {
        return { block: true, detail: "drizzle-kit push" };
      }
      break; // A different subcommand (generate/migrate/...) → sanctioned.
    }
  }

  return { block: false, detail: "" };
}

module.exports = { classifyCommand };

// --- Hook entrypoint ----------------------------------------------------------
if (require.main === module) {
  let input = "";
  process.stdin.on("data", (c) => (input += c));
  process.stdin.on("end", () => {
    let payload;
    try {
      payload = JSON.parse(input);
    } catch {
      process.exit(0);
    }

    if ((payload.tool_name || "") !== "Bash") {
      process.exit(0);
    }

    const { block, detail } = classifyCommand(
      (payload.tool_input || {}).command
    );
    if (!block) {
      process.exit(0);
    }

    console.error(
      `Blocked: ${detail} (CORE-ARCH-009). ` +
        `It applies a schema delta straight to the database with no migration file, ` +
        `which forks the prevId chain in drizzle/meta and corrupts the migration history. ` +
        `Use \`pnpm run db:generate\` to write a migration, then \`pnpm run db:migrate\` to apply it. ` +
        `To inspect the live schema without changing it: \`pnpm run db:studio\`.`
    );
    process.exit(2);
  });
}
