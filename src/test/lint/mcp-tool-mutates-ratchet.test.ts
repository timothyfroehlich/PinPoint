import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Defense-in-depth ratchet for MCP write throttling (bead PP-11wr).
 *
 * `runTool` (src/lib/mcp/tools/harness.ts) applies the `checkMcpWriteLimit`
 * rate limit only when a tool is defined with `mutates: true`. The flag is an
 * optional `mutates?: boolean` that defaults to falsy, so a mutating tool that
 * omits it silently loses the write limit. This is a rate-limit / abuse
 * control, not auth — `requireMcpAuthContext` gates the door and each handler
 * still calls `checkPermission` — but the write runs unthrottled against
 * production member data. The flag is loosely optional rather than structurally
 * enforced, so this test is what keeps it honest (the stronger fix the bead
 * notes — making `mutates` a required field on the `defineTool` options so the
 * type checker demands an answer — would close the residual gap below).
 *
 * Like protected-action-ratchet.test.ts, it reads the tool source rather than
 * the runtime registry: `mutates` is folded into a closure inside `defineTool`
 * and never set on the returned `ToolDefinition` (`{ name, register }`), so it
 * is only observable in source.
 *
 * Two independent invariants hold the line, each with an exception set that
 * only shrinks:
 *
 *  1. `mutates: true` agrees with the read/write intent the tool already
 *     advertises through its `annotations`: a tool annotated
 *     `WRITE_TOOL_ANNOTATIONS` declares `mutates: true`, and one annotated
 *     `READ_ONLY_TOOL_ANNOTATIONS` never does. This is the primary invariant —
 *     the rate-limit flag must match the destructiveHint the tool already
 *     declares — and it catches a write tool under any name, not only the
 *     add_/create_/update_/delete_ verbs.
 *  2. Belt and braces: a tool whose name begins with a write verb
 *     (add_/create_/update_/delete_) declares `mutates: true`. This catches a
 *     new write tool that also forgot its write annotation.
 *
 * Known blind spot: the guarantee is annotation-relative, not semantic — the
 * test cannot tell that a handler writes. A tool that is mis-annotated
 * `READ_ONLY_TOOL_ANNOTATIONS`, omits `mutates`, AND is named with a
 * non-write verb (e.g. `publish_settings`) defeats both invariants at once.
 * That takes two compounded mistakes; only a required `mutates` field would
 * close it fully (see above).
 *
 * Both invariants depend on the convention that a tool declares its annotation
 * as the bare `WRITE_TOOL_ANNOTATIONS` / `READ_ONLY_TOOL_ANNOTATIONS` constant.
 * An inline/composed annotation object classifies as "other" and fails the
 * "annotates every tool as a read or a write" check loudly — deliberate, to
 * keep the signal the invariant reads from unambiguous.
 */

const ROOT = process.cwd();
const TOOLS_DIR = join(ROOT, "src", "lib", "mcp", "tools");
const REGISTRY = join(TOOLS_DIR, "index.ts");

/** A scanned `export const … = defineTool({ … })` definition. */
interface ToolDef {
  /** `src/lib/mcp/tools/add-machine.ts` */
  file: string;
  /** The exported const identifier, e.g. `addMachineTool`. */
  constName: string;
  /** The tool's registered name, e.g. `add_machine`. */
  name: string;
  /** Whether the options object declares `mutates: true` at the top level. */
  mutates: boolean;
  /** Which annotations constant the tool declares, if a recognized one. */
  annotation: "write" | "read" | "other";
}

/**
 * If a string literal or line/block comment begins at `index`, the index just
 * past it; otherwise `index` unchanged. Lets the scanners below step over a
 * `}`, `,`, or quote that lives inside prose or a comment rather than counting
 * it as structure.
 */
function skipLiteral(source: string, index: number): number {
  const char = source[index];
  if (char === '"' || char === "'" || char === "`") {
    index++;
    while (index < source.length) {
      if (source[index] === "\\") {
        index += 2;
        continue;
      }
      if (source[index] === char) return index + 1;
      index++;
    }
    return index;
  }
  if (char === "/" && source[index + 1] === "/") {
    index += 2;
    while (index < source.length && source[index] !== "\n") index++;
    return index;
  }
  if (char === "/" && source[index + 1] === "*") {
    index += 2;
    while (
      index < source.length &&
      !(source[index] === "*" && source[index + 1] === "/")
    )
      index++;
    return index + 2;
  }
  return index;
}

/**
 * Index just past the bracket that closes the one at `open`, counting only
 * structural brackets — a bracket inside a string literal or comment is
 * skipped, so an unbalanced `}` in a description string cannot truncate the
 * span.
 */
