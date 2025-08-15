/**
 * Collection Router Tests (Unit)
 *
 * Unit tests for the collection router using Vitest mock context.
 * Tests router-level concerns: tRPC procedures, permissions, input validation,
 * and context passing to CollectionService.
 *
 * Key Features:
 * - Tests tRPC procedure calls (not service methods directly)
 * - Permission-based access control validation
 * - Input validation testing
 * - Context and service integration testing
 * - Error condition testing
 *
 * Covers all procedures:
 * - getForLocation: Public access to location collections
 * - getMachines: Public access to collection machines
 * - createManual: Protected manual collection creation
 * - addMachines: Protected machine assignment to collections
 * - generateAuto: Admin-only auto-collection generation
 * - getTypes: Organization collection types access
 * - toggleType: Admin-only collection type toggling
 */

import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock NextAuth first to avoid import issues
vi.mock("next-auth", () => ({
  default: vi.fn().mockImplementation(() => ({
    auth: vi.fn(),
    handlers: { GET: vi.fn(), POST: vi.fn() },
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}));

// Mock permissions system
vi.mock("~/server/auth/permissions", async () => {
  const actual = await vi.importActual("~/server/auth/permissions");
  return {
    ...actual,
    getUserPermissionsForSession: vi.fn(),
    requirePermissionForSession: vi.fn(),
  };
});

// Import test setup and utilities
import { appRouter } from "~/server/api/root";
import {
  getUserPermissionsForSession,
  requirePermissionForSession,
} from "~/server/auth/permissions";
import {
  createVitestMockContext,
  type VitestMockContext,
} from "~/test/vitestMockContext";

// Helper to create authenticated context with permissions
const createAuthenticatedContext = (permissions: string[] = []) => {
  const mockContext = createVitestMockContext();

  // Override the user with proper test data
  (mockContext as any).user = {
    id: "user-1",
    email: "test@example.com",
    user_metadata: {
      name: "Test User",
      avatar_url: null,
    },
    app_metadata: {
      organization_id: "org-1",
      role: "Member",
    },
  };

  (mockContext as any).organization = {
    id: "org-1",
    name: "Test Organization",
    subdomain: "test",
  };

  const membershipData = {
    id: "membership-1",
    userId: "user-1",
    organizationId: "org-1",
    roleId: "role-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    role: {
      id: "role-1",
      name: "Test Role",
      organizationId: "org-1",
      isSystem: false,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      rolePermissions: permissions.map((name, index) => ({
        permission: {
          id: `perm-${(index + 1).toString()}`,
          name,
          description: `${name} permission`,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })),
    },
  };

  // Mock the database query for membership lookup using Drizzle query API
  vi.mocked(mockContext.db.query.memberships.findFirst).mockResolvedValue(
    membershipData as any,
  );

  // Mock the permissions system
  vi.mocked(getUserPermissionsForSession).mockResolvedValue(permissions);

  // Mock requirePermissionForSession - it should throw when permission is missing
  vi.mocked(requirePermissionForSession).mockImplementation(
    (_session, permission, _db, _orgId) => {
      if (!permissions.includes(permission)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Missing required permission: ${permission}`,
        });
      }
      return Promise.resolve();
    },
  );

  return {
    ...mockContext,
    // Add the user property that tRPC middleware expects
    user: {
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
      image: null,
    },
    membership: membershipData,
    userPermissions: permissions,
  } as any;
};

describe("Collection Router", () => {
  let ctx: VitestMockContext;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = createVitestMockContext();
  });

  describe("Public Procedures", () => {
    beforeEach(() => {
      // Public procedures don't need authentication
      ctx.user = null;
      ctx.organization = null;
    });

    describe("getForLocation", () => {
      it("should get collections for location without authentication", async () => {
        const mockCollections = {
          manual: [
            {
              id: "coll-1",
              name: "Front Room",
              type: { id: "type-1", name: "Rooms", displayName: "Rooms" },
              _count: { machines: 5 },
            },
          ],
          auto: [],
        };

        // Mock the service method
        const mockGetLocationCollections = vi
          .fn()
          .mockResolvedValue(mockCollections);

        const createCollectionServiceFn = ctx.services.createCollectionService;
        const mockCreateCollectionServiceFn = vi.mocked(
          createCollectionServiceFn,
        );
        mockCreateCollectionServiceFn.mockReturnValue({
          getLocationCollections: mockGetLocationCollections,
        } as any);

        const caller = appRouter.createCaller(ctx as any);
        const result = await caller.collection.getForLocation({
          locationId: "location-1",
          organizationId: "org-1",
        });

        expect(result).toEqual(mockCollections);
        expect(mockGetLocationCollections).toHaveBeenCalledWith(
          "location-1",
          "org-1",
        );
        expect(mockCreateCollectionServiceFn).toHaveBeenCalled();
      });

      it("should validate input parameters", async () => {
        const caller = appRouter.createCaller(ctx as any);

        // Test empty locationId
        await expect(
          caller.collection.getForLocation({
            locationId: "",
            organizationId: "org-1",
          }),
        ).rejects.toThrow();

        // Test empty organizationId
        await expect(
          caller.collection.getForLocation({
            locationId: "location-1",
            organizationId: "",
          }),
        ).rejects.toThrow();
      });
    });

    describe("getMachines", () => {
      it("should get machines in collection without authentication", async () => {
        const mockMachines = [
          {
            id: "machine-1",
            name: "Medieval Madness",
            model: { name: "Medieval Madness", manufacturer: "Williams" },
          },
          {
            id: "machine-2",
            name: "Attack from Mars",
            model: { name: "Attack from Mars", manufacturer: "Bally" },
          },
        ];

        // Mock the service method
        const mockGetCollectionMachines = vi
          .fn()
          .mockResolvedValue(mockMachines);

        const createCollectionServiceFn = ctx.services.createCollectionService;
        const mockCreateCollectionServiceFn = vi.mocked(
          createCollectionServiceFn,
        );
        mockCreateCollectionServiceFn.mockReturnValue({
          getCollectionMachines: mockGetCollectionMachines,
        } as any);

        const caller = appRouter.createCaller(ctx as any);
        const result = await caller.collection.getMachines({
          collectionId: "collection-1",
          locationId: "location-1",
        });

        expect(result).toEqual(mockMachines);
        expect(mockGetCollectionMachines).toHaveBeenCalledWith(
          "collection-1",
          "location-1",
        );
      });
    });
  });

  describe("Protected Procedures", () => {
    describe("createManual", () => {
      it("should create manual collection with proper permissions", async () => {
        const authCtx = createAuthenticatedContext(["location:edit"]);
        const mockCollection = {
          id: "collection-1",
          name: "Test Collection",
          typeId: "type-1",
          locationId: "location-1",
          isManual: true,
        };

        // Mock the service method
        const mockCreateManualCollection = vi
          .fn()
          .mockResolvedValue(mockCollection);

        const createCollectionServiceFn =
          authCtx.services.createCollectionService;
        const mockCreateCollectionServiceFn = vi.mocked(
          createCollectionServiceFn,
        );
        mockCreateCollectionServiceFn.mockReturnValue({
          createManualCollection: mockCreateManualCollection,
        } as any);

        const caller = appRouter.createCaller(authCtx as any);
        const result = await caller.collection.createManual({
          name: "Test Collection",
          typeId: "type-1",
          locationId: "location-1",
          description: "Test description",
        });

        expect(result).toEqual(mockCollection);
        expect(mockCreateManualCollection).toHaveBeenCalledWith("org-1", {
          name: "Test Collection",
          typeId: "type-1",
          locationId: "location-1",
          description: "Test description",
        });
      });

      it("should validate input parameters", async () => {
        const authCtx = createAuthenticatedContext(["location:edit"]);
        const caller = appRouter.createCaller(authCtx as any);

        // Test name too short
        await expect(
          caller.collection.createManual({
            name: "",
            typeId: "type-1",
          }),
        ).rejects.toThrow();

        // Test name too long
        await expect(
          caller.collection.createManual({
            name: "a".repeat(51),
            typeId: "type-1",
          }),
        ).rejects.toThrow();

        // Test missing typeId
        await expect(
          caller.collection.createManual({
            name: "Test Collection",
            typeId: "",
          }),
        ).rejects.toThrow();
      });

      it("should require authentication", async () => {
        const caller = appRouter.createCaller({ ...ctx, user: null } as any);

        await expect(
          caller.collection.createManual({
            name: "Test Collection",
            typeId: "type-1",
          }),
        ).rejects.toThrow("UNAUTHORIZED");
      });
    });

    describe("addMachines", () => {
      it("should add machines to collection", async () => {
        const authCtx = createAuthenticatedContext(["location:edit"]);
        // Mock the service method
        const mockAddMachinesToCollection = vi
          .fn()
          .mockResolvedValue(undefined);

        const createCollectionServiceFn =
          authCtx.services.createCollectionService;
        const mockCreateCollectionServiceFn = vi.mocked(
          createCollectionServiceFn,
        );
        mockCreateCollectionServiceFn.mockReturnValue({
          addMachinesToCollection: mockAddMachinesToCollection,
        } as any);

        const caller = appRouter.createCaller(authCtx as any);
        const result = await caller.collection.addMachines({
          collectionId: "collection-1",
          machineIds: ["machine-1", "machine-2"],
        });

        expect(result).toEqual({ success: true });
        expect(mockAddMachinesToCollection).toHaveBeenCalledWith(
          "collection-1",
          ["machine-1", "machine-2"],
        );
      });

      it("should validate machine IDs array", async () => {
        const authCtx = createAuthenticatedContext(["location:edit"]);

        // Mock the service method for the successful case
        const mockAddMachinesToCollection = vi
          .fn()
          .mockResolvedValue(undefined);

        const createCollectionServiceFn =
          authCtx.services.createCollectionService;
        const mockCreateCollectionServiceFn = vi.mocked(
          createCollectionServiceFn,
        );
        mockCreateCollectionServiceFn.mockReturnValue({
          addMachinesToCollection: mockAddMachinesToCollection,
        } as any);

        const caller = appRouter.createCaller(authCtx as any);

        // Test empty array
        await expect(
          caller.collection.addMachines({
            collectionId: "collection-1",
            machineIds: [],
          }),
        ).resolves.toBeTruthy(); // Should be allowed

        // Test that it accepts empty collection ID (current schema allows this)
        await expect(
          caller.collection.addMachines({
            collectionId: "",
            machineIds: ["machine-1"],
          }),
        ).resolves.toBeTruthy();
      });
    });

    describe("getTypes", () => {
      it("should get organization collection types", async () => {
        const authCtx = createAuthenticatedContext(); // No specific permission needed, just authentication
        const mockTypes = [
          {
            id: "type-1",
            name: "Rooms",
            displayName: "Rooms",
            isEnabled: true,
            collectionCount: 3,
          },
          {
            id: "type-2",
            name: "Manufacturer",
            displayName: "Manufacturer",
            isEnabled: false,
            collectionCount: 0,
          },
        ];

        // Mock the service method
        const mockGetOrganizationCollectionTypes = vi
          .fn()
          .mockResolvedValue(mockTypes);

        const createCollectionServiceFn =
          authCtx.services.createCollectionService;
        const mockCreateCollectionServiceFn = vi.mocked(
          createCollectionServiceFn,
        );
        mockCreateCollectionServiceFn.mockReturnValue({
          getOrganizationCollectionTypes: mockGetOrganizationCollectionTypes,
        } as any);

        const caller = appRouter.createCaller(authCtx as any);
        const result = await caller.collection.getTypes();

        expect(result).toEqual(mockTypes);
        expect(mockGetOrganizationCollectionTypes).toHaveBeenCalledWith(
          "org-1",
        );
      });
    });
  });

  describe("Admin Procedures", () => {
    describe("generateAuto", () => {
      it("should generate auto-collections for organization", async () => {
        const adminCtx = createAuthenticatedContext(["organization:manage"]);
        const mockGeneratedCollections = [
          {
            id: "auto-coll-1",
            name: "Williams",
            type: "manufacturer",
            isManual: false,
          },
        ];

        // Mock the service method
        const mockGenerateAutoCollections = vi
          .fn()
          .mockResolvedValue(mockGeneratedCollections);

        const createCollectionServiceFn =
          adminCtx.services.createCollectionService;
        const mockCreateCollectionServiceFn = vi.mocked(
          createCollectionServiceFn,
        );
        mockCreateCollectionServiceFn.mockReturnValue({
          generateAutoCollections: mockGenerateAutoCollections,
        } as any);

        const caller = appRouter.createCaller(adminCtx as any);
        const result = await caller.collection.generateAuto();

        expect(result).toEqual(mockGeneratedCollections);
        expect(mockGenerateAutoCollections).toHaveBeenCalledWith("org-1");
      });

      it("should require admin permissions", async () => {
        // Create context without admin permissions
        const memberCtx = createAuthenticatedContext(["location:edit"]);
        const caller = appRouter.createCaller(memberCtx as any);

        await expect(caller.collection.generateAuto()).rejects.toThrow(
          "Missing required permission: organization:manage",
        );
      });
    });

    describe("toggleType", () => {
      it("should toggle collection type enabled status", async () => {
        const adminCtx = createAuthenticatedContext(["organization:manage"]);
        // Mock the service method
        const mockToggleCollectionType = vi.fn().mockResolvedValue(undefined);

        const createCollectionServiceFn =
          adminCtx.services.createCollectionService;
        const mockCreateCollectionServiceFn = vi.mocked(
          createCollectionServiceFn,
        );
        mockCreateCollectionServiceFn.mockReturnValue({
          toggleCollectionType: mockToggleCollectionType,
        } as any);

        const caller = appRouter.createCaller(adminCtx as any);
        const result = await caller.collection.toggleType({
          collectionTypeId: "type-1",
          enabled: false,
        });

        expect(result).toEqual({ success: true });
        expect(mockToggleCollectionType).toHaveBeenCalledWith("type-1", false);
      });

      it("should validate boolean enabled parameter", async () => {
        const adminCtx = createAuthenticatedContext(["organization:manage"]);

        // Mock the service method
        const mockToggleCollectionType = vi.fn().mockResolvedValue(undefined);

        const createCollectionServiceFn =
          adminCtx.services.createCollectionService;
        const mockCreateCollectionServiceFn = vi.mocked(
          createCollectionServiceFn,
        );
        mockCreateCollectionServiceFn.mockReturnValue({
          toggleCollectionType: mockToggleCollectionType,
        } as any);

        const caller = appRouter.createCaller(adminCtx as any);

        // Should work with boolean values
        await expect(
          caller.collection.toggleType({
            collectionTypeId: "type-1",
            enabled: true,
          }),
        ).resolves.toBeTruthy();

        await expect(
          caller.collection.toggleType({
            collectionTypeId: "type-1",
            enabled: false,
          }),
        ).resolves.toBeTruthy();
      });

      it("should require admin permissions", async () => {
        // Create context without admin permissions
        const memberCtx = createAuthenticatedContext(["location:edit"]);
        const caller = appRouter.createCaller(memberCtx as any);

        await expect(
          caller.collection.toggleType({
            collectionTypeId: "type-1",
            enabled: false,
          }),
        ).rejects.toThrow("Missing required permission: organization:manage");
      });
    });
  });

  describe("Authentication and Context", () => {
    it("should require authentication for protected procedures", async () => {
      const caller = appRouter.createCaller({ ...ctx, user: null } as any);

      // Test procedures that require authentication
      await expect(
        caller.collection.createManual({
          name: "Test",
          typeId: "type-1",
        }),
      ).rejects.toThrow("UNAUTHORIZED");

      await expect(
        caller.collection.addMachines({
          collectionId: "coll-1",
          machineIds: ["machine-1"],
        }),
      ).rejects.toThrow("UNAUTHORIZED");

      await expect(caller.collection.getTypes()).rejects.toThrow(
        "UNAUTHORIZED",
      );

      await expect(caller.collection.generateAuto()).rejects.toThrow(
        "UNAUTHORIZED",
      );

      await expect(
        caller.collection.toggleType({
          collectionTypeId: "type-1",
          enabled: false,
        }),
      ).rejects.toThrow("UNAUTHORIZED");
    });

    it("should require organization context for organization procedures", async () => {
      const caller = appRouter.createCaller({
        ...ctx,
        organization: null,
      } as any);

      // Test procedures that require organization context
      await expect(
        caller.collection.createManual({
          name: "Test",
          typeId: "type-1",
        }),
      ).rejects.toThrow();

      await expect(caller.collection.getTypes()).rejects.toThrow();
    });

    it("should create service with proper context", async () => {
      const authCtx = createAuthenticatedContext();

      const mockService = {
        getOrganizationCollectionTypes: vi.fn().mockResolvedValue([]),
      };

      const createCollectionServiceFn =
        authCtx.services.createCollectionService;
      const mockCreateCollectionServiceFn = vi.mocked(
        createCollectionServiceFn,
      );
      mockCreateCollectionServiceFn.mockReturnValue(mockService as any);

      const caller = appRouter.createCaller(authCtx as any);
      await caller.collection.getTypes();

      // Verify service was created and called
      expect(mockCreateCollectionServiceFn).toHaveBeenCalled();
      expect(mockService.getOrganizationCollectionTypes).toHaveBeenCalledWith(
        "org-1",
      );
    });
  });
});
