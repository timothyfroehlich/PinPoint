/**
 * Integration tests for QR code generation during machine creation
 * Tests the automatic QR code generation when machines are created via the machine router
 */

import { TRPCError } from "@trpc/server";
import { type Session } from "next-auth";

import { appRouter } from "~/server/api/root";
import { createCallerFactory } from "~/server/api/trpc";
import { auth } from "~/server/auth";
import { QRCodeService } from "~/server/services/qrCodeService";

// Mock the QRCodeService
jest.mock("~/server/services/qrCodeService");
const MockedQRCodeService = QRCodeService as jest.MockedClass<
  typeof QRCodeService
>;

// Create properly typed mock functions
const mockOrganizationFindUnique = jest.fn<Promise<unknown>, [unknown]>();
const mockMembershipFindUnique = jest.fn<Promise<unknown>, [unknown]>();
const mockRoleFindUnique = jest.fn<Promise<unknown>, [unknown]>();
const mockPermissionFindFirst = jest.fn<Promise<unknown>, [unknown]>();
const mockModelFindFirst = jest.fn<Promise<unknown>, [unknown]>();
const mockRoomFindFirst = jest.fn<Promise<unknown>, [unknown]>();
const mockMachineCreate = jest.fn<Promise<unknown>, [unknown]>();

// Mock the database
jest.mock("~/server/db", () => ({
  db: {
    organization: {
      findUnique: mockOrganizationFindUnique,
    },
    membership: {
      findUnique: mockMembershipFindUnique,
    },
    role: {
      findUnique: mockRoleFindUnique,
    },
    permission: {
      findFirst: mockPermissionFindFirst,
    },
    model: {
      findFirst: mockModelFindFirst,
    },
    room: {
      findFirst: mockRoomFindFirst,
    },
    machine: {
      create: mockMachineCreate,
    },
  },
}));

// Mock NextAuth
jest.mock("~/server/auth", () => ({
  auth: jest.fn(),
}));

const mockAuth = auth as jest.Mock;

// Mock console.warn for QR code generation failures
const mockConsoleWarn = jest.spyOn(console, "warn").mockImplementation();

