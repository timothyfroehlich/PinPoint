import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ilike } from "drizzle-orm";

import { POST } from "./route";
import { issues } from "~/server/db/schema";

const issuesWhere = vi.fn();
const machinesWhere = vi.fn();

const issuesReturning = vi.fn();
const machinesReturning = vi.fn();

const issuesDelete = vi.fn(() => ({ where: issuesWhere }));
const machinesDelete = vi.fn(() => ({ where: machinesWhere }));

vi.mock("~/server/db", () => ({
  db: {
    delete: (table: unknown) => {
      if (table === issues) {
        return issuesDelete();
      }
      return machinesDelete();
    },
  },
}));

const makeRequest = (body: unknown) =>
  new Request("http://localhost/api/test-data/cleanup", {
    method: "POST",
    body: JSON.stringify(body),
  });

describe("api/test-data/cleanup", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    issuesWhere.mockReset().mockReturnValue({ returning: issuesReturning });
    machinesWhere.mockReset().mockReturnValue({ returning: machinesReturning });
    issuesReturning.mockReset().mockResolvedValue([]);
    machinesReturning.mockReset().mockResolvedValue([]);
    process.env = { ...envBackup, NODE_ENV: "development" };
  });

  afterEach(() => {
    process.env = envBackup;
  });

  it("deletes issues by title prefix when requested", async () => {
    const prefix = "E2E_Public Report";
    const escaped = prefix.replace(/[%_\\]/g, "\\$&");
    const expectedCondition = ilike(issues.title, `${escaped}%`);
    issuesReturning.mockResolvedValue([{ id: "issue-1" }]);

    const response = await POST(makeRequest({ issueTitlePrefix: prefix }));
    const json = await response.json();

    expect(issuesWhere).toHaveBeenCalledTimes(1);
    expect(issuesWhere.mock.calls[0]?.[0]).toEqual(expectedCondition);
    expect(json.removedIssues).toEqual(["issue-1"]);
    expect(machinesWhere).not.toHaveBeenCalled();
  });

  it("supports explicit IDs for issues and machines", async () => {
    const issueId = "00000000-0000-4000-8000-000000000002";
    const machineId = "00000000-0000-4000-8000-000000000010";
    issuesReturning.mockResolvedValue([{ id: issueId }]);
    machinesReturning.mockResolvedValue([{ id: machineId }]);

    const response = await POST(
      makeRequest({
        issueIds: [issueId],
        machineIds: [machineId],
      })
    );
    const json = await response.json();

    expect(issuesWhere).toHaveBeenCalledTimes(1);
    expect(machinesWhere).toHaveBeenCalledTimes(1);
    expect(json.removedIssues).toEqual([issueId]);
    expect(json.removedMachines).toEqual([machineId]);
  });

  it("returns 403 in production", async () => {
    process.env.NODE_ENV = "production";

    const response = await POST(makeRequest({}));

    expect(response.status).toBe(403);
  });
});
