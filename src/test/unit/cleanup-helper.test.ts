import { describe, it, expect, vi } from "vitest";

// eslint-disable-next-line no-restricted-imports -- e2e helpers live outside src alias paths
import { cleanupTestEntities } from "../../../e2e/support/cleanup";

const createRequestStub = () => ({
  post: vi.fn().mockResolvedValue({
    ok: () => true,
    status: () => 200,
    statusText: () => "OK",
  }),
});

describe("cleanupTestEntities helper", () => {
  it("sends prefix payload when provided", async () => {
    const request = createRequestStub();
    await cleanupTestEntities(request as never, {
      issueTitlePrefix: "E2E Public Report",
    });

    expect(request.post).toHaveBeenCalledTimes(1);
    const postArgs = request.post.mock.calls[0];
    expect(postArgs[0]).toBe("/api/test-data/cleanup");
    expect(postArgs[1]?.data).toEqual({
      issueIds: [],
      machineIds: [],
      issueTitlePrefix: "E2E Public Report",
    });
  });

  it("does nothing when no identifiers provided", async () => {
    const request = createRequestStub();
    await cleanupTestEntities(request as never, {});

    expect(request.post).not.toHaveBeenCalled();
  });
});