describe("Machine Creation QR Code Integration", () => {
  const createCaller = createCallerFactory(appRouter);
  let mockQRCodeService: jest.Mocked<QRCodeService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset the mock constructor
    MockedQRCodeService.mockClear();

    // Create a fresh mock instance for each test
    mockQRCodeService = {
      generateQRCode: jest.fn(),
      getQRCodeInfo: jest.fn(),
      regenerateQRCode: jest.fn(),
      generateQRCodesForOrganization: jest.fn(),
      resolveMachineFromQR: jest.fn(),
    } as any;

    MockedQRCodeService.mockImplementation(() => mockQRCodeService);
  });

  afterEach(() => {
    mockConsoleWarn.mockClear();
  });

  const mockOrganization = {
    id: "org-123",
    name: "Test Organization",
    subdomain: "test",
    logoUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRole = {
    id: "role-123",
    name: "Admin",
    organizationId: "org-123",
    isDefault: true,
    permissions: [{ id: "perm-1", name: "machine:edit" }],
  };

  const mockMembership = {
    id: "membership-123",
    roleId: "role-123",
    userId: "user-123",
    organizationId: "org-123",
    role: mockRole,
  };

  const mockPermission = {
    id: "permission-123",
    name: "machine:edit",
  };

  const mockSession: Session = {
    user: {
      id: "user-123",
      name: "Test User",
      email: "test@example.com",
    },
    expires: "2024-01-01",
  };

  const mockModel = {
    id: "model-123",
    name: "Test Machine Model",
    organizationId: "org-123",
  };

  const mockRoom = {
    id: "room-123",
    name: "Test Room",
    organizationId: "org-123",
  };

  const mockCreatedMachine = {
    id: "machine-456",
    name: "Test Machine",
    modelId: "model-123",
    locationId: "room-123",
    model: {
      ...mockModel,
      _count: { machines: 1 },
    },
    room: {
      ...mockRoom,
      location: { name: "Test Location" },
    },
    owner: null,
  };

  const mockQRCodeInfo = {
    qrCodeUrl: "/uploads/images/qr-machine-456.webp",
    reportUrl: "https://test.pinpoint.app/machines/machine-456/report-issue",
    machineInfo: {
      id: "machine-456",
      modelName: "Test Machine Model",
      locationName: "Test Room",
      organizationName: "Test Organization",
    },
  };

  describe("successful QR code generation during machine creation", () => {
    beforeEach(() => {
      // Setup successful auth and permissions
      mockAuth.mockResolvedValue(mockSession);
      mockOrganizationFindUnique.mockResolvedValue(mockOrganization);
      mockMembershipFindUnique.mockResolvedValue(mockMembership);
      mockRoleFindUnique.mockResolvedValue(mockRole);
      mockPermissionFindFirst.mockResolvedValue(mockPermission);

      // Setup successful model and room lookup
      mockModelFindFirst.mockResolvedValue(mockModel);
      mockRoomFindFirst.mockResolvedValue(mockRoom);

      // Setup successful machine creation
      mockMachineCreate.mockResolvedValue(mockCreatedMachine);
    });

    it("should generate QR code automatically when machine is created", async () => {
      // Arrange
      mockQRCodeService.generateQRCode.mockResolvedValue(mockQRCodeInfo);

      const caller = createCaller({
        session: mockSession,
        organization: mockOrganization,
      });

      // Act
      const result = await caller.machine.create({
        name: "Test Machine",
        modelId: "model-123",
        locationId: "room-123",
      });

      // Assert - Machine was created
      expect(mockMachineCreate).toHaveBeenCalledWith({
        data: {
          name: "Test Machine",
          modelId: "model-123",
          locationId: "room-123",
        },
        include: expect.any(Object),
      });

      // Assert - QR code service was instantiated and called
      expect(MockedQRCodeService).toHaveBeenCalledWith(expect.any(Object));
      expect(mockQRCodeService.generateQRCode).toHaveBeenCalledWith(
        "machine-456",
      );

      // Assert - Machine creation succeeded despite QR code generation
      expect(result).toEqual(mockCreatedMachine);

      // Assert - No warnings logged (successful QR generation)
      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });

    it("should continue machine creation even if QR code generation fails", async () => {
      // Arrange
      const qrError = new Error("QR code generation failed");
      mockQRCodeService.generateQRCode.mockRejectedValue(qrError);

      const caller = createCaller({
        session: mockSession,
        organization: mockOrganization,
      });

      // Act
      const result = await caller.machine.create({
        name: "Test Machine",
        modelId: "model-123",
        locationId: "room-123",
      });

      // Assert - Machine was still created successfully
      expect(result).toEqual(mockCreatedMachine);

      // Assert - QR code generation was attempted
      expect(mockQRCodeService.generateQRCode).toHaveBeenCalledWith(
        "machine-456",
      );

      // Assert - Warning was logged about QR code failure
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        "Failed to generate QR code for new machine:",
        qrError,
      );
    });

    it("should handle QR code service instantiation errors gracefully", async () => {
      // Arrange
      MockedQRCodeService.mockImplementation(() => {
        throw new Error("Service instantiation failed");
      });

      const caller = createCaller({
        session: mockSession,
        organization: mockOrganization,
      });

      // Act
      const result = await caller.machine.create({
        name: "Test Machine",
        modelId: "model-123",
        locationId: "room-123",
      });

      // Assert - Machine creation still succeeded
      expect(result).toEqual(mockCreatedMachine);

      // Assert - Warning was logged about the service error
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        "Failed to generate QR code for new machine:",
        expect.any(Error),
      );
    });
  });

  describe("QR code generation with different machine creation scenarios", () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue(mockSession);
      mockOrganizationFindUnique.mockResolvedValue(mockOrganization);
      mockMembershipFindUnique.mockResolvedValue(mockMembership);
      mockRoleFindUnique.mockResolvedValue(mockRole);
      mockPermissionFindFirst.mockResolvedValue(mockPermission);
      mockModelFindFirst.mockResolvedValue(mockModel);
      mockRoomFindFirst.mockResolvedValue(mockRoom);
    });

    it("should generate QR codes for machines with different names", async () => {
      // Arrange
      const machineNames = ["Machine A", "Machine B", "Machine C"];
      mockQRCodeService.generateQRCode.mockResolvedValue(mockQRCodeInfo);

      const caller = createCaller({
        session: mockSession,
        organization: mockOrganization,
      });

      for (const [index, machineName] of machineNames.entries()) {
        const machineId = `machine-${index + 1}`;
        const createdMachine = {
          ...mockCreatedMachine,
          id: machineId,
          name: machineName,
        };

        mockMachineCreate.mockResolvedValueOnce(createdMachine);

        // Act
        await caller.machine.create({
          name: machineName,
          modelId: "model-123",
          locationId: "room-123",
        });

        // Assert - QR code generation was called for each machine
        expect(mockQRCodeService.generateQRCode).toHaveBeenCalledWith(
          machineId,
        );
      }

      // Assert - QR code generation was called for all machines
      expect(mockQRCodeService.generateQRCode).toHaveBeenCalledTimes(3);
    });

    it("should handle QR code generation for machines in different organizations", async () => {
      // Arrange
      const orgA = { ...mockOrganization, id: "org-A", subdomain: "org-a" };
      const orgB = { ...mockOrganization, id: "org-B", subdomain: "org-b" };

      mockQRCodeService.generateQRCode.mockResolvedValue(mockQRCodeInfo);

      // Test for org A
      mockOrganizationFindUnique.mockResolvedValueOnce(orgA);
      mockMachineCreate.mockResolvedValueOnce({
        ...mockCreatedMachine,
        id: "machine-org-a",
      });

      const callerA = createCaller({
        session: mockSession,
        organization: orgA,
      });

      await callerA.machine.create({
        name: "Machine in Org A",
        modelId: "model-123",
        locationId: "room-123",
      });

      // Test for org B
      mockOrganizationFindUnique.mockResolvedValueOnce(orgB);
      mockMachineCreate.mockResolvedValueOnce({
        ...mockCreatedMachine,
        id: "machine-org-b",
      });

      const callerB = createCaller({
        session: mockSession,
        organization: orgB,
      });

      await callerB.machine.create({
        name: "Machine in Org B",
        modelId: "model-123",
        locationId: "room-123",
      });

      // Assert - QR codes generated for both machines
      expect(mockQRCodeService.generateQRCode).toHaveBeenCalledWith(
        "machine-org-a",
      );
      expect(mockQRCodeService.generateQRCode).toHaveBeenCalledWith(
        "machine-org-b",
      );
    });
  });

  describe("error scenarios", () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue(mockSession);
      mockOrganizationFindUnique.mockResolvedValue(mockOrganization);
      mockMembershipFindUnique.mockResolvedValue(mockMembership);
      mockRoleFindUnique.mockResolvedValue(mockRole);
      mockPermissionFindFirst.mockResolvedValue(mockPermission);
    });

    it("should not attempt QR code generation if machine creation fails", async () => {
      // Arrange
      mockModelFindFirst.mockResolvedValue(null); // Invalid model
      mockRoomFindFirst.mockResolvedValue(mockRoom);

      const caller = createCaller({
        session: mockSession,
        organization: mockOrganization,
      });

      // Act & Assert
      await expect(
        caller.machine.create({
          name: "Test Machine",
          modelId: "invalid-model",
          locationId: "room-123",
        }),
      ).rejects.toThrow("Invalid game title or room");

      // Assert - QR code generation was not attempted
      expect(mockQRCodeService.generateQRCode).not.toHaveBeenCalled();
      expect(MockedQRCodeService).not.toHaveBeenCalled();
    });

    it("should not attempt QR code generation without proper authorization", async () => {
      // Arrange
      mockPermissionFindFirst.mockResolvedValue(null); // No machine:edit permission

      const caller = createCaller({
        session: mockSession,
        organization: mockOrganization,
      });

      // Act & Assert
      await expect(
        caller.machine.create({
          name: "Test Machine",
          modelId: "model-123",
          locationId: "room-123",
        }),
      ).rejects.toThrow(TRPCError);

      // Assert - QR code generation was not attempted
      expect(mockQRCodeService.generateQRCode).not.toHaveBeenCalled();
    });
  });

  describe("database error handling", () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue(mockSession);
      mockOrganizationFindUnique.mockResolvedValue(mockOrganization);
      mockMembershipFindUnique.mockResolvedValue(mockMembership);
      mockRoleFindUnique.mockResolvedValue(mockRole);
      mockPermissionFindFirst.mockResolvedValue(mockPermission);
      mockModelFindFirst.mockResolvedValue(mockModel);
      mockRoomFindFirst.mockResolvedValue(mockRoom);
    });

    it("should handle database errors during machine creation", async () => {
      // Arrange
      const dbError = new Error("Database connection failed");
      mockMachineCreate.mockRejectedValue(dbError);

      const caller = createCaller({
        session: mockSession,
        organization: mockOrganization,
      });

      // Act & Assert
      await expect(
        caller.machine.create({
          name: "Test Machine",
          modelId: "model-123",
          locationId: "room-123",
        }),
      ).rejects.toThrow("Database connection failed");

      // Assert - QR code generation was not attempted
      expect(mockQRCodeService.generateQRCode).not.toHaveBeenCalled();
    });
  });
});
