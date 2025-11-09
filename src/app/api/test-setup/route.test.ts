/**
 * Test Setup API - Security Tests
 *
 * Critical tests for organization allowlist validation.
 * Ensures test-setup API only accepts test organization IDs.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

// Mock env before importing route
vi.mock("~/env.js", () => ({
  env: {
    NODE_ENV: "test",
    CI: "false",
  },
}));

// Mock test-setup service
vi.mock("~/lib/test-support/test-setup-service", () => ({
  enableAnonymousReportingMutation: vi.fn(),
  ensureQrCodeMutation: vi.fn(),
  findIssueByTitle: vi.fn(),
  captureStateSnapshot: vi.fn(),
  restoreStateMutation: vi.fn(),
}));

describe("Test Setup API - Organization Allowlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("enableAnonymousReporting", () => {
    it("should accept test-org-pinpoint", async () => {
      const { POST } = await import("./route");
      const { enableAnonymousReportingMutation } = await import(
        "~/lib/test-support/test-setup-service"
      );

      const request = new Request("http://localhost/api/test-setup", {
        method: "POST",
        body: JSON.stringify({
          action: "enableAnonymousReporting",
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          machineId: "test-machine",
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(enableAnonymousReportingMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          machineId: "test-machine",
        }),
      );
    });

    it("should accept test-org-competitor", async () => {
      const { POST } = await import("./route");
      const { enableAnonymousReportingMutation } = await import(
        "~/lib/test-support/test-setup-service"
      );

      const request = new Request("http://localhost/api/test-setup", {
        method: "POST",
        body: JSON.stringify({
          action: "enableAnonymousReporting",
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
          machineId: "test-machine",
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(enableAnonymousReportingMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
        }),
      );
    });

    it("should reject non-test organization", async () => {
      const { POST } = await import("./route");
      const { enableAnonymousReportingMutation } = await import(
        "~/lib/test-support/test-setup-service"
      );

      const request = new Request("http://localhost/api/test-setup", {
        method: "POST",
        body: JSON.stringify({
          action: "enableAnonymousReporting",
          organizationId: "real-production-org",
          machineId: "test-machine",
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body.error).toContain(
        "only allows operations on test organizations",
      );
      expect(body.error).toContain("real-production-org");
      expect(enableAnonymousReportingMutation).not.toHaveBeenCalled();
    });

    it("should include allowed org IDs in error message", async () => {
      const { POST } = await import("./route");

      const request = new Request("http://localhost/api/test-setup", {
        method: "POST",
        body: JSON.stringify({
          action: "enableAnonymousReporting",
          organizationId: "production-org-123",
          machineId: "test-machine",
        }),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(body.error).toContain(SEED_TEST_IDS.ORGANIZATIONS.primary);
      expect(body.error).toContain(SEED_TEST_IDS.ORGANIZATIONS.competitor);
    });
  });

  describe("captureState", () => {
    it("should accept test organization", async () => {
      const { POST } = await import("./route");
      const { captureStateSnapshot } = await import(
        "~/lib/test-support/test-setup-service"
      );
      vi.mocked(captureStateSnapshot).mockResolvedValue({
        anonymousReporting: false,
        defaultStatusId: null,
        defaultPriorityId: null,
      });

      const request = new Request("http://localhost/api/test-setup", {
        method: "POST",
        body: JSON.stringify({
          action: "captureState",
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          machineId: "test-machine",
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(captureStateSnapshot).toHaveBeenCalled();
    });

    it("should reject non-test organization", async () => {
      const { POST } = await import("./route");
      const { captureStateSnapshot } = await import(
        "~/lib/test-support/test-setup-service"
      );

      const request = new Request("http://localhost/api/test-setup", {
        method: "POST",
        body: JSON.stringify({
          action: "captureState",
          organizationId: "production-org",
          machineId: "test-machine",
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(500);
      expect(captureStateSnapshot).not.toHaveBeenCalled();
    });
  });

  describe("restoreState", () => {
    it("should accept test organization", async () => {
      const { POST } = await import("./route");
      const { restoreStateMutation } = await import(
        "~/lib/test-support/test-setup-service"
      );

      const request = new Request("http://localhost/api/test-setup", {
        method: "POST",
        body: JSON.stringify({
          action: "restoreState",
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          machineId: "test-machine",
          state: {
            anonymousReporting: true,
            defaultStatusId: "status-1",
            defaultPriorityId: "priority-1",
          },
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(restoreStateMutation).toHaveBeenCalled();
    });

    it("should reject non-test organization", async () => {
      const { POST } = await import("./route");
      const { restoreStateMutation } = await import(
        "~/lib/test-support/test-setup-service"
      );

      const request = new Request("http://localhost/api/test-setup", {
        method: "POST",
        body: JSON.stringify({
          action: "restoreState",
          organizationId: "production-org",
          machineId: "test-machine",
          state: {},
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(500);
      expect(restoreStateMutation).not.toHaveBeenCalled();
    });
  });

  describe("findIssue (no org validation required)", () => {
    it("should execute without org validation", async () => {
      const { POST } = await import("./route");
      const { findIssueByTitle } = await import(
        "~/lib/test-support/test-setup-service"
      );
      vi.mocked(findIssueByTitle).mockResolvedValue("issue-123");

      const request = new Request("http://localhost/api/test-setup", {
        method: "POST",
        body: JSON.stringify({
          action: "findIssue",
          title: "Test Issue",
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(findIssueByTitle).toHaveBeenCalledWith("Test Issue");
    });
  });

  describe("ensureQRCode (no org validation required)", () => {
    it("should execute without org validation", async () => {
      const { POST } = await import("./route");
      const { ensureQrCodeMutation } = await import(
        "~/lib/test-support/test-setup-service"
      );
      vi.mocked(ensureQrCodeMutation).mockResolvedValue("qr-123");

      const request = new Request("http://localhost/api/test-setup", {
        method: "POST",
        body: JSON.stringify({
          action: "ensureQRCode",
          machineId: "test-machine",
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(ensureQrCodeMutation).toHaveBeenCalledWith("test-machine");
    });
  });
});
