// CORE-ARCH-009 enforcement, one layer below the shell.
//
// `drizzle-kit push` diffs the live database against the schema and applies the
// delta directly, producing NO migration file. The next `db:generate` then
// writes a migration against a snapshot that no longer matches reality, and the
// `prevId` chain in `drizzle/meta` silently forks. Recovery means hand-repairing
// binary-ish snapshot files (see the pinpoint-deployment skill), which
// is exactly the state that folder is never supposed to enter.
//
// The guard lives here — and is invoked from `drizzle.config.ts`, which
// drizzle-kit itself executes — rather than in a hook that pattern-matches the
// shell string that launched the process. That placement is what makes it
// airtight: no wrapper, quoting, subshell, heredoc, `sh -c`, `pnpm exec --`, or
// `node node_modules/drizzle-kit/bin.cjs` spelling can route around it, because
// every one of those spellings still ends up executing this module. It also
// cannot fire on prose that merely NAMES the command, because it only runs when
// drizzle-kit actually runs.
//
// `package.json`'s `db:_push` tripwire stays as a cheap, independent second
// line of defense.

/** `push`, plus the legacy dialect-suffixed spelling (`push:pg`, `push:mysql`). */
const PUSH_SUBCOMMAND = /^push(:|$)/;

export const DRIZZLE_PUSH_REFUSAL =
  `REFUSED: drizzle-kit push is banned in this repo (CORE-ARCH-009).\n` +
  `   It applies a schema delta straight to the database with no migration file,\n` +
  `   which forks the prevId chain in drizzle/meta and corrupts the migration history.\n` +
  `   Use \`pnpm run db:generate\` to write a migration, then \`pnpm run db:migrate\` to apply it.\n` +
  `   To inspect the live schema without changing it: \`pnpm run db:studio\`.`;

/**
 * The drizzle-kit subcommand being run, or `undefined` when the config was
 * loaded by something other than the drizzle-kit CLI (vitest, tsx, an editor).
 *
 * drizzle-kit's CLI shape is `drizzle-kit <command> [flags]`, and argv arrives
 * as `[node, .../drizzle-kit/bin.cjs, "<command>", "--config=..."]` — so the
 * subcommand is the first non-flag token after the script path.
 */
export function findDrizzleSubcommand(
  argv: readonly string[]
): string | undefined {
  return argv.slice(2).find((token) => !token.startsWith("-"));
}

/** Is this argv a `drizzle-kit push` (or `push:<dialect>`) invocation? */
export function isDrizzlePushInvocation(argv: readonly string[]): boolean {
  const subcommand = findDrizzleSubcommand(argv);
  return subcommand !== undefined && PUSH_SUBCOMMAND.test(subcommand);
}

/**
 * Throw if drizzle-kit was invoked with `push`.
 *
 * Call this BEFORE resolving any credentials so a refusal can never surface a
 * connection string. Sanctioned subcommands (generate, migrate, check, export,
 * studio, up) fall straight through.
 */
export function assertNotDrizzlePush(
  argv: readonly string[] = process.argv
): void {
  if (!isDrizzlePushInvocation(argv)) return;
  throw new Error(DRIZZLE_PUSH_REFUSAL);
}
