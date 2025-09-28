/**
 * Issue Actions – createIssueAction (Integration) – TDD Tests
 *
 * Tests the Server Action createIssueAction for validation error surfacing
 * and success path wiring as specified in the feature spec.
 *
 * From feature spec: "Server Action createIssueAction: validation error
 * surfacing and success path wiring"
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import { createIssueAction } from "~/lib/actions/issue-actions";

// Mock the tRPC client
vi.mock("~/trpc/client", () => ({
  api: {
    issue: {
      core: {
        create: {
          mutate: vi.fn(),
        },
      },
    },
  },
}));

// Mock revalidatePath and redirect
vi.mock("next/navigation", () => ({
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));

describe("createIssueAction (integration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates required fields and surfaces field errors", async () => {
    const formData = new FormData();
    // Missing required title and machineId

    const result = await createIssueAction(formData);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.title).toMatch(/required|title/i);
    expect(result.errors?.machineId).toMatch(/required|machine/i);
  });

  it("validates title format and surfaces validation errors", async () => {
    const formData = new FormData();
    formData.append("title", "   "); // Empty/whitespace title
    formData.append("machineId", SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1);

    const result = await createIssueAction(formData);

    expect(result.success).toBe(false);
    expect(result.errors?.title).toMatch(/title/i);
  });

  it("creates issue successfully and redirects", async () => {
    const { api } = await import("~/trpc/client");
    const { redirect } = await import("next/navigation");

    // Mock successful tRPC call
    const mockCreatedIssue = {
      id: SEED_TEST_IDS.ISSUES.KAIJU_FIGURES,
      title: "Test Issue",
      createdById: SEED_TEST_IDS.USERS.ADMIN,
    };
    (api.issue.core.create.mutate as any).mockResolvedValue(mockCreatedIssue);

    const formData = new FormData();
    formData.append("title", "Test Issue");
    formData.append("description", "Test description");
    formData.append("machineId", SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1);

    const result = await createIssueAction(formData);

    expect(result.success).toBe(true);
    expect(api.issue.core.create.mutate).toHaveBeenCalledWith({
      title: "Test Issue",
      description: "Test description",
      machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
    });
    expect(redirect).toHaveBeenCalledWith(`/issues/${mockCreatedIssue.id}`);
  });

  it("handles tRPC errors and surfaces them as form errors", async () => {
    const { api } = await import("~/trpc/client");

    // Mock tRPC throwing validation error
    const tRPCError = new Error("Machine not found or does not belong to this organization");
    (api.issue.core.create.mutate as any).mockRejectedValue(tRPCError);

    const formData = new FormData();
    formData.append("title", "Test Issue");
    formData.append("machineId", "invalid-machine-id");

    const result = await createIssueAction(formData);

    expect(result.success).toBe(false);
    expect(result.errors?.machineId).toMatch(/machine.*not found/i);
  });

  it("handles missing default status/priority errors", async () => {
    const { api } = await import("~/trpc/client");

    // Mock tRPC throwing missing defaults error
    const tRPCError = new Error("Default issue status not found. Please contact an administrator.");
    (api.issue.core.create.mutate as any).mockRejectedValue(tRPCError);

    const formData = new FormData();
    formData.append("title", "Test Issue");
    formData.append("machineId", SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1);

    const result = await createIssueAction(formData);

    expect(result.success).toBe(false);
    expect(result.errors?.general).toMatch(/default.*status.*administrator/i);
  });
});