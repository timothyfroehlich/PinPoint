import { describe, expect, it, vi } from "vitest";

import {
  buildWatcherInvocation,
  watchPrLifecycle,
  watchPrLifecycleInputSchema,
  type WatchPrLifecycleInput,
} from "./pr-watcher-mcp";

const HEAD = "0123456789abcdef0123456789abcdef01234567";
const WORKTREE = process.cwd();
const INPUT: WatchPrLifecycleInput = {
  worktree: WORKTREE,
  pr: 2053,
  title: "feat(workflow): delegate PR lifecycle watching",
  phase: "ci",
  expected_head: HEAD,
};

function terminalJson(
  outcome: string,
  overrides: Record<string, unknown> = {}
): string {
  return `${JSON.stringify({
    schema_version: 1,
    repository: "timothyfroehlich/PinPoint",
    pr: INPUT.pr,
    phase: INPUT.phase,
    expected_head: INPUT.expected_head,
    observed_head: INPUT.expected_head,
    outcome,
    ci_gate: outcome === "passed" ? "SUCCESS" : "FAILURE",
    review_state: "unreviewed",
    unresolved_threads: 0,
    merge_state: "CLEAN",
    detail_url: "https://github.com/timothyfroehlich/PinPoint/pull/2053",
    failure_artifact: null,
    timestamp: "2026-09-06T12:00:00Z",
    ...overrides,
  })}\n`;
}

function runResult(code: number, stdout: string, stderr = "") {
  return { code, signal: null, stdout, stderr };
}

describe("watch_pr_lifecycle input", () => {
  it("accepts only the five-field strict envelope", () => {
    expect(watchPrLifecycleInputSchema.parse(INPUT)).toEqual(INPUT);
    expect(
      watchPrLifecycleInputSchema.safeParse({
        ...INPUT,
        command: "gh pr merge",
      }).success
    ).toBe(false);
  });

  it.each([
    ["relative worktree", { ...INPUT, worktree: "relative/path" }],
    ["non-positive PR", { ...INPUT, pr: 0 }],
    ["blank title", { ...INPUT, title: "   " }],
    ["unknown phase", { ...INPUT, phase: "merge" }],
    ["short SHA", { ...INPUT, expected_head: HEAD.slice(0, 10) }],
    ["uppercase SHA", { ...INPUT, expected_head: HEAD.toUpperCase() }],
  ])("rejects %s", (_label, candidate) => {
    expect(watchPrLifecycleInputSchema.safeParse(candidate).success).toBe(
      false
    );
  });
});

describe("canonical watcher invocation", () => {
  it("constructs the exact shell-free argv and telemetry environment", () => {
    const invocation = buildWatcherInvocation(INPUT, WORKTREE, {
      NODE_ENV: "test",
      PATH: "/usr/bin",
      GH_MONITOR_HARNESS: "codex",
      GH_MONITOR_MODEL: "gpt-5.3-codex-spark",
      GH_MONITOR_WAKES: "99",
    });

    expect(invocation).toEqual({
      command: "python3",
      args: [
        "scripts/workflow/pr-watch.py",
        "2053",
        "--phase",
        "ci",
        "--expected-head",
        HEAD,
        "--json",
      ],
      options: {
        cwd: WORKTREE,
        env: {
          NODE_ENV: "test",
          PATH: "/usr/bin",
          GH_MONITOR_HARNESS: "codex",
          GH_MONITOR_MODEL: "gpt-5.3-codex-spark",
          GH_MONITOR_WAKES: "1",
        },
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      },
    });
  });

  it("defaults unavailable telemetry identity to unknown", () => {
    const invocation = buildWatcherInvocation(INPUT, WORKTREE, {
      NODE_ENV: "test",
    });
    expect(invocation.options.env).toMatchObject({
      GH_MONITOR_HARNESS: "unknown",
      GH_MONITOR_MODEL: "unknown",
      GH_MONITOR_WAKES: "1",
    });
  });
});

describe("watchPrLifecycle", () => {
  it.each([
    [0, "passed"],
    [1, "failed"],
    [1, "action_required"],
    [2, "undetermined"],
    [2, "timed_out"],
  ])(
    "returns terminal JSON unchanged for exit %i / %s",
    async (code, outcome) => {
      const stdout = terminalJson(outcome);
      const runProcess = vi.fn().mockResolvedValue(runResult(code, stdout));

      await expect(
        watchPrLifecycle(INPUT, {
          runProcess,
          writeStderr: vi.fn(),
        })
      ).resolves.toBe(stdout);
      expect(runProcess).toHaveBeenCalledOnce();
    }
  );

  it("keeps watcher stderr out of the returned tool payload", async () => {
    const stdout = terminalJson("passed");
    const writeStderr = vi.fn();

    await expect(
      watchPrLifecycle(INPUT, {
        runProcess: vi
          .fn()
          .mockResolvedValue(
            runResult(0, stdout, "progress stays on stderr\n")
          ),
        writeStderr,
      })
    ).resolves.toBe(stdout);

    expect(writeStderr).toHaveBeenCalledWith("progress stays on stderr\n");
  });

  it("rejects a worktree other than the server's current Git worktree", async () => {
    await expect(
      watchPrLifecycle({ ...INPUT, worktree: "/tmp" }, { writeStderr: vi.fn() })
    ).rejects.toThrow("worktree mismatch");
  });

  it("treats process startup failure as a tool error", async () => {
    await expect(
      watchPrLifecycle(INPUT, {
        runProcess: vi.fn().mockRejectedValue(new Error("ENOENT")),
        writeStderr: vi.fn(),
      })
    ).rejects.toThrow("could not start canonical PR watcher: ENOENT");
  });

  it.each([
    ["malformed stdout", runResult(0, "not json\n")],
    ["unsupported exit", runResult(3, terminalJson("failed"))],
    [
      "signal exit",
      {
        ...runResult(0, terminalJson("passed")),
        code: null,
        signal: "SIGTERM",
      },
    ],
    ["mismatched envelope", runResult(0, terminalJson("passed", { pr: 99 }))],
    ["exit/outcome conflict", runResult(1, terminalJson("passed"))],
  ])("rejects %s", async (_label, result) => {
    await expect(
      watchPrLifecycle(INPUT, {
        runProcess: vi.fn().mockResolvedValue(result),
        writeStderr: vi.fn(),
      })
    ).rejects.toThrow();
  });
});
