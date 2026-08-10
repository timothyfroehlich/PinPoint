/**
 * Unit test: the MCP tool harness's audit line (PP-u4ab.14)
 *
 * One log line per call is the ONLY server-side record of what the MCP surface
 * did to production, so what that line says about the outcome has to match what
 * happened. The case this pins is the awkward one: `update_issue` applies each
 * field in its own transaction, so a mid-run failure comes back as a success
 * PAYLOAD (the earlier fields are written and the caller has to be told which).
 * Without the override, that call would be audited `outcome: "ok"` and a
 * half-applied write would leave no trace at all.
 */

import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { logMcpToolCall } from "~/lib/mcp/audit";
import { reportError } from "~/lib/observability/report-error";

import { McpToolError, runTool } from "./shared";

vi.mock("~/lib/mcp/audit", () => ({ logMcpToolCall: vi.fn() }));
vi.mock("~/lib/observability/report-error", () => ({ reportError: vi.fn() }));

const AUTH = {
  token: "test-token",
  clientId: "claude-code-bearer",
  scopes: [],
  extra: {
    userId: "11111111-1111-4111-8111-111111111111",
    clientId: "claude-code-bearer",
    accessLevel: "admin",
  },
} as unknown as AuthInfo;

const audited = vi.mocked(logMcpToolCall);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runTool audit outcome", () => {
  it("logs ok when a tool returns no override", async () => {
    await runTool("demo", { authInfo: AUTH }, () =>
      Promise.resolve({ result: { fine: true } })
    );

    expect(audited).toHaveBeenCalledWith(
      expect.objectContaining({ tool: "demo", outcome: "ok" })
    );
  });

  it("logs error with the reason when a tool overrides the outcome", async () => {
    const response = await runTool("demo", { authInfo: AUTH }, () =>
      Promise.resolve({
        result: { partial: true },
        issueId: "22222222-2222-4222-8222-222222222222",
        auditOutcome: "error" as const,
        auditReason: "partial:priority",
      })
    );

    expect(audited).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: "demo",
        outcome: "error",
        reason: "partial:priority",
        issueId: "22222222-2222-4222-8222-222222222222",
      })
    );
    // The CALLER still gets the payload — the override changes what is audited,
    // not what the tool reports back (CORE-ARCH-012).
    expect(response.isError).toBeUndefined();
  });

  it("logs denied without reporting an McpToolError", async () => {
    const response = await runTool("demo", { authInfo: AUTH }, () =>
      Promise.reject(new McpToolError("denied", "You cannot do that."))
    );

    expect(audited).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "denied", reason: "denied" })
    );
    expect(reportError).not.toHaveBeenCalled();
    expect(response.isError).toBe(true);
  });

  it("reports an unexpected error and keeps its text out of the response", async () => {
    const response = await runTool("demo", { authInfo: AUTH }, () =>
      Promise.reject(new Error('relation "issues" does not exist'))
    );

    expect(reportError).toHaveBeenCalled();
    expect(audited).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "error", reason: "exception" })
    );
    expect(JSON.stringify(response)).not.toContain("relation");
  });
});
