import { describe, it, expect, vi } from "vitest";

// Mock browser-image-compression as it doesn't run in Node
vi.mock("browser-image-compression", () => ({
  default: vi.fn(),
}));

import { validateImageFile } from "./compression";
import { BLOB_CONFIG } from "./config";

describe("Compression Utilities", () => {
  describe("validateImageFile", () => {
    it("should allow valid JPEG files", () => {
      const file = new File(["dummy content"], "test.jpg", {
        type: "image/jpeg",
      });
      Object.defineProperty(file, "size", { value: 1024 * 100 }); // 100 KB

      const result = validateImageFile(file);
      expect(result.valid).toBe(true);
    });

    it("should allow valid PNG files", () => {
      const file = new File(["dummy content"], "test.png", {
        type: "image/png",
      });
      Object.defineProperty(file, "size", { value: 1024 * 100 });

      const result = validateImageFile(file);
      expect(result.valid).toBe(true);
    });

    it("should reject files that are too large", () => {
      const file = new File(["dummy content"], "large.jpg", {
        type: "image/jpeg",
      });
      Object.defineProperty(file, "size", {
        value: BLOB_CONFIG.MAX_FILE_SIZE_BYTES + 1,
      });

      const result = validateImageFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("File too large");
    });

    it("should reject invalid mime types", () => {
      const file = new File(["dummy content"], "test.txt", {
        type: "text/plain",
      });
      Object.defineProperty(file, "size", { value: 1024 });

      const result = validateImageFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid file type");
    });

    it("should reject files that are too small", () => {
      const file = new File(["dummy content"], "tiny.jpg", {
        type: "image/jpeg",
      });
      Object.defineProperty(file, "size", {
        value: BLOB_CONFIG.MIN_FILE_SIZE_BYTES - 1,
      });

      const result = validateImageFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("File too small");
    });
  });

  describe("compressImage", () => {
    it("should return compressed file on success", async () => {
      const { compressImage } = await import("./compression");
      const { default: imageCompression } =
        await import("browser-image-compression");

      const file = new File(["dummy"], "test.jpg", { type: "image/jpeg" });
      const mockCompressed = new File(["compressed"], "test.jpg", {
        type: "image/jpeg",
      });

      vi.mocked(imageCompression).mockResolvedValue(mockCompressed);

      const result = await compressImage(file);
      expect(result).toBe(mockCompressed);
    });

    it("should return original file if compression fails", async () => {
      const { compressImage } = await import("./compression");
      const { default: imageCompression } =
        await import("browser-image-compression");

      const file = new File(["dummy"], "test.jpg", { type: "image/jpeg" });
      vi.mocked(imageCompression).mockRejectedValue(new Error("Failed"));

      const result = await compressImage(file);
      expect(result).toBe(file);
    });
  });
});
