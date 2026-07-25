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
// Does this shell command invoke `drizzle-kit push` anywhere in it?
//
// Matches the binary followed by the `push` subcommand, allowing any runner
// prefix (pnpm exec / pnpm dlx / npx / bunx / yarn) and any flags between them
// (`drizzle-kit push --force`, `drizzle-kit push:pg` in older versions).
// Deliberately does NOT match other drizzle-kit subcommands — `generate`,
// `migrate`, `check`, `export`, and `studio` are all sanctioned.
function classifyCommand(command) {
  const cmd = String(command || "");

  // Strip heredoc bodies first: commit messages and docs legitimately contain
  // the string "drizzle-kit push" while explaining why it's banned.
  // Same technique as block-dangerous-commands.cjs.
  const stripped = cmd.replace(/<<-?'?(\w+)'?[\s\S]*?\n\1/g, "");

  // `drizzle-kit` (or drizzle-kit.js / .cjs / a path ending in it), then the
  // `push` subcommand, with optional flags in between.
  const regex = /\bdrizzle-kit(?:\.[cm]?js)?\b(?:\s+-[^\s]*)*\s+push\b/;

  if (regex.test(stripped)) {
    return { block: true, detail: "drizzle-kit push" };
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
