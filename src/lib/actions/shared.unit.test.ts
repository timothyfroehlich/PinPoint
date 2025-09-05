/**
 * Server Action Utilities Unit Tests - Archetype 1
 * Pure function testing with no external dependencies
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  actionSuccess,
  actionError,
  validateFormData,
  getFormField,
  validateRequiredFields,
  withActionErrorHandling,
} from "./shared";

describe("Server Action Utilities (Unit Tests - Archetype 1)", () => {
  describe("actionSuccess", () => {
    it("creates successful result with data", () => {
      const data = { id: "123", name: "Test" };
      const result = actionSuccess(data);

      expect(result).toEqual({
        success: true,
        data: { id: "123", name: "Test" },
      });
    });

    it("creates successful result with data and message", () => {
      const data = { id: "123" };
      const message = "Operation completed successfully";
      const result = actionSuccess(data, message);

      expect(result).toEqual({
        success: true,
        data: { id: "123" },
        message: "Operation completed successfully",
      });
    });
  });

  describe("actionError", () => {
    it("creates error result with message", () => {
      const result = actionError("Something went wrong");

      expect(result).toEqual({
        success: false,
        error: "Something went wrong",
      });
    });

    it("creates error result with field errors", () => {
      const fieldErrors = {
        title: ["Title is required"],
        email: ["Invalid email format"],
      };
      const result = actionError("Validation failed", fieldErrors);

      expect(result).toEqual({
        success: false,
        error: "Validation failed",
        fieldErrors: {
          title: ["Title is required"],
          email: ["Invalid email format"],
        },
      });
    });
  });

  describe("validateFormData", () => {
    const testSchema = z.object({
      title: z.string().min(1, "Title is required"),
      description: z.string().optional(),
      priority: z.enum(["low", "medium", "high"]).default("medium"),
    });

    it("validates valid form data successfully", () => {
      const formData = new FormData();
      formData.append("title", "Test Issue");
      formData.append("description", "Test description");
      formData.append("priority", "high");

      const result = validateFormData(formData, testSchema);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          title: "Test Issue",
          description: "Test description",
          priority: "high",
        });
      }
    });

    it("handles optional fields correctly", () => {
      const formData = new FormData();
      formData.append("title", "Test Issue");
      // description omitted

      const result = validateFormData(formData, testSchema);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          title: "Test Issue",
          priority: "medium", // default value
        });
      }
    });

    it("converts empty strings to undefined for optional fields", () => {
      const formData = new FormData();
      formData.append("title", "Test Issue");
      formData.append("description", ""); // empty string

      const result = validateFormData(formData, testSchema);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBeUndefined();
      }
    });

    it("returns validation errors for invalid data", () => {
      const formData = new FormData();
      // title missing (required field)
      formData.append("priority", "invalid"); // invalid enum value

      const result = validateFormData(formData, testSchema);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Validation failed");
        expect(result.fieldErrors).toBeDefined();
        expect(result.fieldErrors?.title).toContain(
          "Invalid input: expected string, received undefined",
        );
        expect(result.fieldErrors?.priority).toBeDefined();
      }
    });
  });

  describe("getFormField", () => {
    it("extracts string field from FormData", () => {
      const formData = new FormData();
      formData.append("title", "Test Title");

      const result = getFormField(formData, "title");
      expect(result).toBe("Test Title");
    });

    it("returns null for missing optional field", () => {
      const formData = new FormData();

      const result = getFormField(formData, "missing");
      expect(result).toBeNull();
    });

    it("throws error for missing required field", () => {
      const formData = new FormData();

      expect(() => {
        getFormField(formData, "required", true);
      }).toThrow("required is required");
    });

    it("trims whitespace from field values", () => {
      const formData = new FormData();
      formData.append("title", "  Test Title  ");

      const result = getFormField(formData, "title");
      expect(result).toBe("Test Title");
    });

    it("treats empty string as missing for required fields", () => {
      const formData = new FormData();
      formData.append("title", "   "); // only whitespace

      expect(() => {
        getFormField(formData, "title", true);
      }).toThrow("title is required");
    });
  });

  describe("validateRequiredFields", () => {
    it("extracts all required fields successfully", () => {
      const formData = new FormData();
      formData.append("title", "Test Title");
      formData.append("machineId", "machine-123");

      const result = validateRequiredFields(formData, ["title", "machineId"]);

      expect(result).toEqual({
        title: "Test Title",
        machineId: "machine-123",
      });
    });

    it("throws error for missing required field", () => {
      const formData = new FormData();
      formData.append("title", "Test Title");
      // machineId missing

      expect(() => {
        validateRequiredFields(formData, ["title", "machineId"]);
      }).toThrow("machineId is required");
    });
  });

  describe("withActionErrorHandling", () => {
    it("wraps successful action result", async () => {
      const successAction = async () => {
        return { id: "123", name: "Test" };
      };

      const result = await withActionErrorHandling(successAction);

      expect(result).toEqual({
        success: true,
        data: { id: "123", name: "Test" },
      });
    });

    it("catches and wraps action errors", async () => {
      const failingAction = async () => {
        throw new Error("Something went wrong");
      };

      const result = await withActionErrorHandling(failingAction);

      expect(result).toEqual({
        success: false,
        error: "Something went wrong",
      });
    });

    it("handles non-Error exceptions", async () => {
      // Intentionally throw a non-Error to verify normalization
      const failingAction = async () => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw "String error";
      };

      const result = await withActionErrorHandling(failingAction);

      expect(result).toEqual({
        success: false,
        error: "An error occurred",
      });
    });
  });
});
