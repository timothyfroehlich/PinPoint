/**
 * Unit test: update_machine partial-failure observability (PP-3pmh)
 *
 * update_machine applies each field in its own service call and, once a field
 * has committed, reports a later failure as a partial-success payload rather
 * than throwing. Because it returns instead of throwing, `runTool` never sees
 * that failure and never reports it — so an unexpected exception after a
 * partial write must be sent to `reportError` inside the tool, the way
 * update_issue already does. A structured, expected rejection (an `ok: false`
 * service result) is audited but must NOT be reported, or every normal
 * not-found/conflict would page someone.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("~/lib/notifications", () => ({ dispatchNotification: vi.fn() }));
vi.mock("~/lib/observability/report-error", () => ({ reportError: vi.fn() }));
vi.mock("~/lib/permissions/helpers", () => ({
  checkPermission: vi.fn(() => true),
}));
vi.mock("~/services/machines", () => ({
  updateMachineName: vi.fn(),
  updateMachinePresence: vi.fn(),
  updateMachineOwner: vi.fn(),
  updateMachinePbmLink: vi.fn(),
  setMachineIcIntent: vi.fn(),
  updateMachineIscoredLink: vi.fn(),
}));
vi.mock("./shared", () => {
  class McpToolError extends Error {
    constructor(
      readonly reason: string,
      message: string
    ) {
      super(message);
      this.name = "McpToolError";
    }
  }
  return {
    McpToolError,
    defineTool: vi.fn(() => ({ name: "update_machine", register: vi.fn() })),
    WRITE_TOOL_ANNOTATIONS: {},
    machineUrl: (initials: string) => `https://example.test/m/${initials}`,
    resolveMachine: vi.fn(),
    resolveOwner: vi.fn(),
    getOwnerNamesByMachine: vi.fn(),
  };
});

import { reportError } from "~/lib/observability/report-error";
import {
  updateMachineName,
  updateMachinePbmLink,
  updateMachinePresence,
} from "~/services/machines";
import type { McpAuthContext } from "~/lib/mcp/verify-token";

import { McpToolError, resolveMachine, type MachineRef } from "./shared";
import { runUpdateMachine, type UpdateMachineArgs } from "./update-machine";

const ctx: McpAuthContext = {
  userId: "user-1",
  accessLevel: "admin",
  clientId: "client-1",
  authMode: "oauth",
};

const baseMachine: MachineRef = {
  id: "machine-1",
  initials: "MM",
  name: "Medieval Madness",
  ownerId: "owner-1",
  invitedOwnerId: null,
  presenceStatus: "on_the_floor",
  iscoredGameId: null,
  pinballmapIcIntent: null,
  pinballmapMachineId: null,
  pinballmapExcluded: false,
  pinballmapExcludedReason: null,
  pinballmapIntent: "no_sync",
  modelName: null,
  manufacturer: null,
  year: null,
  type: null,
  display: null,
  playerCount: null,
  designers: null,
  artists: null,
  programmers: null,
  opdbId: null,
  ipdbId: null,
};

describe("runUpdateMachine partial-failure reporting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveMachine).mockResolvedValue(baseMachine);
    vi.mocked(updateMachineName).mockResolvedValue({ changed: true });
  });

  it("reports an unexpected later-field exception after an earlier field committed", async () => {
    const boom = new Error("connection reset by peer");
    vi.mocked(updateMachinePresence).mockRejectedValue(boom);

    const args: UpdateMachineArgs = {
      machine: "MM",
      name: "New Name",
      presenceStatus: "off_the_floor",
    };
    const outcome = await runUpdateMachine(args, ctx);

    // The name write committed, so the call returns a partial payload…
    expect(outcome.result.partial).toBe(true);
    expect(outcome.result.failed?.field).toBe("presenceStatus");
    expect(outcome.applied.map((change) => change.field)).toEqual(["name"]);
    expect(outcome.auditOutcome).toBe("error");

    // …and the swallowed exception reaches Sentry via reportError — the bug.
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(
      boom,
      expect.objectContaining({
        action: "mcp.tool.update_machine",
        field: "presenceStatus",
      })
    );
  });

  it("does not report an expected structured rejection after a partial success", async () => {
    vi.mocked(updateMachinePbmLink).mockResolvedValue({
      ok: false,
      reason: "not_found",
      message: "That machine is no longer here.",
    });

    const args: UpdateMachineArgs = {
      machine: "MM",
      name: "New Name",
      pinballmapMachineId: 123,
    };
    const outcome = await runUpdateMachine(args, ctx);

    expect(outcome.result.partial).toBe(true);
    expect(outcome.result.failed?.field).toBe("pinballmap");
    // An ok:false result is an ordinary, audited rejection — never paged.
    expect(reportError).not.toHaveBeenCalled();
  });

  it("does not report in-tool when the first field fails and nothing committed", async () => {
    const boom = new Error("connection reset by peer");
    vi.mocked(updateMachinePresence).mockRejectedValue(boom);

    const args: UpdateMachineArgs = {
      machine: "MM",
      presenceStatus: "off_the_floor",
    };

    // With no prior write, the tool throws so runTool handles and reports it;
    // reporting a second time inside the tool would double-count the event.
    await expect(runUpdateMachine(args, ctx)).rejects.toThrow(
      "connection reset by peer"
    );
    expect(reportError).not.toHaveBeenCalled();
  });

  it("does not report an McpToolError thrown by a service after a partial success", async () => {
    vi.mocked(updateMachinePresence).mockRejectedValue(
      new McpToolError("conflict", "The machine changed under you.")
    );

    const args: UpdateMachineArgs = {
      machine: "MM",
      name: "New Name",
      presenceStatus: "off_the_floor",
    };
    const outcome = await runUpdateMachine(args, ctx);

    expect(outcome.result.partial).toBe(true);
    expect(outcome.result.failed?.field).toBe("presenceStatus");
    // An McpToolError is already curated: its message passes through to the
    // caller and it is NOT re-reported, mirroring how runTool treats a thrown
    // McpToolError. This locks the `!(cause instanceof McpToolError)` guard.
    expect(outcome.result.failed?.reason).toBe(
      "The machine changed under you."
    );
    expect(reportError).not.toHaveBeenCalled();
  });
});
