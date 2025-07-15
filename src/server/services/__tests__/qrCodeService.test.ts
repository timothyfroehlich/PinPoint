/**
 * Tests for QR Code service layer
 * Comprehensive test coverage for QR code generation, management, and resolution
 */

import { PrismaClient } from "@prisma/client";
import QRCode from "qrcode";

import { QRCodeService } from "../qrCodeService";

import type { Organization, Location, Model, Machine } from "@prisma/client";

import { imageStorage } from "~/lib/image-storage/local-storage";


// Mock dependencies
jest.mock("@prisma/client");
jest.mock("qrcode");
jest.mock("~/lib/image-storage/local-storage");

const MockedPrismaClient = PrismaClient as jest.MockedClass<
  typeof PrismaClient
>;
const mockedQRCode = QRCode as jest.Mocked<typeof QRCode>;
const mockedImageStorage = imageStorage as jest.Mocked<typeof imageStorage>;

// Mock fetch for QR code data URL processing
global.fetch = jest.fn();

describe("QRCodeService", () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let qrCodeService: QRCodeService;

  // Mock data
  const mockOrg: Organization = {
    id: "org-1",
    name: "Test Organization",
    subdomain: "test",
    logoUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockLocation: Location = {
    id: "loc-1",
    name: "Test Location",
    organizationId: "org-1",
  };

  const mockModel: Model = {
    id: "model-1",
    name: "Test Pinball Machine",
    manufacturer: "Test Manufacturer",
    year: 2023,
    opdbId: null,
    isCustom: false,
  };

  const mockMachine: Machine = {
    id: "machine-1",
    organizationId: "org-1",
    locationId: "loc-1",
    modelId: "model-1",
    ownerId: null,
    ownerNotificationsEnabled: true,
    notifyOnNewIssues: true,
    notifyOnStatusChanges: true,
    notifyOnComments: false,
    qrCodeId: "qr-code-id-1",
    qrCodeUrl: null,
    qrCodeGeneratedAt: null,
  };

  const mockMachineWithQR: Machine = {
    ...mockMachine,
    qrCodeUrl: "/uploads/images/qr-codes/machine-1-12345.webp",
    qrCodeGeneratedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create proper mock structure
    mockPrisma = {
      machine: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
    } as any as jest.Mocked<PrismaClient>;

    qrCodeService = new QRCodeService(mockPrisma);

    // Setup default mocks
    (global.fetch as jest.Mock).mockResolvedValue({
      blob: jest.fn().mockResolvedValue(new Blob()),
    });
  });

  describe("generateQRCode", () => {
    beforeEach(() => {
      mockPrisma.machine.findUnique = jest.fn();
      mockPrisma.machine.update = jest.fn();
      mockedQRCode.toDataURL = jest.fn();
      mockedImageStorage.uploadImage = jest.fn();
    });

    it("should generate QR code for valid machine", async () => {
      // Arrange
      const machineWithRelations = {
        ...mockMachine,
        organization: mockOrg,
        location: mockLocation,
        model: mockModel,
      };

      mockPrisma.machine.findUnique.mockResolvedValue(machineWithRelations);
      mockedQRCode.toDataURL.mockResolvedValue("data:image/png;base64,test");
      mockedImageStorage.uploadImage.mockResolvedValue(
        "/uploads/images/qr-machine-1.webp",
      );
      mockPrisma.machine.update.mockResolvedValue(mockMachineWithQR);

      // Act
      const result = await qrCodeService.generateQRCode("machine-1");

      // Assert
      expect(mockPrisma.machine.findUnique).toHaveBeenCalledWith({
        where: { id: "machine-1" },
        include: {
          model: true,
          location: true,
          organization: true,
        },
      });

      expect(mockedQRCode.toDataURL).toHaveBeenCalledWith(
        "https://test.pinpoint.app/machines/machine-1/report-issue",
        {
          width: 300,
          margin: 2,
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        },
      );

      expect(mockedImageStorage.uploadImage).toHaveBeenCalledWith(
        expect.any(File),
        "qr-codes/machine-machine-1",
      );

      expect(mockPrisma.machine.update).toHaveBeenCalledWith({
        where: { id: "machine-1" },
        data: {
          qrCodeUrl: "/uploads/images/qr-machine-1.webp",
          qrCodeGeneratedAt: expect.any(Date),
        },
      });

      expect(result).toEqual({
        qrCodeUrl: "/uploads/images/qr-machine-1.webp",
        reportUrl: "https://test.pinpoint.app/machines/machine-1/report-issue",
        machineInfo: {
          id: "machine-1",
          modelName: "Test Pinball Machine",
          locationName: "Test Location",
          organizationName: "Test Organization",
        },
      });
    });

    it("should throw error for non-existent machine", async () => {
      // Arrange
      mockPrisma.machine.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(qrCodeService.generateQRCode("invalid-id")).rejects.toThrow(
        "Machine not found",
      );

      expect(mockPrisma.machine.findUnique).toHaveBeenCalledWith({
        where: { id: "invalid-id" },
        include: {
          model: true,
          location: true,
          organization: true,
        },
      });
    });

    it("should handle QR code generation errors", async () => {
      // Arrange
      const machineWithRelations = {
        ...mockMachine,
        organization: mockOrg,
        location: mockLocation,
        model: mockModel,
      };

      mockPrisma.machine.findUnique.mockResolvedValue(machineWithRelations);
      mockedQRCode.toDataURL.mockRejectedValue(
        new Error("QR generation failed"),
      );

      // Act & Assert
      await expect(qrCodeService.generateQRCode("machine-1")).rejects.toThrow(
        "QR generation failed",
      );
    });

    it("should handle image upload errors", async () => {
      // Arrange
      const machineWithRelations = {
        ...mockMachine,
        organization: mockOrg,
        location: mockLocation,
        model: mockModel,
      };

      mockPrisma.machine.findUnique.mockResolvedValue(machineWithRelations);
      mockedQRCode.toDataURL.mockResolvedValue("data:image/png;base64,test");
      mockedImageStorage.uploadImage.mockRejectedValue(
        new Error("Upload failed"),
      );

      // Act & Assert
      await expect(qrCodeService.generateQRCode("machine-1")).rejects.toThrow(
        "Upload failed",
      );
    });
  });

  describe("getQRCodeInfo", () => {
    beforeEach(() => {
      mockPrisma.machine.findUnique = jest.fn();
    });

    it("should return QR code info for existing machine", async () => {
      // Arrange
      const machineWithRelations = {
        ...mockMachineWithQR,
        organization: mockOrg,
        location: mockLocation,
        model: mockModel,
      };

      mockPrisma.machine.findUnique.mockResolvedValue(machineWithRelations);

      // Act
      const result = await qrCodeService.getQRCodeInfo("machine-1");

      // Assert
      expect(result).toEqual({
        qrCodeUrl: "/uploads/images/qr-codes/machine-1-12345.webp",
        reportUrl: "https://test.pinpoint.app/machines/machine-1/report-issue",
        machineInfo: {
          id: "machine-1",
          modelName: "Test Pinball Machine",
          locationName: "Test Location",
          organizationName: "Test Organization",
        },
      });
    });

    it("should return empty qrCodeUrl if not generated", async () => {
      // Arrange
      const machineWithRelations = {
        ...mockMachine,
        organization: mockOrg,
        location: mockLocation,
        model: mockModel,
      };

      mockPrisma.machine.findUnique.mockResolvedValue(machineWithRelations);

      // Act
      const result = await qrCodeService.getQRCodeInfo("machine-1");

      // Assert
      expect(result?.qrCodeUrl).toBe("");
    });

    it("should return null for non-existent machine", async () => {
      // Arrange
      mockPrisma.machine.findUnique.mockResolvedValue(null);

      // Act
      const result = await qrCodeService.getQRCodeInfo("invalid-id");

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("regenerateQRCode", () => {
    beforeEach(() => {
      mockPrisma.machine.findUnique = jest.fn();
      mockPrisma.machine.update = jest.fn();
      mockedQRCode.toDataURL = jest.fn();
      mockedImageStorage.uploadImage = jest.fn();
      mockedImageStorage.deleteImage = jest.fn();
    });

    it("should delete old QR code and generate new one", async () => {
      // Arrange
      const machineWithRelations = {
        ...mockMachineWithQR,
        organization: mockOrg,
        location: mockLocation,
        model: mockModel,
      };

      mockPrisma.machine.findUnique
        .mockResolvedValueOnce({ qrCodeUrl: "/old-qr-code.png" }) // First call for deletion
        .mockResolvedValueOnce(machineWithRelations); // Second call for generation

      mockedQRCode.toDataURL.mockResolvedValue("data:image/png;base64,test");
      mockedImageStorage.uploadImage.mockResolvedValue("/new-qr-code.webp");
      mockPrisma.machine.update.mockResolvedValue({
        ...mockMachineWithQR,
        qrCodeUrl: "/new-qr-code.webp",
      });

      // Act
      const result = await qrCodeService.regenerateQRCode("machine-1");

      // Assert
      expect(mockedImageStorage.deleteImage).toHaveBeenCalledWith(
        "/old-qr-code.png",
      );
      expect(result.qrCodeUrl).toBe("/new-qr-code.webp");
    });

    it("should handle deletion errors gracefully", async () => {
      // Arrange
      const machineWithRelations = {
        ...mockMachineWithQR,
        organization: mockOrg,
        location: mockLocation,
        model: mockModel,
      };

      mockPrisma.machine.findUnique
        .mockResolvedValueOnce({ qrCodeUrl: "/old-qr-code.png" })
        .mockResolvedValueOnce(machineWithRelations);

      mockedImageStorage.deleteImage.mockRejectedValue(
        new Error("Delete failed"),
      );
      mockedQRCode.toDataURL.mockResolvedValue("data:image/png;base64,test");
      mockedImageStorage.uploadImage.mockResolvedValue("/new-qr-code.webp");
      mockPrisma.machine.update.mockResolvedValue({
        ...mockMachineWithQR,
        qrCodeUrl: "/new-qr-code.webp",
      });

      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

      // Act
      const result = await qrCodeService.regenerateQRCode("machine-1");

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to delete old QR code:",
        expect.any(Error),
      );
      expect(result.qrCodeUrl).toBe("/new-qr-code.webp");

      consoleSpy.mockRestore();
    });
  });

  describe("resolveMachineFromQR", () => {
    beforeEach(() => {
      mockPrisma.machine.findUnique = jest.fn();
    });

    it("should resolve machine from QR code ID", async () => {
      // Arrange
      const machineWithRelations = {
        ...mockMachine,
        organization: mockOrg,
        location: mockLocation,
        model: mockModel,
      };

      mockPrisma.machine.findUnique.mockResolvedValue(machineWithRelations);

      // Act
      const result = await qrCodeService.resolveMachineFromQR("qr-code-id-1");

      // Assert
      expect(mockPrisma.machine.findUnique).toHaveBeenCalledWith({
        where: { qrCodeId: "qr-code-id-1" },
        include: {
          model: true,
          location: true,
          organization: true,
        },
      });

      expect(result).toEqual({
        machine: {
          id: "machine-1",
          modelName: "Test Pinball Machine",
          locationName: "Test Location",
          organizationName: "Test Organization",
          organizationSubdomain: "test",
        },
        reportUrl: "https://test.pinpoint.app/machines/machine-1/report-issue",
      });
    });

    it("should handle missing subdomain gracefully", async () => {
      // Arrange
      const orgWithoutSubdomain = { ...mockOrg, subdomain: null };
      const machineWithRelations = {
        ...mockMachine,
        organization: orgWithoutSubdomain,
        location: mockLocation,
        model: mockModel,
      };

      mockPrisma.machine.findUnique.mockResolvedValue(machineWithRelations);

      // Act
      const result = await qrCodeService.resolveMachineFromQR("qr-code-id-1");

      // Assert
      expect(result?.machine.organizationSubdomain).toBe("");
    });

    it("should return null for invalid QR code ID", async () => {
      // Arrange
      mockPrisma.machine.findUnique.mockResolvedValue(null);

      // Act
      const result = await qrCodeService.resolveMachineFromQR("invalid-qr-id");

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("generateQRCodesForOrganization", () => {
    beforeEach(() => {
      mockPrisma.machine.findMany = jest.fn();
      mockPrisma.machine.findUnique = jest.fn();
      mockPrisma.machine.update = jest.fn();
      mockedQRCode.toDataURL = jest.fn();
      mockedImageStorage.uploadImage = jest.fn();
    });

    it("should generate QR codes for all machines in organization", async () => {
      // Arrange
      const machines = [
        { id: "machine-1" },
        { id: "machine-2" },
        { id: "machine-3" },
      ];

      const machineWithRelations = {
        ...mockMachine,
        organization: mockOrg,
        location: mockLocation,
        model: mockModel,
      };

      mockPrisma.machine.findMany.mockResolvedValue(machines);
      mockPrisma.machine.findUnique.mockResolvedValue(machineWithRelations);
      mockedQRCode.toDataURL.mockResolvedValue("data:image/png;base64,test");
      mockedImageStorage.uploadImage.mockResolvedValue("/qr-code.webp");
      mockPrisma.machine.update.mockResolvedValue(mockMachineWithQR);

      // Act
      const result =
        await qrCodeService.generateQRCodesForOrganization("org-1");

      // Assert
      expect(mockPrisma.machine.findMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1" },
        select: { id: true },
      });

      expect(result).toEqual({
        generated: 3,
        failed: 0,
        errors: [],
      });
    });

    it("should handle partial failures gracefully", async () => {
      // Arrange
      const machines = [
        { id: "machine-1" },
        { id: "machine-2" },
        { id: "machine-3" },
      ];

      const machineWithRelations = {
        ...mockMachine,
        organization: mockOrg,
        location: mockLocation,
        model: mockModel,
      };

      mockPrisma.machine.findMany.mockResolvedValue(machines);
      mockPrisma.machine.findUnique
        .mockResolvedValueOnce(machineWithRelations) // machine-1 success
        .mockRejectedValueOnce(new Error("Database error")) // machine-2 failure
        .mockResolvedValueOnce(machineWithRelations); // machine-3 success

      mockedQRCode.toDataURL.mockResolvedValue("data:image/png;base64,test");
      mockedImageStorage.uploadImage.mockResolvedValue("/qr-code.webp");
      mockPrisma.machine.update.mockResolvedValue(mockMachineWithQR);

      // Act
      const result =
        await qrCodeService.generateQRCodesForOrganization("org-1");

      // Assert
      expect(result).toEqual({
        generated: 2,
        failed: 1,
        errors: ["Machine machine-2: Database error"],
      });
    });

    it("should handle unknown errors", async () => {
      // Arrange
      const machines = [{ id: "machine-1" }];

      mockPrisma.machine.findMany.mockResolvedValue(machines);
      mockPrisma.machine.findUnique.mockRejectedValue("Unknown error");

      // Act
      const result =
        await qrCodeService.generateQRCodesForOrganization("org-1");

      // Assert
      expect(result).toEqual({
        generated: 0,
        failed: 1,
        errors: ["Machine machine-1: Unknown error"],
      });
    });

    it("should handle empty organization", async () => {
      // Arrange
      mockPrisma.machine.findMany.mockResolvedValue([]);

      // Act
      const result =
        await qrCodeService.generateQRCodesForOrganization("org-1");

      // Assert
      expect(result).toEqual({
        generated: 0,
        failed: 0,
        errors: [],
      });
    });
  });
});