function pastClosing(
  source: string,
  open: number,
  opener: string,
  closer: string
): number {
  let depth = 0;
  for (let index = open; index < source.length; index++) {
    const skipped = skipLiteral(source, index);
    if (skipped !== index) {
      index = skipped - 1;
      continue;
    }
    if (source[index] === opener) depth++;
    else if (source[index] === closer && --depth === 0) return index + 1;
  }
  return source.length;
}

/**
 * The comma-separated segments at the top level of an object-literal body,
 * skipping string literals and comments so a `,`, `(`, or `{` inside a
 * description string (or a nested object, array, or call) never splits or
 * nests a segment. Each segment is one `key: value` property, verbatim.
 */
function topLevelSegments(body: string): string[] {
  const segments: string[] = [];
  let depth = 0;
  let start = 0;
  let index = 0;
  while (index < body.length) {
    const skipped = skipLiteral(body, index);
    if (skipped !== index) {
      index = skipped;
      continue;
    }
    const char = body[index];
    if (char === "{" || char === "(" || char === "[") depth++;
    else if (char === "}" || char === ")" || char === "]") depth--;
    else if (char === "," && depth === 0) {
      segments.push(body.slice(start, index));
      start = index + 1;
    }
    index++;
  }
  segments.push(body.slice(start));
  return segments;
}

/** The top-level `key: value` properties of an object-literal body. */
function topLevelProps(body: string): Map<string, string> {
  const props = new Map<string, string>();
  for (const segment of topLevelSegments(body)) {
    const match = /^\s*(\w+)\s*:\s*([\s\S]*)$/.exec(segment);
    if (match) props.set(match[1], match[2].trim());
  }
  return props;
}

/**
 * Every `export const X = defineTool({ … })` definition under a source. Each
 * registered tool is one such export; a tool the scanner cannot see this way
 * is caught by the "scans every registered MCP tool" test rather than slipping
 * past silently.
 */
function toolDefs(file: string, source: string): ToolDef[] {
  const pattern =
    /export\s+const\s+(\w+)\s*=\s*defineTool\s*(?:<[^>]*>)?\s*\(\s*\{/g;
  const defs: ToolDef[] = [];
  for (let match; (match = pattern.exec(source));) {
    const open = match.index + match[0].length - 1;
    const body = source.slice(
      open + 1,
      pastClosing(source, open, "{", "}") - 1
    );
    const props = topLevelProps(body);
    const name = /^["'`](.+?)["'`]$/.exec(props.get("name") ?? "")?.[1] ?? "";
    const annotationValue = props.get("annotations") ?? "";
    defs.push({
      file,
      constName: match[1],
      name,
      // A literal `true` (optionally `as const`); any dynamic form is treated
      // as unproven and fails the write checks, forcing a static answer.
      mutates: /^true\b/.test(props.get("mutates") ?? ""),
      annotation: annotationValue.startsWith("WRITE_TOOL_ANNOTATIONS")
        ? "write"
        : annotationValue.startsWith("READ_ONLY_TOOL_ANNOTATIONS")
          ? "read"
          : "other",
    });
  }
  return defs;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")
      ? [path]
      : [];
  });
}

function definedTools(): ToolDef[] {
  return sourceFiles(TOOLS_DIR).flatMap((path) =>
    toolDefs(
      relative(ROOT, path).split(sep).join("/"),
      readFileSync(path, "utf8")
    )
  );
}

/** The tool const identifiers listed in the `PINPOINT_TOOLS` registry array. */
function registeredConsts(): string[] {
  const source = readFileSync(REGISTRY, "utf8");
  // Anchor past the `=` so the `[` found is the array literal, not the `[]`
  // in the `ToolDefinition[]` type annotation.
  const open = source.indexOf(
    "[",
    source.indexOf("=", source.indexOf("PINPOINT_TOOLS"))
  );
  const array = source.slice(open, pastClosing(source, open, "[", "]"));
  // Match each identifier element, with or without a trailing comma, so the
  // last element is captured even when Prettier has not yet added one.
  return [...array.matchAll(/(\w+)\s*(?:,|\])/g)].map((match) => match[1]);
}

const key = (def: ToolDef): string => `${def.file}#${def.name}`;

const WRITE_VERB = /^(?:add|create|update|delete)_/;

/**
 * Tools annotated as writes that do not declare `mutates: true`. Empty, and it
 * only shrinks: a new write tool that forgets the flag fails the first test,
 * and an entry that gains the flag fails the stale check until it is removed.
 */
const WRITE_WITHOUT_MUTATES = new Set<string>([]);

/** Read-annotated tools that nonetheless declare `mutates: true`. Only shrinks. */
const READ_WITH_MUTATES = new Set<string>([]);

