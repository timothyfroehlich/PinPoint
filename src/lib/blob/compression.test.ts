import { describe, it, expect } from "vitest";
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
});
