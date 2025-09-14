/**
 * Comprehensive Testing Patterns Example [Archived]
 * Demonstrates how multiple test types work together in the RSC migration
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { uuidSchema, optionalPrioritySchema, titleSchema } from "~/lib/validation/schemas";
import {
  SeedBasedMockFactory,
  MockAuthContextFactory,
  MockFormDataFactory,
  MockScenarioFactory,
  SEED_TEST_IDS,
} from "~/test/mocks/seed-based-mocks";

// Import utilities we've built
import {
  actionSuccess,
  actionError,
  validateFormData,
  withActionErrorHandling,
} from "~/lib/actions/shared";

describe("Comprehensive Testing: RSC Test System Working Together", () => {
  describe("Unit Test Example", () => {
    it("validates form data using mock FormData", () => {
      const validFormData = MockFormDataFactory.createValidIssueFormData();

      const schema = z.object({
        title: titleSchema,
        machineId: uuidSchema,
        priority: optionalPrioritySchema.default("medium"),
      });

      const result = validateFormData(validFormData, schema);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("Test Issue from Mock");
        expect(result.data.machineId).toBe(SEED_TEST_IDS.MOCK_PATTERNS.MACHINE);
        expect(result.data.priority).toBe("medium");
      }
    });
  });
});

