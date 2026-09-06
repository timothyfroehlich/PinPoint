#!/usr/bin/env node

import { spawn } from "node:child_process";
import { realpath, stat } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { pathToFileURL } from "node:url";

import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";

const FULL_SHA = /^[0-9a-f]{40}$/;
const TERMINAL_OUTCOMES = [
  "passed",
  "failed",
  "superseded",
  "action_required",
  "stale",
  "conflicting",
  "undetermined",
  "timed_out",
] as const;

export const watchPrLifecycleInputSchema = z
  .object({
    worktree: z
      .string()
      .refine(isAbsolute, "worktree must be an absolute path"),
    pr: z.number().int().positive(),
    title: z.string().trim().min(1),
    phase: z.enum(["ci", "review"]),
    expected_head: z.string().regex(FULL_SHA),
  })
  .strict();

const terminalWatcherSchema = z
  .object({
    schema_version: z.literal(1),
    repository: z.string().min(1),
    pr: z.number().int().positive(),
    phase: z.enum(["ci", "review"]),
    expected_head: z.string().regex(FULL_SHA),
    observed_head: z.union([z.literal(""), z.string().regex(FULL_SHA)]),
    outcome: z.enum(TERMINAL_OUTCOMES),
    ci_gate: z.string(),
    review_state: z.string(),
    unresolved_threads: z.number().int().nonnegative(),
    merge_state: z.string(),
    detail_url: z.string().nullable(),
    failure_artifact: z.string().nullable(),
    timestamp: z.string().min(1),
  })
  .passthrough();

export type WatchPrLifecycleInput = z.infer<typeof watchPrLifecycleInputSchema>;

export interface WatcherInvocation {
  command: "python3";
  args: string[];
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    shell: false;
    stdio: ["ignore", "pipe", "pipe"];
  };
}

interface WatcherProcessResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

interface WatcherDependencies {
  currentWorktree: string;
  environment: NodeJS.ProcessEnv;
  resolveRealpath: typeof realpath;
  inspectPath: typeof stat;
  runProcess: (invocation: WatcherInvocation) => Promise<WatcherProcessResult>;
  writeStderr: (text: string) => void;
}

function defaultDependencies(): WatcherDependencies {
  return {
    currentWorktree: process.cwd(),
    environment: process.env,
    resolveRealpath: realpath,
    inspectPath: stat,
    runProcess: runWatcherProcess,
    writeStderr: (text) => process.stderr.write(text),
  };
}

function outcomeMatchesExit(code: number, outcome: string): boolean {
  if (code === 0) return outcome === "passed";
  if (code === 1) {
    return [
      "failed",
      "superseded",
      "action_required",
      "stale",
      "conflicting",
    ].includes(outcome);
  }
  return code === 2 && ["undetermined", "timed_out"].includes(outcome);
}

async function verifyWorktree(
  inputWorktree: string,
  dependencies: WatcherDependencies
): Promise<string> {
  let requested: string;
  let current: string;
  try {
    [requested, current] = await Promise.all([
      dependencies.resolveRealpath(inputWorktree),
      dependencies.resolveRealpath(dependencies.currentWorktree),
    ]);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`could not resolve watcher worktree: ${message}`, {
      cause: error,
    });
  }

  if (requested !== current) {
    throw new Error(
      `worktree mismatch: requested ${requested}, server is running in ${current}`
    );
  }

  try {
    await Promise.all([
      dependencies.inspectPath(join(current, ".git")),
      dependencies.inspectPath(
        join(current, "scripts", "workflow", "pr-watch.py")
      ),
    ]);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`watcher worktree is incomplete: ${message}`, {
      cause: error,
    });
  }

  return current;
}

export function buildWatcherInvocation(
  input: WatchPrLifecycleInput,
  worktree: string,
  environment: NodeJS.ProcessEnv
): WatcherInvocation {
  return {
    command: "python3",
    args: [
      "scripts/workflow/pr-watch.py",
      String(input.pr),
      "--phase",
      input.phase,
      "--expected-head",
      input.expected_head,
      "--json",
    ],
    options: {
      cwd: worktree,
      env: {
        ...environment,
        GH_MONITOR_HARNESS: environment["GH_MONITOR_HARNESS"] ?? "unknown",
        GH_MONITOR_MODEL: environment["GH_MONITOR_MODEL"] ?? "unknown",
        GH_MONITOR_WAKES: "1",
      },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    },
  };
}

export function runWatcherProcess(
  invocation: WatcherInvocation
): Promise<WatcherProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      invocation.command,
      invocation.args,
      invocation.options
    );
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", (error) => reject(error));
    child.once("close", (code, signal) => {
      resolve({ code, signal, stdout, stderr });
    });
  });
}

export async function watchPrLifecycle(
  input: WatchPrLifecycleInput,
  overrides: Partial<WatcherDependencies> = {}
): Promise<string> {
  const dependencies = { ...defaultDependencies(), ...overrides };
  const worktree = await verifyWorktree(input.worktree, dependencies);
  const invocation = buildWatcherInvocation(
    input,
    worktree,
    dependencies.environment
  );

  dependencies.writeStderr(
    `Watching PR #${input.pr} — ${input.title} (${input.phase}, ${input.expected_head.slice(0, 10)})\n`
  );

  let result: WatcherProcessResult;
  try {
    result = await dependencies.runProcess(invocation);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`could not start canonical PR watcher: ${message}`, {
      cause: error,
    });
  }

  if (result.stderr) dependencies.writeStderr(result.stderr);
  if (result.code === null) {
    throw new Error(
      `canonical PR watcher exited by signal ${result.signal ?? "unknown"}`
    );
  }
  if (![0, 1, 2].includes(result.code)) {
    throw new Error(
      `canonical PR watcher exited with unsupported code ${result.code}`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.stdout.trim());
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `canonical PR watcher returned malformed stdout: ${message}`,
      { cause: error }
    );
  }

  const terminal = terminalWatcherSchema.safeParse(parsed);
  if (!terminal.success) {
    throw new Error(
      `canonical PR watcher returned invalid terminal JSON: ${terminal.error.message}`
    );
  }
  if (
    terminal.data.pr !== input.pr ||
    terminal.data.phase !== input.phase ||
    terminal.data.expected_head !== input.expected_head
  ) {
    throw new Error(
      "canonical PR watcher returned a mismatched result envelope"
    );
  }
  if (!outcomeMatchesExit(result.code, terminal.data.outcome)) {
    throw new Error(
      `canonical PR watcher exit ${result.code} conflicts with outcome ${terminal.data.outcome}`
    );
  }

  return result.stdout;
}

export function createPrWatcherServer(): McpServer {
  const server = new McpServer(
    { name: "pinpoint-pr-lifecycle-watcher", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.registerTool(
    "watch_pr_lifecycle",
    {
      title: "Watch one PinPoint PR lifecycle phase",
      description:
        "Wait for CI or exact-head Codex review state using PinPoint's canonical watcher.",
      inputSchema: watchPrLifecycleInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (input) => ({
      content: [{ type: "text", text: await watchPrLifecycle(input) }],
    })
  );

  return server;
}

export function main(): void {
  serveStdio(createPrWatcherServer, {
    onerror: (error) => process.stderr.write(`${error.message}\n`),
  });
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(entryPath).href) main();
