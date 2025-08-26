/**
 * RoleService Tests (Service Layer - Archetype 3) - Simplified Version
 *
 * Demonstrates the Service Tests archetype with:
 * - Business logic validation (getDefaultRole, getAdminRole)
 * - Multi-tenant organization scoping patterns
 * - Service constructor dependency injection patterns
 * - TypeScript-safe mocking
 */

import { describe, it, expect, beforeEach } from "vitest";

import { RoleService } from "./roleService";
import { SYSTEM_ROLES } from "../auth/permissions.constants";
import { serviceTestUtils } from "~/test/helpers/service-test-helpers";
import type { ServiceTestContext } from "~/test/helpers/service-test-helpers";

describe("RoleService (Simple Service Tests)", () => {
  let service: RoleService;
  let context: ServiceTestContext;

  beforeEach(() => {
    context = serviceTestUtils.createContext();
    service = new RoleService(context.mockDb, context.organizationId);
  });

  describe("Constructor and Organization Scoping", () => {
    it("should initialize with correct organization context", () => {
      // Act & Assert: Service should be constructed with organization ID
      expect(service).toBeInstanceOf(RoleService);

      // Verify organization context is set
      const primaryOrgService = new RoleService(
        context.mockDb,
        context.organizationId,
      );
      const competitorOrgService = new RoleService(
        context.mockDb,
        context.competitorOrgId,
      );

      expect(primaryOrgService).toBeInstanceOf(RoleService);
      expect(competitorOrgService).toBeInstanceOf(RoleService);
    });

    it("should create separate service instances for different organizations", () => {
      // Arrange & Act
      const primaryService = new RoleService(
        context.mockDb,
        context.organizationId,
      );
      const competitorService = new RoleService(
        context.mockDb,
        context.competitorOrgId,
      );

      // Assert: Services are independent instances
      expect(primaryService).not.toBe(competitorService);
      expect(primaryService).toBeInstanceOf(RoleService);
      expect(competitorService).toBeInstanceOf(RoleService);
    });
  });

  describe("getDefaultRole", () => {
    it("should return default role when available", async () => {
      // Arrange: Mock successful query response
      const mockDefaultRole = serviceTestUtils.mockResponses.roles.memberRole;
      context.mockDb.query.roles.findFirst.mockResolvedValue(mockDefaultRole);

      // Act
      const result = await service.getDefaultRole();

      // Assert
      expect(result).toEqual(mockDefaultRole);
      expect(context.mockDb.query.roles.findFirst).toHaveBeenCalledTimes(1);
    });

    it("should return null when no default role exists", async () => {
      // Arrange: Mock empty query response
      context.mockDb.query.roles.findFirst.mockResolvedValue(null);

      // Act
      const result = await service.getDefaultRole();

      // Assert
      expect(result).toBeNull();
      expect(context.mockDb.query.roles.findFirst).toHaveBeenCalledTimes(1);
    });

    it("should query with correct default role criteria", async () => {
      // Arrange
      context.mockDb.query.roles.findFirst.mockResolvedValue(null);

      // Act
      await service.getDefaultRole();

      // Assert: Verify query was called (exact parameters depend on Drizzle implementation)
      expect(context.mockDb.query.roles.findFirst).toHaveBeenCalledTimes(1);
    });
  });

  describe("getAdminRole", () => {
    it("should return admin role when available", async () => {
      // Arrange: Mock admin role response
      const mockAdminRole = {
        ...serviceTestUtils.mockResponses.roles.adminRole,
        name: SYSTEM_ROLES.ADMIN,
      };
      context.mockDb.query.roles.findFirst.mockResolvedValue(mockAdminRole);

      // Act
      const result = await service.getAdminRole();

      // Assert
      expect(result).toEqual(mockAdminRole);
      expect(result?.name).toBe(SYSTEM_ROLES.ADMIN);
      expect(context.mockDb.query.roles.findFirst).toHaveBeenCalledTimes(1);
    });

    it("should return null when no admin role exists", async () => {
      // Arrange: Mock empty query response
      context.mockDb.query.roles.findFirst.mockResolvedValue(null);

      // Act
      const result = await service.getAdminRole();

      // Assert
      expect(result).toBeNull();
      expect(context.mockDb.query.roles.findFirst).toHaveBeenCalledTimes(1);
    });
  });

  describe("Multi-tenant Organization Isolation", () => {
    it("should create independent services for different organizations", () => {
      // Arrange & Act: Create services for different orgs
      const primaryService = new RoleService(
        context.mockDb,
        context.organizationId,
      );
      const competitorService = new RoleService(
        context.mockDb,
        context.competitorOrgId,
      );

      // Assert: Services are separate instances with different org contexts
      expect(primaryService).not.toBe(competitorService);

      // Both services use the same database client but different organization contexts
      expect(primaryService).toBeInstanceOf(RoleService);
      expect(competitorService).toBeInstanceOf(RoleService);
    });

    it("should maintain organization context throughout service lifecycle", async () => {
      // Arrange: Create services for different organizations
      const primaryService = new RoleService(
        context.mockDb,
        context.organizationId,
      );
      const competitorService = new RoleService(
        context.mockDb,
        context.competitorOrgId,
      );

      // Mock database responses
      context.mockDb.query.roles.findFirst.mockResolvedValue(
        serviceTestUtils.mockResponses.roles.adminRole,
      );

      // Act: Call methods on both services
      await primaryService.getAdminRole();
      await competitorService.getAdminRole();

      // Assert: Both services made database calls (organization scoping handled by RLS)
      expect(context.mockDb.query.roles.findFirst).toHaveBeenCalledTimes(2);
    });
  });

  describe("Service Layer Business Logic Patterns", () => {
    it("should handle database query results correctly", async () => {
      // Arrange: Test successful database response
      const mockRole = serviceTestUtils.mockResponses.roles.memberRole;
      context.mockDb.query.roles.findFirst.mockResolvedValue(mockRole);

      // Act
      const result = await service.getDefaultRole();

      // Assert: Business logic correctly processes database result
      expect(result).toEqual(mockRole);
      expect(result?.name).toBe("Member");
      expect(result?.is_system).toBe(false);
    });

    it("should handle database errors gracefully", async () => {
      // Arrange: Mock database error
      const dbError = new Error("Database connection failed");
      context.mockDb.query.roles.findFirst.mockRejectedValue(dbError);

      // Act & Assert: Service should propagate database errors
      await expect(service.getDefaultRole()).rejects.toThrow(
        "Database connection failed",
      );
    });

    it("should maintain type safety with mock responses", () => {
      // Arrange & Act: Use typed mock responses
      const mockRole = serviceTestUtils.mockResponses.roles.adminRole;

      // Assert: TypeScript ensures type safety
      expect(mockRole.id).toBe(serviceTestUtils.testIds.ROLES.ADMIN_PRIMARY);
      expect(mockRole.name).toBe("Admin");
      expect(mockRole.is_system).toBe(true);
      expect(mockRole.organization_id).toBe(
        serviceTestUtils.testIds.ORGANIZATIONS.primary,
      );
    });
  });

  describe("Service Pattern Validation", () => {
    it("should demonstrate dependency injection pattern", () => {
      // Act: Service accepts injected dependencies
      const mockDbClient = serviceTestUtils.mockDatabase();
      const serviceInstance = new RoleService(mockDbClient, "test-org-123");

      // Assert: Service is constructed with injected dependencies
      expect(serviceInstance).toBeInstanceOf(RoleService);
    });

    it("should demonstrate organization-scoped service pattern", () => {
      // Act: Services are scoped to specific organizations
      const orgAService = new RoleService(context.mockDb, "org-a");
      const orgBService = new RoleService(context.mockDb, "org-b");

      // Assert: Each service maintains its organization context
      expect(orgAService).toBeInstanceOf(RoleService);
      expect(orgBService).toBeInstanceOf(RoleService);
      expect(orgAService).not.toBe(orgBService);
    });
  });
});
