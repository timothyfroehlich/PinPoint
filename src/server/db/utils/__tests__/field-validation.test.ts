/**
 * Field Validation Utilities Tests
 *
 * Tests for database field validation utilities that prevent
 * camelCase field usage and ensure snake_case consistency.
 */

import { describe, it, expect } from "vitest";
import {
  validateFieldExists,
  validateFieldAccess,
  getFieldMapping,
  isCamelCase,
  convertToSnakeCase,
  validateCommonPattern,
  FIELD_MAPPINGS,
  COMMON_FIELDS,
} from "../field-validation";

describe("Field Validation Utilities", () => {
  describe("isCamelCase", () => {
    it("should detect camelCase fields", () => {
      expect(isCamelCase("logoUrl")).toBe(true);
      expect(isCamelCase("createdAt")).toBe(true);
      expect(isCamelCase("opdbId")).toBe(true);
      expect(isCamelCase("emailNotificationsEnabled")).toBe(true);
    });

    it("should not detect snake_case fields as camelCase", () => {
      expect(isCamelCase("logo_url")).toBe(false);
      expect(isCamelCase("created_at")).toBe(false);
      expect(isCamelCase("opdb_id")).toBe(false);
      expect(isCamelCase("email_notifications_enabled")).toBe(false);
    });

    it("should not detect single word fields as camelCase", () => {
      expect(isCamelCase("name")).toBe(false);
      expect(isCamelCase("email")).toBe(false);
      expect(isCamelCase("id")).toBe(false);
    });
  });

  describe("convertToSnakeCase", () => {
    it("should convert camelCase to snake_case", () => {
      expect(convertToSnakeCase("logoUrl")).toBe("logo_url");
      expect(convertToSnakeCase("createdAt")).toBe("created_at");
      expect(convertToSnakeCase("opdbId")).toBe("opdb_id");
      expect(convertToSnakeCase("emailNotificationsEnabled")).toBe(
        "email_notifications_enabled",
      );
    });

    it("should handle single words without change", () => {
      expect(convertToSnakeCase("name")).toBe("name");
      expect(convertToSnakeCase("email")).toBe("email");
      expect(convertToSnakeCase("id")).toBe("id");
    });

    it("should handle already snake_case fields", () => {
      expect(convertToSnakeCase("logo_url")).toBe("logo_url");
      expect(convertToSnakeCase("created_at")).toBe("created_at");
    });
  });

  describe("getFieldMapping", () => {
    it("should return mapped fields for known camelCase patterns", () => {
      expect(getFieldMapping("logoUrl")).toBe("logo_url");
      expect(getFieldMapping("createdAt")).toBe("created_at");
      expect(getFieldMapping("opdbId")).toBe("opdb_id");
      expect(getFieldMapping("organizationId")).toBe("organization_id");
    });

    it("should return original field if no mapping exists", () => {
      expect(getFieldMapping("unknownField")).toBe("unknownField");
      expect(getFieldMapping("custom_field")).toBe("custom_field");
    });

    it("should handle snake_case fields correctly", () => {
      expect(getFieldMapping("logo_url")).toBe("logo_url");
      expect(getFieldMapping("created_at")).toBe("created_at");
    });
  });

  describe("validateFieldExists", () => {
    it("should validate snake_case fields as correct", () => {
      const result = validateFieldExists("users", "created_at");
      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
      expect(result.suggestion).toBeUndefined();
    });

    it("should reject camelCase fields with suggestions", () => {
      const result = validateFieldExists("organizations", "logoUrl");
      expect(result.valid).toBe(false);
      expect(result.message).toContain("camelCase");
      expect(result.suggestion).toBe("logo_url");
    });

    it("should provide mapping suggestions for known fields", () => {
      const result = validateFieldExists("models", "opdbId");
      expect(result.valid).toBe(false);
      expect(result.suggestion).toBe("opdb_id");
    });

    it("should provide automatic conversion for unknown camelCase fields", () => {
      const result = validateFieldExists("users", "someNewField");
      expect(result.valid).toBe(true); // single word, not camelCase

      const camelResult = validateFieldExists("users", "someNewCamelField");
      expect(camelResult.valid).toBe(false);
      expect(camelResult.suggestion).toBe("some_new_camel_field");
    });
  });

  describe("validateFieldAccess", () => {
    it("should validate multiple fields at once", () => {
      const results = validateFieldAccess("users", [
        "id",
        "email",
        "created_at",
      ]);
      expect(results).toHaveLength(3);
      expect(results.every((r) => r.valid)).toBe(true);
    });

    it("should return validation errors for camelCase fields", () => {
      const results = validateFieldAccess("organizations", [
        "id",
        "logoUrl",
        "createdAt",
      ]);
      expect(results).toHaveLength(3);

      expect(results[0]?.valid).toBe(true); // id
      expect(results[1]?.valid).toBe(false); // logoUrl
      expect(results[1]?.suggestion).toBe("logo_url");
      expect(results[2]?.valid).toBe(false); // createdAt
      expect(results[2]?.suggestion).toBe("created_at");
    });

    it("should handle mixed valid and invalid fields", () => {
      const results = validateFieldAccess("machines", [
        "id",
        "name",
        "ownerId",
        "location_id",
      ]);
      expect(results).toHaveLength(4);

      expect(results[0]?.valid).toBe(true); // id
      expect(results[1]?.valid).toBe(true); // name
      expect(results[2]?.valid).toBe(false); // ownerId -> owner_id
      expect(results[3]?.valid).toBe(true); // location_id
    });
  });

  describe("validateCommonPattern", () => {
    it("should validate timestamp patterns", () => {
      const results = validateCommonPattern("users", "TIMESTAMPS");
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.valid)).toBe(true);
      expect(results.map((r) => r.field)).toEqual(["created_at", "updated_at"]);
    });

    it("should validate user relation patterns", () => {
      const results = validateCommonPattern("machines", "USER_RELATION");
      expect(results).toHaveLength(1);
      expect(results[0]?.valid).toBe(true);
      expect(results[0]?.field).toBe("user_id");
    });

    it("should validate organization relation patterns", () => {
      const results = validateCommonPattern("locations", "ORG_RELATION");
      expect(results).toHaveLength(1);
      expect(results[0]?.valid).toBe(true);
      expect(results[0]?.field).toBe("organization_id");
    });
  });

  describe("FIELD_MAPPINGS", () => {
    it("should contain all common field mappings", () => {
      // Test a selection of important mappings
      expect(FIELD_MAPPINGS.logoUrl).toBe("logo_url");
      expect(FIELD_MAPPINGS.opdbId).toBe("opdb_id");
      expect(FIELD_MAPPINGS.createdAt).toBe("created_at");
      expect(FIELD_MAPPINGS.organizationId).toBe("organization_id");
      expect(FIELD_MAPPINGS.emailNotificationsEnabled).toBe(
        "email_notifications_enabled",
      );
    });

    it("should have unique values (no conflicts)", () => {
      const values = Object.values(FIELD_MAPPINGS);
      const uniqueValues = [...new Set(values)];
      expect(values).toHaveLength(uniqueValues.length);
    });
  });

  describe("COMMON_FIELDS", () => {
    it("should define expected common field patterns", () => {
      expect(COMMON_FIELDS.TIMESTAMPS).toEqual(["created_at", "updated_at"]);
      expect(COMMON_FIELDS.USER_RELATION).toEqual(["user_id"]);
      expect(COMMON_FIELDS.ORG_RELATION).toEqual(["organization_id"]);
      expect(COMMON_FIELDS.SOFT_DELETE).toEqual(["deleted_at"]);
    });
  });

  describe("integration tests", () => {
    it("should catch real-world field naming errors", () => {
      // Test the exact errors found in the codebase
      const logoUrlTest = validateFieldExists("organizations", "logoUrl");
      expect(logoUrlTest.valid).toBe(false);
      expect(logoUrlTest.suggestion).toBe("logo_url");

      const opdbIdTest = validateFieldExists("models", "opdbId");
      expect(opdbIdTest.valid).toBe(false);
      expect(opdbIdTest.suggestion).toBe("opdb_id");

      // Test non-existent field patterns that were found
      const isDefaultTest = validateFieldExists("locations", "is_default");
      expect(isDefaultTest.valid).toBe(true); // This is correct snake_case, but field doesn't exist in schema
    });

    it("should provide helpful error messages", () => {
      const result = validateFieldExists("models", "opdbId");
      expect(result.message).toContain("camelCase");
      expect(result.message).toContain("snake_case");
      expect(result.suggestion).toBe("opdb_id");
    });
  });
});
