/**
 * @jest-environment node
 */
import { type NextRequest } from "next/server";

import { GET } from "../[qrCodeId]/route";

// Mock the database
const mockMachineFindUnique = jest.fn();

jest.mock("~/server/db", () => ({
  db: {
    machine: {
      findUnique: mockMachineFindUnique,
    },
  },
}));

// Mock console.error to test error logging
jest.spyOn(console, "error").mockImplementation();

describe("/api/qr/[qrCodeId] API Route", () => {
  let mockRequest: NextRequest;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequest = {
      url: "https://example.com/api/qr/test-qr-code",
      method: "GET",
    } as NextRequest;
  });

  const mockMachine = {
    id: "machine-123",
    qrCodeId: "test-qr-code",
    organization: {
      subdomain: "test-org",
    },
    model: {
      name: "Test Machine",
    },
    location: {
      name: "Test Location",
    },
  };

  describe("successful resolution", () => {
    it("should redirect to machine report issue page", async () => {
      // Arrange
      mockMachineFindUnique.mockResolvedValue(mockMachine);

      const params = { qrCodeId: "test-qr-code" };

      // Act
      const response = await GET(mockRequest, { params });

      // Assert
      expect(mockMachineFindUnique).toHaveBeenCalledWith({
        where: { qrCodeId: "test-qr-code" },
        include: {
          model: true,
          location: true,
          organization: true,
        },
      });

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(302); // Redirect status

      // Check redirect URL
      const location = response.headers.get("location");
      expect(location).toBe(
        "https://test-org.pinpoint.app/machines/machine-123/report-issue",
      );
    });

    it("should handle machine with all required relations", async () => {
      // Arrange
      const machineWithFullData = {
        ...mockMachine,
        organization: {
          subdomain: "full-org",
          name: "Full Organization",
        },
        model: {
          name: "Full Machine Model",
          manufacturer: "Test Manufacturer",
        },
        location: {
          name: "Full Location Name",
        },
      };

      mockMachineFindUnique.mockResolvedValue(machineWithFullData);

      const params = { qrCodeId: "full-qr-code" };

      // Act
      const response = await GET(mockRequest, { params });

      // Assert
      expect(response.status).toBe(302);

      const location = response.headers.get("location");
      expect(location).toBe(
        "https://full-org.pinpoint.app/machines/machine-123/report-issue",
      );
    });

    it("should work with different QR code IDs", async () => {
      // Arrange
      const testCases = ["qr-123", "machine-qr-456", "complex-qr-code-789"];

      for (const qrCodeId of testCases) {
        mockMachineFindUnique.mockResolvedValue({
          ...mockMachine,
          qrCodeId,
          id: `machine-${qrCodeId}`,
        });

        const params = { qrCodeId };

        // Act
        const response = await GET(mockRequest, { params });

        // Assert
        expect(response.status).toBe(302);

        const location = response.headers.get("location");
        expect(location).toBe(
          `https://test-org.pinpoint.app/machines/machine-${qrCodeId}/report-issue`,
        );
      }
    });
  });

  describe("error handling", () => {
    it("should return 404 for non-existent QR code", async () => {
      // Arrange
      mockMachineFindUnique.mockResolvedValue(null);

      const params = { qrCodeId: "non-existent-qr" };

      // Act
      const response = await GET(mockRequest, { params });

      // Assert
      expect(mockMachineFindUnique).toHaveBeenCalledWith({
        where: { qrCodeId: "non-existent-qr" },
        include: {
          model: true,
          location: true,
          organization: true,
        },
      });

      expect(response.status).toBe(404);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        error: "QR code not found",
      });
    });

    it("should return 500 for database errors", async () => {
      // Arrange
      const dbError = new Error("Database connection failed");
      mockMachineFindUnique.mockRejectedValue(dbError);

      const params = { qrCodeId: "error-qr-code" };

      // Act
      const response = await GET(mockRequest, { params });

      // Assert
      expect(response.status).toBe(500);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        error: "Internal server error",
      });

      // Check that error was logged
      expect(console.error).toHaveBeenCalledWith(
        "QR code resolution error:",
        dbError,
      );
    });

    it("should handle invalid parameters gracefully", async () => {
      // Arrange
      mockMachineFindUnique.mockResolvedValue(null);

      const testCases = [
        "",
        " ",
        "invalid-chars-!@#$%",
        "very-long-qr-code-id-that-might-cause-issues-in-some-systems",
      ];

      for (const qrCodeId of testCases) {
        const params = { qrCodeId };

        // Act
        const response = await GET(mockRequest, { params });

        // Assert
        expect(response.status).toBe(404);

        const responseBody = await response.json();
        expect(responseBody.error).toBe("QR code not found");
      }
    });

    it("should handle missing subdomain gracefully", async () => {
      // Arrange
      const machineWithoutSubdomain = {
        ...mockMachine,
        organization: {
          subdomain: null,
          name: "Organization Without Subdomain",
        },
      };

      mockMachineFindUnique.mockResolvedValue(machineWithoutSubdomain);

      const params = { qrCodeId: "no-subdomain-qr" };

      // Act
      const response = await GET(mockRequest, { params });

      // Assert
      expect(response.status).toBe(302);

      const location = response.headers.get("location");
      expect(location).toBe(
        "https://null.pinpoint.app/machines/machine-123/report-issue",
      );
    });

    it("should handle network timeouts", async () => {
      // Arrange
      const timeoutError = new Error("Request timeout");
      timeoutError.name = "TimeoutError";
      mockMachineFindUnique.mockRejectedValue(timeoutError);

      const params = { qrCodeId: "timeout-qr-code" };

      // Act
      const response = await GET(mockRequest, { params });

      // Assert
      expect(response.status).toBe(500);
      expect(console.error).toHaveBeenCalledWith(
        "QR code resolution error:",
        timeoutError,
      );
    });

    it("should handle malformed database responses", async () => {
      // Arrange
      const malformedMachine = {
        id: "machine-123",
        // Missing required fields that could cause issues
      };

      mockMachineFindUnique.mockResolvedValue(malformedMachine);

      const params = { qrCodeId: "malformed-qr" };

      // Act
      const response = await GET(mockRequest, { params });

      // Assert
      expect(response.status).toBe(500);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("security considerations", () => {
    it("should not expose sensitive machine data in responses", async () => {
      // Arrange
      const machineWithSensitiveData = {
        ...mockMachine,
        internalNotes: "SENSITIVE: This machine has issues",
        adminPassword: "secret123",
        organization: {
          subdomain: "test-org",
          apiKey: "secret-api-key",
        },
      };

      mockMachineFindUnique.mockResolvedValue(machineWithSensitiveData);

      const params = { qrCodeId: "sensitive-qr" };

      // Act
      const response = await GET(mockRequest, { params });

      // Assert
      expect(response.status).toBe(302);

      // Response should only be a redirect, no sensitive data exposed
      const responseText = await response.text();
      expect(responseText).not.toContain("SENSITIVE");
      expect(responseText).not.toContain("secret");
      expect(responseText).not.toContain("apiKey");
    });

    it("should handle potential injection attempts", async () => {
      // Arrange
      mockMachineFindUnique.mockResolvedValue(null);

      const maliciousInputs = [
        "'; DROP TABLE machines; --",
        "<script>alert('xss')</script>",
        "../../etc/passwd",
        "%00%00%00",
      ];

      for (const maliciousInput of maliciousInputs) {
        const params = { qrCodeId: maliciousInput };

        // Act
        const response = await GET(mockRequest, { params });

        // Assert
        expect(response.status).toBe(404);

        // Should safely handle malicious input without breaking
        const responseBody = await response.json();
        expect(responseBody.error).toBe("QR code not found");
      }
    });

    it("should not leak error details to public responses", async () => {
      // Arrange
      const sensitiveError = new Error(
        "Database credentials invalid for user admin123",
      );
      mockMachineFindUnique.mockRejectedValue(sensitiveError);

      const params = { qrCodeId: "error-qr" };

      // Act
      const response = await GET(mockRequest, { params });

      // Assert
      expect(response.status).toBe(500);

      const responseBody = await response.json();
      expect(responseBody.error).toBe("Internal server error");

      // Should not expose sensitive error details
      expect(responseBody.error).not.toContain("admin123");
      expect(responseBody.error).not.toContain("credentials");
    });
  });

  describe("edge cases", () => {
    it("should handle extremely long QR code IDs", async () => {
      // Arrange
      const longQrCodeId = "a".repeat(1000);
      mockMachineFindUnique.mockResolvedValue(null);

      const params = { qrCodeId: longQrCodeId };

      // Act
      const response = await GET(mockRequest, { params });

      // Assert
      expect(response.status).toBe(404);
      expect(mockMachineFindUnique).toHaveBeenCalledWith({
        where: { qrCodeId: longQrCodeId },
        include: {
          model: true,
          location: true,
          organization: true,
        },
      });
    });

    it("should handle special characters in QR code IDs", async () => {
      // Arrange
      const specialCharQrId = "qr-code-with-üñîçødé-chars";
      const machineWithSpecialChars = {
        ...mockMachine,
        qrCodeId: specialCharQrId,
      };

      mockMachineFindUnique.mockResolvedValue(machineWithSpecialChars);

      const params = { qrCodeId: specialCharQrId };

      // Act
      const response = await GET(mockRequest, { params });

      // Assert
      expect(response.status).toBe(302);

      const location = response.headers.get("location");
      expect(location).toBe(
        "https://test-org.pinpoint.app/machines/machine-123/report-issue",
      );
    });

    it("should handle case sensitivity correctly", async () => {
      // Arrange
      const qrCodeId = "CaSe-SeNsItIvE-QR";
      const machine = {
        ...mockMachine,
        qrCodeId,
      };

      mockMachineFindUnique.mockResolvedValue(machine);

      const params = { qrCodeId };

      // Act
      const response = await GET(mockRequest, { params });

      // Assert
      expect(mockMachineFindUnique).toHaveBeenCalledWith({
        where: { qrCodeId },
        include: {
          model: true,
          location: true,
          organization: true,
        },
      });

      expect(response.status).toBe(302);
    });
  });
});
