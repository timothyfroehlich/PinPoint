import { describe, it, expect } from "vitest";

import {
  transformPinballMapMachineToModel,
  getModelLookupStrategy,
  validatePinballMapMachine,
  findMatchingMachine,
  calculateSyncOperations,
  generateMachineName,
  prepareMachineCreateData,
} from "../pinballmapTransformer";

import type { PinballMapMachine } from "~/lib/pinballmap/types";

import fixtureData from "~/lib/pinballmap/__tests__/fixtures/api_responses/locations/location_26454_machine_details.json";

describe("pinballmapTransformer", () => {
  // Use real fixture data for comprehensive testing
  const sampleMachines = fixtureData.machines as PinballMapMachine[];

  // Sample machines with different characteristics
  const modernSternMachine = sampleMachines.find(
    (m) => m.name === "Avengers: Infinity Quest (Pro)",
  );
  const vintageGottliebMachine = sampleMachines.find(
    (m) => m.name === "Cleopatra",
  );
  const machineWithoutIpdb = sampleMachines.find(
    (m) => m.name === "Cactus Canyon (Remake Special)",
  );

  if (!modernSternMachine || !vintageGottliebMachine || !machineWithoutIpdb) {
    throw new Error("Required test fixtures not found in sample data");
  }

  describe("transformPinballMapMachineToModel", () => {
    it("should transform modern Stern machine with all fields", () => {
      const result = transformPinballMapMachineToModel(modernSternMachine);

      expect(result).toEqual({
        name: "Avengers: Infinity Quest (Pro)",
        manufacturer: "Stern",
        year: 2020,
        opdbId: "Gj66P-M3dxn",
        ipdbId: "6754",
        isActive: true,
        ipdbLink: "https://www.ipdb.org/machine.cgi?id=6754",
        kineticistUrl:
          "https://www.kineticist.com/pinball-machines/avengers-infinity-quest-2020",
        isCustom: false,
      });
    });

    it("should transform vintage machine with minimal fields", () => {
      const result = transformPinballMapMachineToModel(vintageGottliebMachine);

      expect(result).toEqual({
        name: "Cleopatra",
        manufacturer: "Gottlieb",
        year: 1977,
        opdbId: "GrknN-MQrdv",
        ipdbId: "532",
        isActive: true,
        ipdbLink: "https://www.ipdb.org/machine.cgi?id=532",
        kineticistUrl:
          "https://www.kineticist.com/pinball-machines/cleopatra-1977",
        isCustom: false,
      });
    });

    it("should handle machine without IPDB ID", () => {
      const result = transformPinballMapMachineToModel(machineWithoutIpdb);

      expect(result).toEqual({
        name: "Cactus Canyon (Remake Special)",
        manufacturer: "Chicago Gaming",
        year: 2021,
        opdbId: "G4835-M2YPK-AR5ln",
        isActive: true,
        kineticistUrl:
          "https://www.kineticist.com/pinball-machines/cactus-canyon-1998",
        isCustom: false,
      });
      // Should not have ipdbId or ipdbLink fields
      expect(result).not.toHaveProperty("ipdbId");
      expect(result).not.toHaveProperty("ipdbLink");
    });

    it("should default isActive to true when not provided", () => {
      const machineWithoutActive = { ...modernSternMachine };
      delete (machineWithoutActive as any).is_active;

      const result = transformPinballMapMachineToModel(machineWithoutActive);
      expect(result.isActive).toBe(true);
    });

    it("should preserve isActive false when explicitly set", () => {
      const inactiveMachine = { ...modernSternMachine, is_active: false };

      const result = transformPinballMapMachineToModel(inactiveMachine);
      expect(result.isActive).toBe(false);
    });

    it("should omit undefined/null fields cleanly", () => {
      const minimalMachine: PinballMapMachine = {
        id: 999,
        name: "Test Machine",
        machine_name: "Test Machine",
        opdb_id: "TEST-001",
      };

      const result = transformPinballMapMachineToModel(minimalMachine);

      expect(result).toEqual({
        name: "Test Machine",
        opdbId: "TEST-001",
        isActive: true,
        isCustom: false,
      });

      // Verify no undefined properties
      expect(Object.values(result).every((v) => v !== undefined)).toBe(true);
    });
  });

  describe("getModelLookupStrategy", () => {
    it("should prioritize OPDB ID over IPDB ID", () => {
      const strategy = getModelLookupStrategy(modernSternMachine);

      expect(strategy).toEqual([
        { type: "opdb", value: "Gj66P-M3dxn" },
        { type: "ipdb", value: "6754" },
      ]);
    });

    it("should handle machine with only OPDB ID", () => {
      const strategy = getModelLookupStrategy(machineWithoutIpdb);

      expect(strategy).toEqual([{ type: "opdb", value: "G4835-M2YPK-AR5ln" }]);
    });

    it("should handle machine with only IPDB ID", () => {
      const ipdbOnlyMachine: PinballMapMachine = {
        id: 999,
        name: "Test",
        machine_name: "Test",
        ipdb_id: 1234,
      };

      const strategy = getModelLookupStrategy(ipdbOnlyMachine);

      expect(strategy).toEqual([{ type: "ipdb", value: "1234" }]);
    });

    it("should return empty array when no IDs present", () => {
      const noIdMachine: PinballMapMachine = {
        id: 999,
        name: "Test",
        machine_name: "Test",
      };

      const strategy = getModelLookupStrategy(noIdMachine);
      expect(strategy).toEqual([]);
    });
  });

  describe("validatePinballMapMachine", () => {
    it("should validate correct machine data", () => {
      const result = validatePinballMapMachine(modernSternMachine);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should reject non-object input", () => {
      const result = validatePinballMapMachine("not an object");

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Machine data must be an object");
    });

    it("should reject machine without machine_name or name", () => {
      const invalidMachine = { ...modernSternMachine };
      delete (invalidMachine as any).machine_name;
      delete (invalidMachine as any).name;

      const result = validatePinballMapMachine(invalidMachine);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "machine_name or name is required and must be a string",
      );
    });

    it("should reject machine without any IDs", () => {
      const invalidMachine = {
        machine_name: "Test Machine",
        // No opdb_id or ipdb_id
      };

      const result = validatePinballMapMachine(invalidMachine);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Either opdb_id or ipdb_id must be present",
      );
    });

    it("should validate year range", () => {
      const futureYear = new Date().getFullYear() + 5;
      const invalidMachine = {
        ...modernSternMachine,
        year: futureYear,
      };

      const result = validatePinballMapMachine(invalidMachine);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "year must be a valid number between 1900 and current year + 2",
      );
    });

    it("should validate boolean fields", () => {
      const invalidMachine = {
        ...modernSternMachine,
        is_active: "not a boolean" as any,
      };

      const result = validatePinballMapMachine(invalidMachine);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("is_active must be a boolean");
    });

    it("should validate URL fields", () => {
      const invalidMachine = {
        ...modernSternMachine,
        ipdb_link: "not-a-valid-url",
      };

      const result = validatePinballMapMachine(invalidMachine);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("ipdb_link must be a valid URL");
    });

    it("should allow null URL fields", () => {
      const machineWithNullUrl = {
        ...modernSternMachine,
        ipdb_link: null,
      };

      const result = validatePinballMapMachine(machineWithNullUrl);
      expect(result.isValid).toBe(true);
    });
  });

  describe("findMatchingMachine", () => {
    const currentMachines = [
      { id: "machine-1", modelId: "model-mm" },
      { id: "machine-2", modelId: "model-tz" },
      { id: "machine-3", modelId: "model-bk" },
    ];

    it("should find existing machine by model ID", () => {
      const result = findMatchingMachine("model-mm", currentMachines);

      expect(result).toEqual({
        existingMachineId: "machine-1",
        isNewMachine: false,
        shouldUpdate: false,
      });
    });

    it("should identify new machine when model not found", () => {
      const result = findMatchingMachine("model-new", currentMachines);

      expect(result).toEqual({
        existingMachineId: undefined,
        isNewMachine: true,
        shouldUpdate: false,
      });
    });

    it("should handle empty current machines list", () => {
      const result = findMatchingMachine("model-any", []);

      expect(result).toEqual({
        existingMachineId: undefined,
        isNewMachine: true,
        shouldUpdate: false,
      });
    });
  });

  describe("calculateSyncOperations", () => {
    const currentMachines = [
      { id: "machine-existing", modelId: "model-existing" },
      { id: "machine-old", modelId: "model-old" },
    ];

    const foundModels = new Map([
      ["existing-opdb-id", { id: "model-existing", name: "Existing Game" }],
      ["new-opdb-id", { id: "model-new", name: "New Game" }],
    ]);

    const pmMachines: PinballMapMachine[] = [
      {
        id: 1,
        name: "Existing Game",
        machine_name: "Existing Game",
        opdb_id: "existing-opdb-id",
      },
      {
        id: 2,
        name: "New Game",
        machine_name: "New Game",
        opdb_id: "new-opdb-id",
      },
    ];

    it("should calculate correct sync operations", () => {
      const result = calculateSyncOperations(
        pmMachines,
        currentMachines,
        foundModels,
      );

      expect(result.toAdd).toHaveLength(1);
      expect(result.toAdd[0]).toEqual({
        pmMachine: pmMachines[1],
        modelId: "model-new",
      });

      expect(result.toUpdate).toHaveLength(0);

      expect(result.candidatesForRemoval).toEqual(["machine-old"]);
    });

    it("should skip machines without found models", () => {
      const pmMachinesWithUnknown: PinballMapMachine[] = [
        ...pmMachines,
        {
          id: 3,
          name: "Unknown Game",
          machine_name: "Unknown Game",
          opdb_id: "unknown-opdb-id",
        },
      ];

      const result = calculateSyncOperations(
        pmMachinesWithUnknown,
        currentMachines,
        foundModels,
      );

      // Should still only add one machine (the known new one)
      expect(result.toAdd).toHaveLength(1);
    });

    it("should handle empty PinballMap machines", () => {
      const result = calculateSyncOperations([], currentMachines, foundModels);

      expect(result.toAdd).toHaveLength(0);
      expect(result.toUpdate).toHaveLength(0);
      expect(result.candidatesForRemoval).toEqual([
        "machine-existing",
        "machine-old",
      ]);
    });

    it("should handle machines with IPDB IDs as fallback", () => {
      const ipdbFoundModels = new Map([
        ["1234", { id: "model-ipdb", name: "IPDB Game" }],
      ]);

      const ipdbMachine: PinballMapMachine = {
        id: 1,
        name: "IPDB Game",
        machine_name: "IPDB Game",
        ipdb_id: 1234,
      };

      const result = calculateSyncOperations(
        [ipdbMachine],
        [],
        ipdbFoundModels,
      );

      expect(result.toAdd).toHaveLength(1);
      expect(result.toAdd[0]?.modelId).toBe("model-ipdb");
    });
  });

  describe("generateMachineName", () => {
    it("should return model name for first instance", () => {
      const result = generateMachineName("Medieval Madness");
      expect(result).toBe("Medieval Madness");
    });

    it("should return model name for instance number 1", () => {
      const result = generateMachineName("Medieval Madness", 1);
      expect(result).toBe("Medieval Madness");
    });

    it("should append instance number for multiple instances", () => {
      const result = generateMachineName("Medieval Madness", 2);
      expect(result).toBe("Medieval Madness #2");
    });

    it("should handle high instance numbers", () => {
      const result = generateMachineName("Medieval Madness", 10);
      expect(result).toBe("Medieval Madness #10");
    });
  });

  describe("prepareMachineCreateData", () => {
    it("should prepare correct machine creation data", () => {
      const result = prepareMachineCreateData(
        "model-123",
        "org-456",
        "location-789",
        "Medieval Madness",
      );

      expect(result).toEqual({
        name: "Medieval Madness",
        organizationId: "org-456",
        locationId: "location-789",
        modelId: "model-123",
      });
    });

    it("should use generateMachineName for consistency", () => {
      // This test ensures the function uses our naming convention
      const result = prepareMachineCreateData(
        "model-123",
        "org-456",
        "location-789",
        "Test Game",
      );

      expect(result.name).toBe("Test Game");
    });
  });

  describe("Real PinballMap Data Integration", () => {
    it("should handle all machines in fixture data", () => {
      // Test that all real machines can be transformed without errors
      const results = sampleMachines.map((machine) => {
        expect(() => transformPinballMapMachineToModel(machine)).not.toThrow();
        return transformPinballMapMachineToModel(machine);
      });

      expect(results).toHaveLength(sampleMachines.length);

      // Verify all results have required fields
      results.forEach((result) => {
        expect(result.name).toBeTruthy();
        expect(result.isCustom).toBe(false);
        expect(typeof result.isActive).toBe("boolean");
      });
    });

    it("should validate all machines in fixture data", () => {
      const validationResults = sampleMachines.map((machine) =>
        validatePinballMapMachine(machine),
      );

      // All fixture machines should be valid
      validationResults.forEach((result, index) => {
        if (!result.isValid) {
          console.error(
            `Machine ${index} validation failed:`,
            result.errors,
            sampleMachines[index],
          );
        }
        expect(result.isValid).toBe(true);
      });
    });

    it("should generate lookup strategies for all fixture machines", () => {
      const strategies = sampleMachines.map((machine) =>
        getModelLookupStrategy(machine),
      );

      // All machines should have at least one lookup strategy
      strategies.forEach((strategy, index) => {
        expect(strategy.length).toBeGreaterThan(0);

        // First strategy should be OPDB if available
        if (sampleMachines[index]?.opdb_id) {
          expect(strategy[0]?.type).toBe("opdb");
          expect(strategy[0]?.value).toBe(sampleMachines[index]?.opdb_id);
        }
      });
    });

    it("should handle edge cases in fixture data", () => {
      // Find machines with special characteristics
      const machinesWithoutIpdb = sampleMachines.filter((m) => !m.ipdb_id);
      const modernMachines = sampleMachines.filter(
        (m) => m.year && m.year > 2020,
      );
      const vintageMachines = sampleMachines.filter(
        (m) => m.year && m.year < 1980,
      );

      expect(machinesWithoutIpdb.length).toBeGreaterThan(0);
      expect(modernMachines.length).toBeGreaterThan(0);
      expect(vintageMachines.length).toBeGreaterThan(0);

      // All should transform successfully
      [...machinesWithoutIpdb, ...modernMachines, ...vintageMachines].forEach(
        (machine) => {
          expect(() =>
            transformPinballMapMachineToModel(machine),
          ).not.toThrow();
        },
      );
    });
  });
});