/** Write-verb-named tools that do not declare `mutates: true`. Only shrinks. */
const NAMED_WRITE_WITHOUT_MUTATES = new Set<string>([]);

describe("MCP tools declare mutates on write paths (PP-11wr)", () => {
  const defs = definedTools();

  it("scans every registered MCP tool", () => {
    const scanned = new Set(defs.map((def) => def.constName));
    const registered = registeredConsts();
    expect(registered.length).toBeGreaterThan(0);
    expect(registered.filter((name) => !scanned.has(name))).toEqual([]);
    // Every scanned tool parsed a name, so an unparsed definition cannot hide.
    expect(defs.filter((def) => def.name === "").map(key)).toEqual([]);
    // And at least one write was seen, so the ratchet is never vacuous.
    expect(defs.some((def) => def.mutates)).toBe(true);
  });

  it("annotates every tool as a read or a write", () => {
    expect(defs.filter((def) => def.annotation === "other").map(key)).toEqual(
      []
    );
  });

  it("declares mutates: true on exactly the tools annotated as writes", () => {
    const writesMissingMutates = defs
      .filter(
        (def) =>
          def.annotation === "write" &&
          !def.mutates &&
          !WRITE_WITHOUT_MUTATES.has(key(def))
      )
      .map(key);
    expect(writesMissingMutates).toEqual([]);

    const readsClaimingMutates = defs
      .filter(
        (def) =>
          def.annotation === "read" &&
          def.mutates &&
          !READ_WITH_MUTATES.has(key(def))
      )
      .map(key);
    expect(readsClaimingMutates).toEqual([]);
  });

  it("declares mutates: true on every write-verb-named tool", () => {
    const offenders = defs
      .filter(
        (def) =>
          WRITE_VERB.test(def.name) &&
          !def.mutates &&
          !NAMED_WRITE_WITHOUT_MUTATES.has(key(def))
      )
      .map(key);
    expect(offenders).toEqual([]);
  });

  it("lists only exceptions that still exist and still violate", () => {
    const byKey = new Map(defs.map((def) => [key(def), def]));
    const stale = [
      ...[...WRITE_WITHOUT_MUTATES].filter((entry) => {
        const def = byKey.get(entry);
        return def?.annotation !== "write" || def.mutates;
      }),
      ...[...READ_WITH_MUTATES].filter((entry) => {
        const def = byKey.get(entry);
        return def?.annotation !== "read" || !def.mutates;
      }),
      ...[...NAMED_WRITE_WITHOUT_MUTATES].filter((entry) => {
        const def = byKey.get(entry);
        return def === undefined || !WRITE_VERB.test(def.name) || def.mutates;
      }),
    ];
    expect(stale).toEqual([]);
  });

  it("parses name, mutates, and annotation from the top level only", () => {
    const sample = `
  name: "update_thing",
  title: "Update thing",
  description:
    "Update a thing (with an optional reason) — returns { thing, url }, name: ignored.",
  inputSchema: z.object({ name: z.string(), mutates: z.boolean() }),
  annotations: WRITE_TOOL_ANNOTATIONS,
  mutates: true,
  run: runUpdateThing,
`;
    const [def] = toolDefs(
      "sample.ts",
      `export const sampleTool = defineTool({${sample}});`
    );
    expect(def).toMatchObject({
      name: "update_thing",
      mutates: true,
      annotation: "write",
    });
  });

  it("does not read a nested mutates or annotation as the tool's own", () => {
    const [def] = toolDefs(
      "sample.ts",
      `export const readTool = defineTool({
         name: "get_thing",
         inputSchema: z.object({ mutates: z.boolean().optional() }),
         annotations: READ_ONLY_TOOL_ANNOTATIONS,
         run: runGetThing,
       });`
    );
    expect(def).toMatchObject({
      name: "get_thing",
      mutates: false,
      annotation: "read",
    });
  });

  it("reads mutates declared as `true as const`", () => {
    const [def] = toolDefs(
      "sample.ts",
      `export const writeTool = defineTool({
         name: "create_thing",
         annotations: WRITE_TOOL_ANNOTATIONS,
         mutates: true as const,
         run: runCreateThing,
       });`
    );
    expect(def.mutates).toBe(true);
  });

  it("survives an unbalanced brace inside a description string", () => {
    // A lone `}` in prose must not truncate the options body; the real
    // annotations/mutates lines after it still parse.
    const [def] = toolDefs(
      "sample.ts",
      `export const writeTool = defineTool({
         name: "update_thing",
         description: "Close the ledger with a } and move on.",
         annotations: WRITE_TOOL_ANNOTATIONS,
         mutates: true,
         run: runUpdateThing,
       });`
    );
    expect(def).toMatchObject({
      name: "update_thing",
      mutates: true,
      annotation: "write",
    });
  });
});
