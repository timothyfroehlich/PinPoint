// Tests for tRPC pinballMapRouter (see Task 10 test plan)
import { type PrismaClient } from "@prisma/client";
import { type Session } from "next-auth";

import { appRouter } from "~/server/api/root";
import { createCallerFactory } from "~/server/api/trpc";
import { db } from "~/server/db";
import { PinballMapService } from "~/server/services/pinballmapService";

// Mock NextAuth to prevent initialization issues
jest.mock("../../../../server/auth", () => ({
  auth: jest.fn(),
}));

// Mock the database
jest.mock("../../../../server/db", () => ({
  db: {},
}));

describe("pinballMapRouter", () => {
  const createCaller = createCallerFactory(appRouter);
  const mockPrisma = db as unknown as PrismaClient;

  const mockAdminSession: Session = {
    user: {
      id: "admin-1",
      name: "Admin User",
      email: "admin@test.com",
      role: "admin",
      organizationId: "org-123",
    },
    expires: new Date(Date.now() + 86400000).toISOString(), // 24 hours from now
  };

  const mockOrganization = {
    id: "org-123",
    name: "Test Organization",
    createdAt: new Date(),
    updatedAt: new Date(),
    subdomain: "test-org",
    logoUrl: null,
  };

  const mockHeaders = new Headers({
    host: "test-org.localhost:3000",
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Authentication", () => {
    it("should require organizationManageProcedure for all endpoints", async () => {
      const caller = createCaller({
        db: mockPrisma,
        session: null,
        organization: mockOrganization, // Organization is still needed for subdomain context
        headers: mockHeaders,
      });
      await expect(caller.pinballMap.enableIntegration()).rejects.toThrow(
        "UNAUTHORIZED",
      );
      await expect(caller.pinballMap.getSyncStatus()).rejects.toThrow(
        "UNAUTHORIZED",
      );
    });
    it("should allow organization admin access", async () => {
      const caller = createCaller({
        db: mockPrisma,
        session: mockAdminSession,
        organization: mockOrganization,
        headers: mockHeaders,
      });
      jest
        .spyOn(PinballMapService.prototype, "getOrganizationSyncStatus")
        .mockResolvedValue({ configEnabled: true, locations: [] });
      await expect(caller.pinballMap.getSyncStatus()).resolves.toBeDefined();
    });
  });

  describe("enableIntegration", () => {
    it("should call PinballMapService.enableIntegration", async () => {
      const mockService = jest
        .spyOn(PinballMapService.prototype, "enableIntegration")
        .mockResolvedValue(undefined);
      const caller = createCaller({
        db: mockPrisma,
        session: mockAdminSession,
        organization: mockOrganization,
        headers: mockHeaders,
      });
      const result = await caller.pinballMap.enableIntegration();
      expect(mockService).toHaveBeenCalledWith(mockOrganization.id);
      expect(result).toEqual({ success: true });
    });
  });

  describe("syncLocation", () => {
    it("should propagate service success results", async () => {
      const mockSyncResult = {
        success: true,
        added: 5,
        updated: 2,
        removed: 1,
      };
      jest
        .spyOn(PinballMapService.prototype, "syncLocation")
        .mockResolvedValue(mockSyncResult);
      const caller = createCaller({
        db: mockPrisma,
        session: mockAdminSession,
        organization: mockOrganization,
        headers: mockHeaders,
      });
      const result = await caller.pinballMap.syncLocation({
        locationId: "loc-123",
      });
      expect(result).toEqual(mockSyncResult);
    });
    it("should convert service failures to TRPCError", async () => {
      const mockSyncResult = {
        success: false,
        added: 0,
        updated: 0,
        removed: 0,
        error: "PinballMap API error: 500",
      };
      jest
        .spyOn(PinballMapService.prototype, "syncLocation")
        .mockResolvedValue(mockSyncResult);
      const caller = createCaller({
        db: mockPrisma,
        session: mockAdminSession,
        organization: mockOrganization,
        headers: mockHeaders,
      });
      await expect(
        caller.pinballMap.syncLocation({ locationId: "loc-123" }),
      ).rejects.toThrow("PinballMap API error: 500");
    });
  });

  describe("configureLocation", () => {
    it("should call PinballMapService.configureLocationSync", async () => {
      const mockService = jest
        .spyOn(PinballMapService.prototype, "configureLocationSync")
        .mockResolvedValue(undefined);
      const caller = createCaller({
        db: mockPrisma,
        session: mockAdminSession,
        organization: mockOrganization,
        headers: mockHeaders,
      });
      const input = { locationId: "loc-123", pinballMapId: 26454 };
      const result = await caller.pinballMap.configureLocation(input);
      expect(mockService).toHaveBeenCalledWith(
        input.locationId,
        input.pinballMapId,
        mockOrganization.id,
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe("getSyncStatus", () => {
    it("should call PinballMapService.getOrganizationSyncStatus and return result", async () => {
      const mockStatus = {
        configEnabled: true,
        locations: [
          {
            id: "loc-1",
            name: "Test",
            pinballMapId: 123,
            syncEnabled: true,
            lastSyncAt: null,
            machineCount: 2,
          },
        ],
      };
      jest
        .spyOn(PinballMapService.prototype, "getOrganizationSyncStatus")
        .mockResolvedValue(mockStatus);
      const caller = createCaller({
        db: mockPrisma,
        session: mockAdminSession,
        organization: mockOrganization,
        headers: mockHeaders,
      });
      const result = await caller.pinballMap.getSyncStatus();
      expect(result).toEqual(mockStatus);
    });
  });

  describe("End-to-End Workflow", () => {
    it("should complete full setup and sync workflow", async () => {
      // Step 1: Enable integration
      const enableSpy = jest
        .spyOn(PinballMapService.prototype, "enableIntegration")
        .mockResolvedValue(undefined);
      const configureSpy = jest
        .spyOn(PinballMapService.prototype, "configureLocationSync")
        .mockResolvedValue(undefined);
      const syncSpy = jest
        .spyOn(PinballMapService.prototype, "syncLocation")
        .mockResolvedValue({ success: true, added: 3, updated: 1, removed: 0 });
      const statusSpy = jest
        .spyOn(PinballMapService.prototype, "getOrganizationSyncStatus")
        .mockResolvedValue({
          configEnabled: true,
          locations: [
            {
              id: "loc-123",
              name: "Test Loc",
              pinballMapId: 26454,
              syncEnabled: true,
              lastSyncAt: new Date(),
              machineCount: 3,
            },
          ],
        });

      const caller = createCaller({
        db: mockPrisma,
        session: mockAdminSession,
        organization: mockOrganization,
        headers: mockHeaders,
      });

      // Enable integration
      await expect(caller.pinballMap.enableIntegration()).resolves.toEqual({
        success: true,
      });
      expect(enableSpy).toHaveBeenCalled();

      // Configure location
      await expect(
        caller.pinballMap.configureLocation({
          locationId: "loc-123",
          pinballMapId: 26454,
        }),
      ).resolves.toEqual({ success: true });
      expect(configureSpy).toHaveBeenCalled();

      // Sync location
      await expect(
        caller.pinballMap.syncLocation({ locationId: "loc-123" }),
      ).resolves.toEqual({ success: true, added: 3, updated: 1, removed: 0 });
      expect(syncSpy).toHaveBeenCalled();

      // Get status
      const status = await caller.pinballMap.getSyncStatus();
      expect(status.configEnabled).toBe(true);
      expect(status.locations).toHaveLength(1);
      expect(status.locations[0]?.machineCount).toBe(3);
      expect(statusSpy).toHaveBeenCalled();
    });
  });
});
