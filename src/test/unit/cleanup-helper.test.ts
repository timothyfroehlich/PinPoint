import type { APIRequestContext } from "@playwright/test";
import { describe, it, expect, vi } from "vitest";

// eslint-disable-next-line no-restricted-imports -- e2e helpers live outside src alias paths
import { cleanupTestEntities } from "../../../e2e/support/cleanup";

type MinimalRequest = Pick<APIRequestContext, "post">;

const createRequestStub = (): MinimalRequest => ({
  post: vi.fn().mockResolvedValue({
    ok: () => true,
    status: () => 200,
    statusText: () => "OK",
  }),
});

describe("cleanupTestEntities helper", () => {
  it("sends prefix payload when provided", async () => {
    const request = createRequestStub();
    await cleanupTestEntities(request as APIRequestContext, {
      issueTitlePrefix: "E2E Public Report",
    });

    expect(request.post).toHaveBeenCalledTimes(1);
    const postArgs = request.post.mock.calls[0];
    expect(postArgs[0]).toBe("/api/test-data/cleanup");
    expect(postArgs[1]?.data).toEqual({
      issueIds: [],
      machineIds: [],
      machineInitials: [],
      userEmails: [],
      issueTitlePrefix: "E2E Public Report",
    });
  });

  it("does nothing when no identifiers provided", async () => {
    const request = createRequestStub();
    await cleanupTestEntities(request as APIRequestContext, {});

    expect(request.post).not.toHaveBeenCalled();
  });

  it("throws when API returns failure", async () => {
    const request: MinimalRequest = {
      post: vi.fn().mockResolvedValue({
        ok: () => false,
        status: () => 500,
        statusText: () => "Internal Server Error",
      }),
    };

    await expect(
      cleanupTestEntities(request as APIRequestContext, {
        issueIds: ["test-id"],
      })
    ).rejects.toThrow("Failed to cleanup test data: 500 Internal Server Error");
  });
});
