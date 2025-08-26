/// <reference types="vitest" />
import {
  toCamelCase,
  toSnakeCase,
  transformKeysToCamelCase,
  transformKeysToSnakeCase,
  CamelCased,
  SnakeCased,
  DrizzleToCamelCase,
} from "../case-transformers";

describe("Case Transformers", () => {
  describe("toCamelCase", () => {
    it("converts snake_case to camelCase", () => {
      expect(toCamelCase("user_name")).toBe("userName");
      expect(toCamelCase("user_name_id")).toBe("userNameId");
      expect(toCamelCase("created_at")).toBe("createdAt");
      expect(toCamelCase("organization_id")).toBe("organizationId");
    });

    it("handles already camelCase strings", () => {
      expect(toCamelCase("userName")).toBe("userName");
      expect(toCamelCase("createdAt")).toBe("createdAt");
      expect(toCamelCase("id")).toBe("id");
    });

    it("handles edge cases", () => {
      expect(toCamelCase("")).toBe("");
      expect(toCamelCase("id")).toBe("id");
      expect(toCamelCase("_leading_underscore")).toBe("leadingUnderscore");
      expect(toCamelCase("trailing_underscore_")).toBe("trailingUnderscore");
    });

    it("handles invalid inputs gracefully", () => {
      expect(toCamelCase(null as any)).toBe(null);
      expect(toCamelCase(undefined as any)).toBe(undefined);
      expect(toCamelCase(123 as any)).toBe(123);
    });
  });

  describe("toSnakeCase", () => {
    it("converts camelCase to snake_case", () => {
      expect(toSnakeCase("userName")).toBe("user_name");
      expect(toSnakeCase("userNameId")).toBe("user_name_id");
      expect(toSnakeCase("createdAt")).toBe("created_at");
      expect(toSnakeCase("organizationId")).toBe("organization_id");
    });

    it("handles already snake_case strings", () => {
      expect(toSnakeCase("user_name")).toBe("user_name");
      expect(toSnakeCase("created_at")).toBe("created_at");
      expect(toSnakeCase("id")).toBe("id");
    });

    it("handles edge cases", () => {
      expect(toSnakeCase("")).toBe("");
      expect(toSnakeCase("id")).toBe("id");
      expect(toSnakeCase("ID")).toBe("id");
      expect(toSnakeCase("XMLHttpRequest")).toBe("xml_http_request");
      expect(toSnakeCase("userID")).toBe("user_id");
      expect(toSnakeCase("HTTPSProxy")).toBe("https_proxy");
    });

    it("handles invalid inputs gracefully", () => {
      expect(toSnakeCase(null as any)).toBe(null);
      expect(toSnakeCase(undefined as any)).toBe(undefined);
      expect(toSnakeCase(123 as any)).toBe(123);
    });
  });

  describe("transformKeysToCamelCase", () => {
    it("transforms simple object keys", () => {
      const input = {
        user_id: 1,
        first_name: "John",
        last_name: "Doe",
        created_at: "2023-01-01",
      };

      const expected = {
        userId: 1,
        firstName: "John",
        lastName: "Doe",
        createdAt: "2023-01-01",
      };

      expect(transformKeysToCamelCase(input)).toEqual(expected);
    });

    it("handles nested objects", () => {
      const input = {
        user_id: 1,
        user_profile: {
          first_name: "John",
          last_name: "Doe",
          contact_info: {
            email_address: "john@example.com",
            phone_number: "123-456-7890",
          },
        },
      };

      const expected = {
        userId: 1,
        userProfile: {
          firstName: "John",
          lastName: "Doe",
          contactInfo: {
            emailAddress: "john@example.com",
            phoneNumber: "123-456-7890",
          },
        },
      };

      expect(transformKeysToCamelCase(input)).toEqual(expected);
    });

    it("handles arrays", () => {
      const input = {
        user_list: [
          { user_id: 1, first_name: "John" },
          { user_id: 2, first_name: "Jane" },
        ],
        tag_names: ["admin", "user"],
      };

      const expected = {
        userList: [
          { userId: 1, firstName: "John" },
          { userId: 2, firstName: "Jane" },
        ],
        tagNames: ["admin", "user"],
      };

      expect(transformKeysToCamelCase(input)).toEqual(expected);
    });

    it("preserves Date objects", () => {
      const date = new Date("2023-01-01");
      const input = {
        created_at: date,
        updated_at: date,
      };

      const result = transformKeysToCamelCase(input);
      expect(result).toEqual({
        createdAt: date,
        updatedAt: date,
      });
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it("handles null and undefined values", () => {
      const input = {
        user_id: 1,
        first_name: null,
        last_name: undefined,
        active_status: true,
      };

      const expected = {
        userId: 1,
        firstName: null,
        lastName: undefined,
        activeStatus: true,
      };

      expect(transformKeysToCamelCase(input)).toEqual(expected);
    });

    it("handles primitive values", () => {
      expect(transformKeysToCamelCase(null)).toBe(null);
      expect(transformKeysToCamelCase(undefined)).toBe(undefined);
      expect(transformKeysToCamelCase("string")).toBe("string");
      expect(transformKeysToCamelCase(123)).toBe(123);
      expect(transformKeysToCamelCase(true)).toBe(true);
    });

    it("handles arrays of primitives", () => {
      const input = ["admin", "user", "guest"];
      expect(transformKeysToCamelCase(input)).toEqual([
        "admin",
        "user",
        "guest",
      ]);
    });

    it("preserves non-plain objects", () => {
      const date = new Date("2023-01-01");
      const map = new Map([["key", "value"]]);
      const set = new Set([1, 2, 3]);
      const regex = /test/;
      const error = new Error("test");

      const input = {
        user_date: date,
        user_map: map,
        user_set: set,
        user_regex: regex,
        user_error: error,
      };

      const result = transformKeysToCamelCase(input);
      expect(result).toEqual({
        userDate: date,
        userMap: map,
        userSet: set,
        userRegex: regex,
        userError: error,
      });

      // Verify the objects are preserved exactly
      expect(result.userDate).toBe(date);
      expect(result.userMap).toBe(map);
      expect(result.userSet).toBe(set);
      expect(result.userRegex).toBe(regex);
      expect(result.userError).toBe(error);
    });
  });

  describe("transformKeysToSnakeCase", () => {
    it("transforms simple object keys", () => {
      const input = {
        userId: 1,
        firstName: "John",
        lastName: "Doe",
        createdAt: "2023-01-01",
      };

      const expected = {
        user_id: 1,
        first_name: "John",
        last_name: "Doe",
        created_at: "2023-01-01",
      };

      expect(transformKeysToSnakeCase(input)).toEqual(expected);
    });

    it("handles nested objects", () => {
      const input = {
        userId: 1,
        userProfile: {
          firstName: "John",
          lastName: "Doe",
          contactInfo: {
            emailAddress: "john@example.com",
            phoneNumber: "123-456-7890",
          },
        },
      };

      const expected = {
        user_id: 1,
        user_profile: {
          first_name: "John",
          last_name: "Doe",
          contact_info: {
            email_address: "john@example.com",
            phone_number: "123-456-7890",
          },
        },
      };

      expect(transformKeysToSnakeCase(input)).toEqual(expected);
    });

    it("preserves Date objects", () => {
      const date = new Date("2023-01-01");
      const input = {
        createdAt: date,
        updatedAt: date,
      };

      const result = transformKeysToSnakeCase(input);
      expect(result).toEqual({
        created_at: date,
        updated_at: date,
      });
      expect(result.created_at).toBeInstanceOf(Date);
    });
  });

  describe("round-trip conversions", () => {
    it("snake -> camel -> snake should be identical", () => {
      const original = {
        user_id: 1,
        first_name: "John",
        created_at: new Date(),
        nested_object: {
          field_name: "value",
          another_field: 123,
        },
      };

      const camelCase = transformKeysToCamelCase(original);
      const backToSnake = transformKeysToSnakeCase(camelCase);

      expect(backToSnake).toEqual(original);
    });

    it("camel -> snake -> camel should be identical", () => {
      const original = {
        userId: 1,
        firstName: "John",
        createdAt: new Date(),
        nestedObject: {
          fieldName: "value",
          anotherField: 123,
        },
      };

      const snakeCase = transformKeysToSnakeCase(original);
      const backToCamel = transformKeysToCamelCase(snakeCase);

      expect(backToCamel).toEqual(original);
    });
  });

  describe("database-like objects", () => {
    it("handles typical database field patterns", () => {
      const dbRecord = {
        id: 1,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        organization_id: 123,
        machine_id: 456,
        serial_number: "ABC123",
        qr_code_id: "QR789",
        file_name: "document.pdf",
        file_type: "application/pdf",
        status_id: 2,
        priority_id: 3,
        created_by_id: 100,
        assigned_to_id: 200,
        reporter_email: "user@example.com",
        submitter_name: "John Doe",
        old_value: "previous",
        new_value: "current",
        changed_at: new Date(),
        resolved_at: null,
      };

      const result = transformKeysToCamelCase(dbRecord);

      expect(result).toEqual({
        id: 1,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        deletedAt: null,
        organizationId: 123,
        machineId: 456,
        serialNumber: "ABC123",
        qrCodeId: "QR789",
        fileName: "document.pdf",
        fileType: "application/pdf",
        statusId: 2,
        priorityId: 3,
        createdById: 100,
        assignedToId: 200,
        reporterEmail: "user@example.com",
        submitterName: "John Doe",
        oldValue: "previous",
        newValue: "current",
        changedAt: expect.any(Date),
        resolvedAt: null,
      });
    });
  });

  describe("performance", () => {
    it("handles large objects reasonably", () => {
      const largeObject = {
        user_data: Array.from({ length: 1000 }, (_, i) => ({
          user_id: i,
          first_name: `User${i}`,
          last_name: `Last${i}`,
          created_at: new Date(),
          nested_info: {
            field_one: `value${i}`,
            field_two: i * 2,
          },
        })),
      };

      const start = performance.now();
      const result = transformKeysToCamelCase(largeObject);
      const end = performance.now();

      // Should complete in reasonable time (less than 100ms for 1000 records)
      expect(end - start).toBeLessThan(100);
      expect(result.userData).toHaveLength(1000);
      expect(result.userData[0]).toEqual({
        userId: 0,
        firstName: "User0",
        lastName: "Last0",
        createdAt: expect.any(Date),
        nestedInfo: {
          fieldOne: "value0",
          fieldTwo: 0,
        },
      });
    });
  });

  describe("type-level transformations", () => {
    it("compiles correctly with TypeScript", () => {
      // These tests verify that the type transformations work at compile time
      interface TestSnake {
        user_id: number;
        first_name: string;
        created_at: Date;
      }

      interface TestCamel {
        userId: number;
        firstName: string;
        createdAt: Date;
      }

      // Test CamelCased type
      type ConvertedToCamel = CamelCased<TestSnake>;
      const camelTest: ConvertedToCamel = {
        userId: 1,
        firstName: "John",
        createdAt: new Date(),
      };

      // Test SnakeCased type
      type ConvertedToSnake = SnakeCased<TestCamel>;
      const snakeTest: ConvertedToSnake = {
        user_id: 1,
        first_name: "John",
        created_at: new Date(),
      };

      // Test DrizzleToCamelCase type
      type DrizzleConverted = DrizzleToCamelCase<TestSnake>;
      const drizzleTest: DrizzleConverted = {
        userId: 1,
        firstName: "John",
        createdAt: new Date(),
      };

      // Verify the objects are correctly typed
      expect(camelTest.userId).toBe(1);
      expect(snakeTest.user_id).toBe(1);
      expect(drizzleTest.userId).toBe(1);
    });
  });
});
