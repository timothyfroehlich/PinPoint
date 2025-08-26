/**
 * CamelCase -> snake_case alignment script.
 *
 * Goal: Update lingering camelCase DB field references in the codebase to match
 * the actual snake_case column names defined in Drizzle schema files.
 *
 * Strategy:
 * 1. Parse all schema files under src/server/db/schema to extract column names.
 * 2. For each snake_case column, generate a camelCase candidate (e.g. organization_id -> organizationId).
 * 3. Build a mapping camelCase -> snake_case ONLY when they differ AND the snake_case contains an underscore.
 * 4. Scan tracked *.ts / *.tsx source files (excluding schema + migrations + generated artifacts) for camelCase usages.
 * 5. Produce a dry-run report of proposed replacements (default) OR apply edits with --write.
 * 6. Avoid modifying the schema definition files themselves.
 *
 * Safety Nets:
 * - Only replaces exact word-boundary matches (\b) to avoid partial identifier corruption.
 * - Skips replacements inside lines already containing BOTH camelCase and snake_case variant (likely already migrated / dual reference).
 * - Outputs a per-file diff-like preview for manual review in dry-run mode.
 *
 * Usage:
 *  Dry run (default):  npx tsx scripts/convert-snake-case.ts
 *  Apply changes:      npx tsx scripts/convert-snake-case.ts --write
 *  Verbose logging:    npx tsx scripts/convert-snake-case.ts --write --verbose
 *  Limit to patterns:  npx tsx scripts/convert-snake-case.ts --include src/server/trpc
 *
 * Post-run validation:
 *  1. npm run typecheck
 *  2. npm test
 *  3. rg "organization_id.*organizationId|organizationId.*organization_id" --type ts
 */

import { readFileSync, writeFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

interface Options {
  write: boolean;
  verbose: boolean;
  include?: string[]; // simple substring filters
  files?: string[]; // explicit file paths
}

const cwd = process.cwd();
const SCHEMA_DIR = resolve(cwd, "src/server/db/schema");

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const opts: Options = { write: false, verbose: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--write") opts.write = true;
    else if (a === "--verbose" || a === "-v") opts.verbose = true;
    else if (a === "--include") {
      opts.include = (args[i + 1] || "").split(",").filter(Boolean);
      i++;
    } else if (a === "--file" || a === "-f") {
      const fileArg = args[i + 1];
      if (fileArg) {
        opts.files = (opts.files || []).concat(
          fileArg.split(",").filter(Boolean),
        );
        i++;
      }
    }
  }
  return opts;
}

const opts = parseArgs();

function log(...m: any[]) {
  if (opts.verbose) console.log("[convert]", ...m);
}

// --- Step 1: Extract snake_case columns from schema files ---
async function collectSchemaColumns(): Promise<Set<string>> {
  const columns = new Set<string>();
  const files = await readdir(SCHEMA_DIR);
  for (const f of files) {
    if (!f.endsWith(".ts")) continue;
    const full = resolve(SCHEMA_DIR, f);
    const content = readFileSync(full, "utf8");
    // Naive parse: inside pgTable( ... { ... } ) we match keys ending with colon
    const regex = /\b([a-z0-9_]+)\s*:\s*[^:{\n]+/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content))) {
      const col = match[1];
      // Filter obvious non-columns (pgEnum names, etc.) - heuristic: skip if contains uppercase
      if (/^[a-z0-9_]+$/.test(col)) {
        // Many items are not actual columns (like id). We still include; mapping logic will filter.
        columns.add(col);
      }
    }
  }
  return columns;
}

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

// Additional explicit columns that might be produced outside simple object literal parsing (rare), or to ensure mapping completeness
const MANUAL_SNAKE = [
  // Add any manual overrides here if discovered later
];

interface MappingEntry {
  camel: string;
  snake: string;
  occurrences?: number;
}

async function buildMapping(): Promise<MappingEntry[]> {
  const columns = await collectSchemaColumns();
  MANUAL_SNAKE.forEach((c) => columns.add(c));
  const mapping: MappingEntry[] = [];
  for (const snake of columns) {
    if (!snake.includes("_")) continue; // Only interested in true snake_case
    const camel = snakeToCamel(snake);
    if (camel === snake) continue;
    // Exclude extremely short ambiguous items
    if (camel.length <= 3) continue;
    mapping.push({ camel, snake });
  }
  // Deduplicate by camel (first wins)
  const seen = new Set<string>();
  return mapping
    .filter((m) => {
      if (seen.has(m.camel)) return false;
      seen.add(m.camel);
      return true;
    })
    .sort((a, b) => b.camel.length - a.camel.length); // Replace longer first to avoid partial overlaps
}

