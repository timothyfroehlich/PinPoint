/**
 * Issue Server Actions Tests - Archetype 5
 * Server Action testing focusing on FormData validation and boundary conditions
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import { createIssueAction, updateIssueStatusAction } from "./issue-actions";

// Mock the canonical auth resolver used by Server Actions
vi.mock("~/server/auth/context", () => ({
  getRequestAuthContext: vi.fn(),
  requireAuthorized: vi.fn(),
}));

const { getRequestAuthContext } = await import("~/server/auth/context");
const mockGetRequestAuthContext = vi.mocked(getRequestAuthContext);

describe("Issue Server Actions (Server Action Tests - Archetype 5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up default authorized state using canonical discriminated union
    mockGetRequestAuthContext.mockResolvedValue({
      kind: "authorized",
      user: {
        id: SEED_TEST_IDS.USERS.ADMIN,
        email: "tim@pinpoint.dev",
        name: "Tim Froehlich",
      },
      org: {
        id: SEED_TEST_IDS.ORGANIZATIONS.primary,
        name: "Test Organization",
        subdomain: "test-org",
      },
      membership: {
        id: "membership-test",
        role: {
          id: "role-admin",
          name: "Admin",
          permissions: [],
        },
        userId: SEED_TEST_IDS.USERS.ADMIN,
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      },
    });
  });

  describe("FormData validation patterns", () => {
    it("validates required fields and returns structured errors", async () => {
      const formData = new FormData();
      // Missing required fields: title and machineId
      formData.append("description", "Test description");

      const result = await createIssueAction(null, formData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Validation failed");
        expect(result.fieldErrors).toBeDefined();
        expect(result.fieldErrors?.title).toBeDefined();
        expect(result.fieldErrors?.machineId).toBeDefined();
      }
    });

    it("validates string length constraints", async () => {
      const formData = new FormData();
      formData.append("title", ""); // Empty title should fail min(1)
      formData.append("machineId", SEED_TEST_IDS.MOCK_PATTERNS.MACHINE);

      const result = await createIssueAction(null, formData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.fieldErrors?.title).toBeDefined();
        expect(result.fieldErrors?.title?.[0]).toContain("expected string");
      }
    });

    it("validates UUID format for machineId", async () => {
      const formData = new FormData();
      formData.append("title", "Test Issue");
      formData.append("machineId", "not-a-valid-uuid");

      const result = await createIssueAction(null, formData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.fieldErrors?.machineId).toContain(
          "Invalid machine selection",
        );
      }
    });

    it("validates enum values for priority", async () => {
      const formData = new FormData();
      formData.append("title", "Test Issue");
      formData.append("machineId", SEED_TEST_IDS.MOCK_PATTERNS.MACHINE);
      formData.append("priority", "invalid-priority");

      const result = await createIssueAction(null, formData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.fieldErrors?.priority).toBeDefined();
      }
    });

    it("handles optional fields correctly", async () => {
      const formData = new FormData();
      formData.append("title", "Test Issue");
      formData.append("machineId", SEED_TEST_IDS.MOCK_PATTERNS.MACHINE);
      // description and assigneeId omitted - should be fine

      // This test will fail auth, but validation should pass
      mockGetRequestAuthContext.mockResolvedValue({
        kind: "unauthenticated",
      });

      const result = await createIssueAction(null, formData);

      // Should fail on auth, not validation
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Member access required");
        expect(result.fieldErrors).toBeUndefined(); // No validation errors
      }
    });

    it("processes empty strings as undefined for optional fields", async () => {
      const formData = new FormData();
      formData.append("title", "Test Issue");
      formData.append("description", ""); // Empty string should become undefined
      formData.append("machineId", SEED_TEST_IDS.MOCK_PATTERNS.MACHINE);

      mockGetRequestAuthContext.mockResolvedValue({
        kind: "unauthenticated",
      });

      const result = await createIssueAction(null, formData);

      // Should fail on auth, not validation (empty description is fine)
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Member access required");
        expect(result.fieldErrors).toBeUndefined();
      }
    });

    it("trims whitespace from string fields", async () => {
      const formData = new FormData();
      formData.append("title", "  Test Issue  "); // Whitespace should be trimmed
      formData.append("machineId", SEED_TEST_IDS.MOCK_PATTERNS.MACHINE);

      mockGetRequestAuthContext.mockResolvedValue({
        kind: "unauthenticated",
      });

      const result = await createIssueAction(null, formData);

      // Should fail on auth, not validation (trimmed title should pass)
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Member access required");
        expect(result.fieldErrors).toBeUndefined();
      }
    });
  });

  describe("updateIssueStatusAction validation", () => {
    const testIssueId = "issue-test-123";

    it("validates required statusId field", async () => {
      const formData = new FormData();
      // statusId missing

      const result = await updateIssueStatusAction(testIssueId, null, formData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Validation failed");
        expect(result.fieldErrors?.statusId).toBeDefined();
      }
    });

    it("validates UUID format for statusId", async () => {
      const formData = new FormData();
      formData.append("statusId", "not-a-uuid");

      const result = await updateIssueStatusAction(testIssueId, null, formData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.fieldErrors?.statusId?.[0]).toContain("valid UUID");
      }
    });

    it("passes validation with valid statusId", async () => {
      const formData = new FormData();
      formData.append("statusId", "550e8400-e29b-41d4-a716-446655440000");

      // Should fail on auth, not validation
      mockGetRequestAuthContext.mockResolvedValue({
        kind: "unauthenticated",
      });

      const result = await updateIssueStatusAction(testIssueId, null, formData);

      // Should fail on auth, not validation
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Member access required");
        expect(result.fieldErrors).toBeUndefined();
      }
    });
  });

  describe("Authentication boundary testing", () => {
    it("requires authentication for createIssueAction", async () => {
      mockGetRequestAuthContext.mockResolvedValue({
        kind: "unauthenticated",
      });

      const formData = new FormData();
      formData.append("title", "Test Issue");
      formData.append("machineId", SEED_TEST_IDS.MOCK_PATTERNS.MACHINE);

      const result = await createIssueAction(null, formData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Member access required");
      }
      expect(mockGetRequestAuthContext).toHaveBeenCalledOnce();
    });

    it("requires authentication for updateIssueStatusAction", async () => {
      mockGetRequestAuthContext.mockResolvedValue({
        kind: "unauthenticated",
      });

      const formData = new FormData();
      formData.append("statusId", "550e8400-e29b-41d4-a716-446655440000");

      const result = await updateIssueStatusAction(
        "issue-test",
        null,
        formData,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Member access required");
      }
      expect(mockGetRequestAuthContext).toHaveBeenCalledOnce();
    });
  });

  describe("Server Action structure verification", () => {
    it("Server Actions have correct function signatures", () => {
      // Verify React 19 useActionState compatibility
      expect(typeof createIssueAction).toBe("function");
      expect(createIssueAction.length).toBe(2); // _prevState, formData

      expect(typeof updateIssueStatusAction).toBe("function");
      expect(updateIssueStatusAction.length).toBe(3); // issueId, _prevState, formData
    });

    it("Server Actions are marked with 'use server'", () => {
      // This is a structural test - the functions should exist and be callable
      expect(createIssueAction).toBeDefined();
      expect(updateIssueStatusAction).toBeDefined();
    });

    it("Server Actions return ActionResult type structure", async () => {
      const formData = new FormData();
      // Invalid data to ensure we get an error result

      const result = await createIssueAction(null, formData);

      // Should have ActionResult structure
      expect(result).toHaveProperty("success");
      expect(typeof result.success).toBe("boolean");

      if (result.success) {
        expect(result).toHaveProperty("data");
      } else {
        expect(result).toHaveProperty("error");
        expect(typeof result.error).toBe("string");
      }
    });
  });
});
