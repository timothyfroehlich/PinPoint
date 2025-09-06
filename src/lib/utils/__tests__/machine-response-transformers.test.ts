/**
 * Comprehensive tests for machine response transformers.
 *
 * Tests the transformation of machine and location objects from snake_case database
 * results to camelCase API responses, including nested objects, arrays, and edge cases.
 */

import {
  transformMachineResponse,
  transformMachinesResponse,
  transformLocationResponse,
  transformLocationsResponse,
  transformMachineForIssuesResponse,
  transformMachinesForIssuesResponse,
  transformApiRequestToDb,
  transformMachineWithRelations,
  transformLocationWithMachines,
  transformDbResultToApiResponse,
  transformApiRequestToDbFormat,
} from "../machine-response-transformers";

describe("Machine Response Transformers", () => {
  describe("transformMachineResponse", () => {
    it("should transform machine object with snake_case fields to camelCase", () => {
      const dbMachine = {
        id: "machine_123",
        name: "Medieval Madness",
        model_id: "model_456",
        location_id: "location_789",
        organization_id: "org_abc",
        owner_id: "user_def",
        qr_code_id: "qr_ghi",
        qr_code_url: "https://example.com/qr/ghi",
        qr_code_generated_at: new Date("2023-01-01T00:00:00.000Z"),
        owner_notifications_enabled: true,
        notify_on_new_issues: true,
        notify_on_status_changes: false,
        notify_on_comments: true,
        created_at: new Date("2023-01-01T00:00:00.000Z"),
        updated_at: new Date("2023-01-02T00:00:00.000Z"),
      };

      const result = transformMachineResponse(dbMachine);

      expect(result).toEqual({
        id: "machine_123",
        name: "Medieval Madness",
        modelId: "model_456",
        locationId: "location_789",
        organizationId: "org_abc",
        ownerId: "user_def",
        qrCodeId: "qr_ghi",
        qrCodeUrl: "https://example.com/qr/ghi",
        qrCodeGeneratedAt: new Date("2023-01-01T00:00:00.000Z"),
        ownerNotificationsEnabled: true,
        notifyOnNewIssues: true,
        notifyOnStatusChanges: false,
        notifyOnComments: true,
        createdAt: new Date("2023-01-01T00:00:00.000Z"),
        updatedAt: new Date("2023-01-02T00:00:00.000Z"),
      });
    });

    it("should transform machine with nested model, location, and owner", () => {
      const dbMachine = {
        id: "machine_123",
        name: "Medieval Madness",
        qr_code_id: "qr_456",
        model: {
          id: "model_789",
          name: "Medieval Madness",
          manufacturer: "Williams",
          year: 1997,
          ipdb_id: "4032",
          opdb_id: "mm_97",
          machine_type: "pinball",
          machine_display: "Medieval Madness (Williams 1997)",
          is_active: true,
          ipdb_link: "https://ipdb.org/4032",
          opdb_img_url: "https://opdb.org/mm.jpg",
          kineticist_url: "https://kineticist.com/mm",
          is_custom: false,
          machinesCount: 42,
        },
        location: {
          id: "location_abc",
          name: "Awesome Arcade",
          organization_id: "org_def",
          pinball_map_id: 1234,
          created_at: new Date("2023-01-01T00:00:00.000Z"),
          updated_at: new Date("2023-01-02T00:00:00.000Z"),
        },
        owner: {
          id: "user_ghi",
          name: "John Doe",
          image: "https://example.com/avatar.jpg",
          profile_picture: "https://example.com/profile.jpg",
        },
      };

      const result = transformMachineResponse(dbMachine);

      expect(result.model).toEqual({
        id: "model_789",
        name: "Medieval Madness",
        manufacturer: "Williams",
        year: 1997,
        ipdbId: "4032",
        opdbId: "mm_97",
        machineType: "pinball",
        machineDisplay: "Medieval Madness (Williams 1997)",
        isActive: true,
        ipdbLink: "https://ipdb.org/4032",
        opdbImgUrl: "https://opdb.org/mm.jpg",
        kineticistUrl: "https://kineticist.com/mm",
        isCustom: false,
        machinesCount: 42,
      });

      expect(result.location).toEqual({
        id: "location_abc",
        name: "Awesome Arcade",
        organizationId: "org_def",
        pinballMapId: 1234,
        createdAt: new Date("2023-01-01T00:00:00.000Z"),
        updatedAt: new Date("2023-01-02T00:00:00.000Z"),
      });

      expect(result.owner).toEqual({
        id: "user_ghi",
        name: "John Doe",
        image: "https://example.com/avatar.jpg",
        profilePicture: "https://example.com/profile.jpg",
      });
    });

    it("should handle null and undefined values gracefully", () => {
      expect(() => transformMachineResponse(null)).toThrow(/object/);
      expect(() => transformMachineResponse(undefined)).toThrow(/object/);
      expect(transformMachineResponse({})).toEqual({});
    });

    it("should preserve Date objects during transformation", () => {
      const date = new Date("2023-01-01T00:00:00.000Z");
      const dbMachine = {
        id: "machine_123",
        created_at: date,
        qr_code_generated_at: date,
      };

      const result = transformMachineResponse(dbMachine);

      expect(result.createdAt).toBe(date);
      expect(result.qrCodeGeneratedAt).toBe(date);
      expect(result.createdAt).toBeInstanceOf(Date);
    });
  });

  describe("transformMachinesResponse", () => {
    it("should transform array of machines", () => {
      const dbMachines = [
        {
          id: "machine_1",
          qr_code_id: "qr_1",
          notify_on_new_issues: true,
        },
        {
          id: "machine_2",
          qr_code_id: "qr_2",
          notify_on_status_changes: false,
        },
      ];

      const result = transformMachinesResponse(dbMachines);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "machine_1",
        qrCodeId: "qr_1",
        notifyOnNewIssues: true,
      });
      expect(result[1]).toEqual({
        id: "machine_2",
        qrCodeId: "qr_2",
        notifyOnStatusChanges: false,
      });
    });

    it("should handle empty arrays", () => {
      expect(transformMachinesResponse([])).toEqual([]);
    });

    it("should handle non-array input gracefully", () => {
      const nonArray = { id: "not_an_array" };
      expect(() => transformMachinesResponse(nonArray as any)).toThrow(/array/);
    });
  });

  describe("transformLocationResponse", () => {
    it("should transform location object with snake_case fields", () => {
      const dbLocation = {
        id: "location_123",
        name: "Awesome Arcade",
        organization_id: "org_456",
        pinball_map_id: 789,
        created_at: new Date("2023-01-01T00:00:00.000Z"),
        updated_at: new Date("2023-01-02T00:00:00.000Z"),
      };

      const result = transformLocationResponse(dbLocation);

      expect(result).toEqual({
        id: "location_123",
        name: "Awesome Arcade",
        organizationId: "org_456",
        pinballMapId: 789,
        createdAt: new Date("2023-01-01T00:00:00.000Z"),
        updatedAt: new Date("2023-01-02T00:00:00.000Z"),
      });
    });

    it("should transform location with _count and machines array", () => {
      const dbLocation = {
        id: "location_123",
        name: "Awesome Arcade",
        organization_id: "org_456",
        _count: { machines: 5 },
        machines: [
          {
            id: "machine_1",
            qr_code_id: "qr_1",
            owner_notifications_enabled: true,
          },
          {
            id: "machine_2",
            qr_code_id: "qr_2",
            notify_on_comments: false,
          },
        ],
      };

      const result = transformLocationResponse(dbLocation);

      expect(result.count).toEqual({ machines: 5 });
      expect(result.machines).toHaveLength(2);
      expect(result.machines?.[0]).toEqual({
        id: "machine_1",
        qrCodeId: "qr_1",
        ownerNotificationsEnabled: true,
      });
      expect(result.machines?.[1]).toEqual({
        id: "machine_2",
        qrCodeId: "qr_2",
        notifyOnComments: false,
      });
    });
  });

  describe("transformLocationsResponse", () => {
    it("should transform array of locations with nested machines", () => {
      const dbLocations = [
        {
          id: "location_1",
          pinball_map_id: 123,
          machines: [{ id: "machine_1", qr_code_id: "qr_1" }],
        },
        {
          id: "location_2",
          organization_id: "org_456",
          _count: { machines: 3 },
        },
      ];

      const result = transformLocationsResponse(dbLocations);

      expect(result).toHaveLength(2);
      expect(result[0].pinballMapId).toBe(123);
      expect(result[0].machines).toEqual([
        { id: "machine_1", qrCodeId: "qr_1" },
      ]);
      expect(result[1].organizationId).toBe("org_456");
      expect(result[1].count).toEqual({ machines: 3 });
    });
  });

  describe("transformMachineForIssuesResponse", () => {
    it("should transform simplified machine object for issues", () => {
      const dbMachine = {
        id: "machine_123",
        name: "Medieval Madness",
        model: {
          name: "Medieval Madness (Williams 1997)",
        },
      };

      const result = transformMachineForIssuesResponse(dbMachine);

      expect(result).toEqual({
        id: "machine_123",
        name: "Medieval Madness",
        model: {
          name: "Medieval Madness (Williams 1997)",
        },
      });
    });
  });

  describe("transformMachinesForIssuesResponse", () => {
    it("should transform array of simplified machines for issues", () => {
      const dbMachines = [
        { id: "machine_1", name: "MM", model: { name: "Medieval Madness" } },
        { id: "machine_2", name: "AFM", model: { name: "Attack from Mars" } },
      ];

      const result = transformMachinesForIssuesResponse(dbMachines);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("machine_1");
      expect(result[1].id).toBe("machine_2");
    });
  });

  describe("transformApiRequestToDb", () => {
    it("should convert camelCase API request to snake_case for database", () => {
      const apiRequest = {
        machineId: "machine_123",
        locationId: "location_456",
        ownerNotificationsEnabled: true,
        notifyOnNewIssues: false,
        qrCodeId: "qr_789",
      };

      const result = transformApiRequestToDb(apiRequest);

      expect(result).toEqual({
        machine_id: "machine_123",
        location_id: "location_456",
        owner_notifications_enabled: true,
        notify_on_new_issues: false,
        qr_code_id: "qr_789",
      });
    });
  });

  describe("Type-safe transformers", () => {
    it("should provide type-safe machine transformation", () => {
      const dbMachine = {
        id: "machine_123",
        model_id: "model_456",
        location_id: "location_789",
        model: { id: "model_456", name: "Test Model" },
        location: { id: "location_789", name: "Test Location" },
      };

      const result = transformMachineResponse(dbMachine);

      expect(result.id).toBe("machine_123");
      expect(result.modelId).toBe("model_456");
      expect(result.locationId).toBe("location_789");
      expect(result.model.name).toBe("Test Model");
      expect(result.location.name).toBe("Test Location");
    });

    it("should provide type-safe location transformation", () => {
      const dbLocation = {
        id: "location_123",
        organization_id: "org_456",
        machines: [{ id: "machine_1", qr_code_id: "qr_1" }],
      };

      const result = transformLocationResponse(dbLocation);

      expect(result.id).toBe("location_123");
      expect(result.organizationId).toBe("org_456");
      expect(result.machines).toHaveLength(1);
      expect(result.machines[0].qrCodeId).toBe("qr_1");
    });
  });

  describe("Generic transformers", () => {
    it("should transform any database result to API response format", () => {
      const dbResult = {
        user_id: "user_123",
        profile_picture: "avatar.jpg",
        created_at: new Date(),
        nested_object: {
          field_name: "value",
        },
      };

      const result = transformDbResultToApiResponse(dbResult);

      expect(result).toEqual({
        userId: "user_123",
        profilePicture: "avatar.jpg",
        createdAt: expect.any(Date),
        nestedObject: {
          fieldName: "value",
        },
      });
    });

    it("should transform any API request to database format", () => {
      const apiRequest = {
        userId: "user_123",
        profilePicture: "avatar.jpg",
        createdAt: new Date(),
        nestedObject: {
          fieldName: "value",
        },
      };

      const result = transformApiRequestToDbFormat(apiRequest);

      expect(result).toEqual({
        user_id: "user_123",
        profile_picture: "avatar.jpg",
        created_at: expect.any(Date),
        nested_object: {
          field_name: "value",
        },
      });
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle mixed data types gracefully", () => {
      const mixedData = {
        string_field: "text",
        number_field: 42,
        boolean_field: true,
        null_field: null,
        undefined_field: undefined,
        date_field: new Date(),
        array_field: [1, 2, 3],
        nested_object: {
          inner_field: "value",
        },
      };

      const result = transformDbResultToApiResponse(mixedData);

      expect(result.stringField).toBe("text");
      expect(result.numberField).toBe(42);
      expect(result.booleanField).toBe(true);
      expect(result.nullField).toBeNull();
      expect(result.undefinedField).toBeUndefined();
      expect(result.dateField).toBeInstanceOf(Date);
      expect(result.arrayField).toEqual([1, 2, 3]);
      expect(result.nestedObject.innerField).toBe("value");
    });

    it("should handle empty objects", () => {
      expect(transformMachineResponse({})).toEqual({});
      expect(transformLocationResponse({})).toEqual({});
    });

    it("should handle non-object inputs", () => {
      expect(() => transformMachineResponse("string")).toThrow(/object/);
      expect(() => transformMachineResponse(123)).toThrow(/object/);
      expect(() => transformMachineResponse(true)).toThrow(/object/);
    });

    it("should handle large datasets efficiently", () => {
      const largeMachineArray = Array.from({ length: 1000 }, (_, i) => ({
        id: `machine_${i}`,
        qr_code_id: `qr_${i}`,
        owner_notifications_enabled: i % 2 === 0,
      }));

      const start = performance.now();
      const result = transformMachinesResponse(largeMachineArray);
      const end = performance.now();

      expect(result).toHaveLength(1000);
      expect(result[0].qrCodeId).toBe("qr_0");
      expect(result[999].qrCodeId).toBe("qr_999");
      expect(end - start).toBeLessThan(100); // Should complete in under 100ms
    });
  });

  describe("Round-trip transformation compatibility", () => {
    it("should maintain data integrity through round-trip transformation", () => {
      const originalData = {
        userId: "user_123",
        profilePicture: "avatar.jpg",
        notifyOnNewIssues: true,
        nestedData: {
          fieldName: "value",
          anotherField: 42,
        },
      };

      // Transform to database format
      const dbFormat = transformApiRequestToDbFormat(originalData);

      // Transform back to API format
      const backToApi = transformDbResultToApiResponse(dbFormat);

      expect(backToApi).toEqual(originalData);
    });
  });
});