// --- Step 2: Gather candidate source files (git tracked for reliability) ---
function listSourceFiles(): string[] {
  if (opts.files && opts.files.length > 0) {
    return opts.files
      .map((f) => f.replace(/^\.\//, ""))
      .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"));
  }
  const raw = execSync("git ls-files", { encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean);
  return raw.filter(
    (p) =>
      (p.endsWith(".ts") || p.endsWith(".tsx")) &&
      !p.startsWith("src/server/db/schema/") &&
      !p.startsWith("drizzle/") &&
      !p.startsWith("node_modules/") &&
      !p.startsWith("supabase/migrations/") &&
      !p.includes(".d.ts") &&
      !p.startsWith("scripts/convert-snake-case"), // exclude self
  );
}

function includeFilter(path: string): boolean {
  if (!opts.include || opts.include.length === 0) return true;
  return opts.include.some((part) => path.includes(part));
}

interface FileChange {
  path: string;
  original: string;
  updated: string;
  diffs: string[];
}

type Mode = "all" | "properties";

function applyMappingAll(
  content: string,
  mapping: MappingEntry[],
): { updated: string; diffs: string[] } {
  let updated = content;
  const diffs: string[] = [];
  for (const { camel, snake } of mapping) {
    const wordRegex = new RegExp(`\\b${camel}\\b`, "g");
    if (!wordRegex.test(updated)) continue;
    wordRegex.lastIndex = 0;
    let localChanged = false;
    updated = updated.replace(wordRegex, (match, offset) => {
      const lineStart = updated.lastIndexOf("\n", offset) + 1;
      const lineEnd = updated.indexOf("\n", offset);
      const line = updated.substring(
        lineStart,
        lineEnd === -1 ? updated.length : lineEnd,
      );
      if (line.includes(snake)) return match;
      localChanged = true;
      return snake;
    });
    if (localChanged) diffs.push(`${camel} -> ${snake}`);
  }
  return { updated, diffs };
}

// Heuristic, targeted replacements limited to: object/interface keys, property access, quoted keys, shorthand destructuring/creation.
function applyMappingProperties(
  content: string,
  mapping: MappingEntry[],
): { updated: string; diffs: string[] } {
  const lines = content.split(/\n/);
  const fileDiffs = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const originalLine = line;
    for (const { camel, snake } of mapping) {
      // Skip if snake already present in line (avoid dual references churn)
      if (line.includes(snake) && !line.includes(camel)) continue;
      let changed = false;
      // 1. Dot property access: .camel -> .snake
      const dotRe = new RegExp(`(\\.)${camel}\\b`, "g");
      if (dotRe.test(line)) {
        line = line.replace(dotRe, `$1${snake}`);
        changed = true;
      }
      // 2. Object / interface key (identifier followed by ? or :) not preceded by quote
      const keyRe = new RegExp(`(^|[,{\t\s])${camel}(?=\s*[?:])`, "g");
      if (keyRe.test(line)) {
        line = line.replace(keyRe, (m) => m.replace(camel, snake));
        changed = true;
      }
      // 3. Quoted key: 'camel': or "camel":
      const quotedRe = new RegExp(`(['"])${camel}(['"])\s*:`, "g");
      if (quotedRe.test(line)) {
        line = line.replace(quotedRe, `$1${snake}$2:`);
        changed = true;
      }
      // 4. Shorthand property (object or destructuring): { camel,  or , camel } or { camel }
      const shorthandRe = new RegExp(`([,{])\s*${camel}(?=\s*[},])`, "g");
      if (shorthandRe.test(line)) {
        line = line.replace(
          shorthandRe,
          (full, prefix) => `${prefix} ${snake}`,
        );
        changed = true;
      }
      if (changed) fileDiffs.add(`${camel} -> ${snake}`);
    }
    if (line !== originalLine) lines[i] = line;
  }
  return { updated: lines.join("\n"), diffs: Array.from(fileDiffs) };
}

function applyMappingToContent(
  content: string,
  mapping: MappingEntry[],
  mode: Mode,
): { updated: string; diffs: string[] } {
  return mode === "all"
    ? applyMappingAll(content, mapping)
    : applyMappingProperties(content, mapping);
}

async function processFiles() {
  const mode: Mode =
    (process.env.CONVERT_MODE as Mode) ||
    (process.argv.includes("--mode=all") ? "all" : "properties");
  if (opts.verbose) console.log(`Mode: ${mode}`);
  const mapping = await buildMapping();
  if (mapping.length === 0) {
    console.error("No mapping entries derived. Aborting.");
    process.exit(1);
  }
  if (opts.verbose) {
    console.log("Derived mapping (camel -> snake):");
    mapping.forEach((m) => console.log(`  ${m.camel} -> ${m.snake}`));
  }

  const files = listSourceFiles().filter(includeFilter);
  const changes: FileChange[] = [];
  for (const file of files) {
    const full = resolve(cwd, file);
    let original: string;
    try {
      original = readFileSync(full, "utf8");
    } catch (err: any) {
      if (err && err.code === "ENOENT") {
        log(`Skipping missing file (git listed but not present): ${file}`);
        continue;
      }
      throw err;
    }
    const { updated, diffs } = applyMappingToContent(original, mapping, mode);
    if (diffs.length > 0 && original !== updated) {
      changes.push({ path: file, original, updated, diffs });
    }
  }

  if (changes.length === 0) {
    console.log(
      "✅ No camelCase field usages found needing conversion (based on schema).",
    );
    return;
  }

  if (!opts.write) {
    console.log("\n=== Dry Run Report (use --write to apply) ===");
    for (const ch of changes) {
      console.log(`\nFile: ${ch.path}`);
      console.log(`Changes: ${ch.diffs.join(", ")}`);
      // Provide contextual snippet lines
      const origLines = ch.original.split(/\n/);
      const updLines = ch.updated.split(/\n/);
      for (let i = 0; i < origLines.length; i++) {
        if (origLines[i] !== updLines[i]) {
          console.log(`- ${origLines[i]}`);
          console.log(`+ ${updLines[i]}`);
        }
      }
    }
    console.log(`\nSummary: ${changes.length} file(s) would be modified.`);
    if (opts.files && opts.files.length > 0) {
      console.log(
        `Processed only requested file list: ${opts.files.join(", ")}`,
      );
    }
  } else {
    for (const ch of changes) {
      writeFileSync(resolve(cwd, ch.path), ch.updated, "utf8");
      console.log(`✏️  Updated ${ch.path} (${ch.diffs.length} groups)`);
    }
    console.log(
      `\n✅ Applied snake_case conversions to ${changes.length} files.`,
    );
    console.log(
      "Next steps: run 'npm run typecheck' and 'npm test' to validate.",
    );
  }
}

processFiles().catch((err) => {
  console.error("Error during conversion:", err);
  process.exit(1);
});
