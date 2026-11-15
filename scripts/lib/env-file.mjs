import { readFileSync } from "node:fs";

/**
 * Read a few named keys out of a dotenv file into `process.env`.
 *
 * Exists so a connection string never has to be pasted onto a command line,
 * where it lands in shell history and in a tool's own logs. Only the keys the
 * caller names are read; everything else in the file is ignored, unlike Node's
 * `--env-file`, which loads every key.
 *
 * An already-exported variable wins over the file (standard dotenv
 * precedence), so an explicit `export POSTGRES_URL_READONLY=<prod>` is never
 * silently swapped for a worktree's local `.env.local`. Getting which database
 * a script points at wrong is the one failure these tools cannot have.
 *
 * @param {string} path
 * @param {{ keys: string[], required?: boolean }} options
 * @throws {Error} when `required` and the file cannot be read
 */
export function loadEnvFile(path, { keys, required = true }) {
  let contents;
  try {
    contents = readFileSync(path, "utf8");
  } catch (error) {
    // A missing default file is not an error — the caller may have exported the
    // variables instead. An explicitly named one that cannot be read is.
    if (!required) return;
    throw new Error(`Cannot read env file ${path}: ${error.message}`, {
      cause: error,
    });
  }
  const wanted = new Set(keys);
  for (const line of contents.split("\n")) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    const key = match?.[1];
    if (key === undefined || !wanted.has(key)) continue;
    const value = (match?.[2] ?? "").trim().replace(/^["']|["']$/g, "");
    if (value && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
