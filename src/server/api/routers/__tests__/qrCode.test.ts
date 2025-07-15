/**
 * Tests for QR Code tRPC router
 * Testing authentication, authorization, input validation, and service integration
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
  },
}));

// Mock NextAuth
jest.mock("~/server/auth", () => ({
  auth: jest.fn(),
}));

const mockAuth = auth as jest.Mock;

describe("QR Code tRPC Router", () => {
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

  const mockQRCodeInfo = {
    qrCodeUrl: "/uploads/images/qr-machine-1.webp",
    reportUrl: "https://test.pinpoint.app/machines/machine-1/report-issue",
    machineInfo: {
      id: "machine-1",
      modelName: "Test Machine",
      locationName: "Test Location",
      organizationName: "Test Organization",
    },
  };

  const mockBulkResult = {
    generated: 5,
    failed: 1,
    errors: ["Machine machine-6: Database error"],
  };

  const mockResolutionResult = {
    machine: {
      id: "machine-1",
      modelName: "Test Machine",
      locationName: "Test Location",
      organizationName: "Test Organization",
      organizationSubdomain: "test",
    },
    reportUrl: "https://test.pinpoint.app/machines/machine-1/report-issue",
  };

  describe("generate", () => {
    it("should generate QR code for authorized user", async () => {
      // Arrange
      mockAuth.mockResolvedValue(mockSession);
      mockOrganizationFindUnique.mockResolvedValue(mockOrganization);
      mockMembershipFindUnique.mockResolvedValue(mockMembership);
      mockRoleFindUnique.mockResolvedValue({
        ...mockRole,
        permissions: [mockPermission],
      });
      mockPermissionFindFirst.mockResolvedValue(mockPermission);
      mockQRCodeService.generateQRCode.mockResolvedValue(mockQRCodeInfo);

      const caller = createCaller({
        session: mockSession,
        organization: mockOrganization,
      });

      // Act
      const result = await caller.qrCode.generate({ machineId: "machine-1" });

      // Assert
      expect(mockQRCodeService.generateQRCode).toHaveBeenCalledWith(
        "machine-1",
      );
      expect(result).toEqual(mockQRCodeInfo);
    });

    it("should reject unauthenticated requests", async () => {
      // Arrange
      mockAuth.mockResolvedValue(null);

      const caller = createCaller({
        session: null,
        organization: null,
      });

      // Act & Assert
      await expect(
        caller.qrCode.generate({ machineId: "machine-1" }),
      ).rejects.toThrow(TRPCError);
    });

    it("should validate input", async () => {
      // Arrange
      mockAuth.mockResolvedValue(mockSession);
      mockOrganizationFindUnique.mockResolvedValue(mockOrganization);
      mockMembershipFindUnique.mockResolvedValue(mockMembership);
      mockRoleFindUnique.mockResolvedValue({
        ...mockRole,
        permissions: [mockPermission],
      });
      mockPermissionFindFirst.mockResolvedValue(mockPermission);

      const caller = createCaller({
        session: mockSession,
        organization: mockOrganization,
      });

      // Act & Assert
      await expect(caller.qrCode.generate({ machineId: "" })).rejects.toThrow();
    });

    it("should handle service errors", async () => {
      // Arrange
      mockAuth.mockResolvedValue(mockSession);
      mockOrganizationFindUnique.mockResolvedValue(mockOrganization);
      mockMembershipFindUnique.mockResolvedValue(mockMembership);
      mockRoleFindUnique.mockResolvedValue({
        ...mockRole,
        permissions: [mockPermission],
      });
      mockPermissionFindFirst.mockResolvedValue(mockPermission);
      mockQRCodeService.generateQRCode.mockRejectedValue(
        new Error("Service error"),
      );

      const caller = createCaller({
        session: mockSession,
        organization: mockOrganization,
      });

      // Act & Assert
      await expect(
        caller.qrCode.generate({ machineId: "machine-1" }),
      ).rejects.toThrow("Service error");
    });
  });

  describe("getInfo", () => {
    it("should get QR code info for organization member", async () => {
      // Arrange
      mockAuth.mockResolvedValue(mockSession);
      mockOrganizationFindUnique.mockResolvedValue(mockOrganization);
      mockMembershipFindUnique.mockResolvedValue(mockMembership);
      mockQRCodeService.getQRCodeInfo.mockResolvedValue(mockQRCodeInfo);

      const caller = createCaller({
        session: mockSession,
        organization: mockOrganization,
      });

      // Act
      const result = await caller.qrCode.getInfo({ machineId: "machine-1" });

      // Assert
      expect(mockQRCodeService.getQRCodeInfo).toHaveBeenCalledWith("machine-1");
      expect(result).toEqual(mockQRCodeInfo);
    });

    it("should throw NOT_FOUND for non-existent machine", async () => {
      // Arrange
      mockAuth.mockResolvedValue(mockSession);
      mockOrganizationFindUnique.mockResolvedValue(mockOrganization);
      mockMembershipFindUnique.mockResolvedValue(mockMembership);
      mockQRCodeService.getQRCodeInfo.mockResolvedValue(null);

      const caller = createCaller({
        session: mockSession,
        organization: mockOrganization,
      });

      // Act & Assert
      await expect(
        caller.qrCode.getInfo({ machineId: "invalid-id" }),
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("regenerate", () => {
    it("should regenerate QR code for authorized user", async () => {
      // Arrange
      mockAuth.mockResolvedValue(mockSession);
      mockOrganizationFindUnique.mockResolvedValue(mockOrganization);
      mockMembershipFindUnique.mockResolvedValue(mockMembership);
      mockRoleFindUnique.mockResolvedValue({
        ...mockRole,
        permissions: [mockPermission],
      });
      mockPermissionFindFirst.mockResolvedValue(mockPermission);
      mockQRCodeService.regenerateQRCode.mockResolvedValue(mockQRCodeInfo);

      const caller = createCaller({
        session: mockSession,
        organization: mockOrganization,
      });

      // Act
      const result = await caller.qrCode.regenerate({ machineId: "machine-1" });

      // Assert
      expect(mockQRCodeService.regenerateQRCode).toHaveBeenCalledWith(
        "machine-1",
      );
      expect(result).toEqual(mockQRCodeInfo);
    });

    it("should validate input parameters", async () => {
      // Arrange
      mockAuth.mockResolvedValue(mockSession);
      mockOrganizationFindUnique.mockResolvedValue(mockOrganization);
      mockMembershipFindUnique.mockResolvedValue(mockMembership);
      mockRoleFindUnique.mockResolvedValue({
        ...mockRole,
        permissions: [mockPermission],
      });
      mockPermissionFindFirst.mockResolvedValue(mockPermission);

      const caller = createCaller({
        session: mockSession,
        organization: mockOrganization,
      });

      // Act & Assert
      await expect(
        caller.qrCode.regenerate({ machineId: "" }),
      ).rejects.toThrow();
    });
  });

  describe("generateBulk", () => {
    it("should generate QR codes for all machines in organization", async () => {
      // Arrange
      const mockManagePermission = {
        id: "permission-456",
        name: "organization:manage",
      };

      mockAuth.mockResolvedValue(mockSession);
      mockOrganizationFindUnique.mockResolvedValue(mockOrganization);
      mockMembershipFindUnique.mockResolvedValue(mockMembership);
      mockRoleFindUnique.mockResolvedValue({
        ...mockRole,
        permissions: [mockManagePermission],
      });
      mockPermissionFindFirst.mockResolvedValue(mockManagePermission);
      mockQRCodeService.generateQRCodesForOrganization.mockResolvedValue(
        mockBulkResult,
      );

      const caller = createCaller({
        session: mockSession,
        organization: mockOrganization,
      });

      // Act
      const result = await caller.qrCode.generateBulk();

      // Assert
      expect(
        mockQRCodeService.generateQRCodesForOrganization,
      ).toHaveBeenCalledWith("org-123");
      expect(result).toEqual(mockBulkResult);
    });

    it("should require organization management permissions", async () => {
      // Arrange
      mockAuth.mockResolvedValue(mockSession);
      mockOrganizationFindUnique.mockResolvedValue(mockOrganization);
      mockMembershipFindUnique.mockResolvedValue(mockMembership);
      mockRoleFindUnique.mockResolvedValue({ ...mockRole, permissions: [] });
      mockPermissionFindFirst.mockResolvedValue(null);

      const caller = createCaller({
        session: mockSession,
        organization: mockOrganization,
      });

      // Act & Assert
      await expect(caller.qrCode.generateBulk()).rejects.toThrow(TRPCError);
    });
  });

  describe("resolve (public endpoint)", () => {
    it("should resolve machine from QR code without authentication", async () => {
      // Arrange
      mockQRCodeService.resolveMachineFromQR.mockResolvedValue(
        mockResolutionResult,
      );

      const caller = createCaller({
        session: null,
        organization: null,
      });

      // Act
      const result = await caller.qrCode.resolve({ qrCodeId: "qr-code-123" });

      // Assert
      expect(mockQRCodeService.resolveMachineFromQR).toHaveBeenCalledWith(
        "qr-code-123",
      );
      expect(result).toEqual(mockResolutionResult);
    });

    it("should throw NOT_FOUND for invalid QR code", async () => {
      // Arrange
      mockQRCodeService.resolveMachineFromQR.mockResolvedValue(null);

      const caller = createCaller({
        session: null,
        organization: null,
      });

      // Act & Assert
      await expect(
        caller.qrCode.resolve({ qrCodeId: "invalid-qr-code" }),
      ).rejects.toThrow(TRPCError);
    });

    it("should validate input", async () => {
      // Arrange
      const caller = createCaller({
        session: null,
        organization: null,
      });

      // Act & Assert
      await expect(caller.qrCode.resolve({ qrCodeId: "" })).rejects.toThrow();
    });

    it("should handle service errors gracefully", async () => {
      // Arrange
      mockQRCodeService.resolveMachineFromQR.mockRejectedValue(
        new Error("Database error"),
      );

      const caller = createCaller({
        session: null,
        organization: null,
      });

      // Act & Assert
      await expect(
        caller.qrCode.resolve({ qrCodeId: "qr-code-123" }),
      ).rejects.toThrow("Database error");
    });
  });

  describe("service instantiation", () => {
    it("should create QRCodeService with correct database instance", async () => {
      // Arrange
      mockAuth.mockResolvedValue(mockSession);
      mockOrganizationFindUnique.mockResolvedValue(mockOrganization);
      mockMembershipFindUnique.mockResolvedValue(mockMembership);
      mockRoleFindUnique.mockResolvedValue({
        ...mockRole,
        permissions: [mockPermission],
      });
      mockPermissionFindFirst.mockResolvedValue(mockPermission);
      mockQRCodeService.generateQRCode.mockResolvedValue(mockQRCodeInfo);

      const caller = createCaller({
        session: mockSession,
        organization: mockOrganization,
      });

      // Act
      await caller.qrCode.generate({ machineId: "machine-1" });

      // Assert
      expect(MockedQRCodeService).toHaveBeenCalledWith(expect.any(Object));
    });
  });

  describe("error handling", () => {
    it("should handle TRPCError instances correctly", async () => {
      // Arrange
      mockAuth.mockResolvedValue(mockSession);
      mockOrganizationFindUnique.mockResolvedValue(mockOrganization);
      mockMembershipFindUnique.mockResolvedValue(mockMembership);
      mockRoleFindUnique.mockResolvedValue({
        ...mockRole,
        permissions: [mockPermission],
      });
      mockPermissionFindFirst.mockResolvedValue(mockPermission);

      const trpcError = new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal error",
      });
      mockQRCodeService.generateQRCode.mockRejectedValue(trpcError);

      const caller = createCaller({
        session: mockSession,
        organization: mockOrganization,
      });

      // Act & Assert
      await expect(
        caller.qrCode.generate({ machineId: "machine-1" }),
      ).rejects.toThrow(TRPCError);
    });

    it("should handle non-TRPCError instances", async () => {
      // Arrange
      mockAuth.mockResolvedValue(mockSession);
      mockOrganizationFindUnique.mockResolvedValue(mockOrganization);
      mockMembershipFindUnique.mockResolvedValue(mockMembership);
      mockRoleFindUnique.mockResolvedValue({
        ...mockRole,
        permissions: [mockPermission],
      });
      mockPermissionFindFirst.mockResolvedValue(mockPermission);

      const genericError = new Error("Generic error");
      mockQRCodeService.generateQRCode.mockRejectedValue(genericError);

      const caller = createCaller({
        session: mockSession,
        organization: mockOrganization,
      });

      // Act & Assert
      await expect(
        caller.qrCode.generate({ machineId: "machine-1" }),
      ).rejects.toThrow("Generic error");
    });
  });
});
