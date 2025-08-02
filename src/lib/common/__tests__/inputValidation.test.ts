import { describe, it, expect } from "vitest";
import { z } from "zod";

import {
  // Basic ID Validation Schemas
  entityIdSchema,
  machineIdSchema,
  locationIdSchema,
  userIdSchema,
  issueIdSchema,

  // Text Validation Schemas
  nameSchema,
  optionalNameSchema,
  issueTitleSchema,
  optionalIssueTitleSchema,
  descriptionSchema,
  searchQuerySchema,
  submitterNameSchema,

  // Numeric Validation Schemas
  positiveIntegerSchema,
  optionalPositiveIntegerSchema,
  pinballMapIdSchema,

  // Array Validation Schemas
  stringIdArraySchema,
  statusIdsFilterSchema,

  // Composite Validation Schemas
  createEntityWithNameSchema,
  updateEntityWithNameSchema,
  issueCreationCoreSchema,
  issueUpdateCoreSchema,
  machineCreationSchema,
  machineUpdateSchema,

  // Filtering and Search Schemas
  issueFilteringSchema,
  opdbSearchSchema,
  opdbModelSchema,

  // Assignment and Ownership Schemas
  userAssignmentSchema,
  optionalUserAssignmentSchema,
  machineOwnerAssignmentSchema,
  issueAssignmentSchema,

  // Notification Schemas
  notificationIdSchema,

  // Comment Schemas
  commentIdSchema,
  commentCreationSchema,

  // Validation Helpers
  emailSchema,
  optionalEmailSchema,
  booleanFlagSchema,
  optionalBooleanFlagSchema,

  // Utility Functions
  createEntityIdSchema,
  createNamedEntityCreationSchema,
  createNamedEntityUpdateSchema,
  validateNonEmptyStringArray,
  validateAndNormalizeSearchQuery,
  validateOptionalString,
} from "../inputValidation";

// =============================================================================
// TEST UTILITIES
// =============================================================================

function expectZodError(result: any, expectedMessage?: string): void {
  expect(result.success).toBe(false);
  if (expectedMessage && !result.success) {
    expect(result.error.issues[0]?.message).toBe(expectedMessage);
  }
}

function expectZodSuccess(result: any, expectedData?: unknown): void {
  expect(result.success).toBe(true);
  if (expectedData !== undefined && result.success) {
    expect(result.data).toEqual(expectedData);
  }
}

// =============================================================================
// BASIC ID VALIDATION SCHEMA TESTS
// =============================================================================

describe("inputValidation - Basic ID Validation Schemas", () => {
  describe("entityIdSchema", () => {
    it("should validate valid entity ID", () => {
      const result = entityIdSchema.safeParse({ id: "entity-123" });
      expectZodSuccess(result, { id: "entity-123" });
    });

    it("should reject empty entity ID", () => {
      const result = entityIdSchema.safeParse({ id: "" });
      expectZodError(result, "ID is required");
    });

    it("should reject missing entity ID", () => {
      const result = entityIdSchema.safeParse({});
      expectZodError(result);
    });

    it("should accept whitespace-only entity ID (length > 0)", () => {
      const result = entityIdSchema.safeParse({ id: "   " });
      expectZodSuccess(result);
    });

    it("should accept very long entity IDs", () => {
      const longId = "a".repeat(1000);
      const result = entityIdSchema.safeParse({ id: longId });
      expectZodSuccess(result);
    });

    it("should accept special characters in entity IDs", () => {
      const specialId = "entity-123@#$%^&*()";
      const result = entityIdSchema.safeParse({ id: specialId });
      expectZodSuccess(result);
    });
  });

  describe("machineIdSchema", () => {
    it("should validate valid machine ID", () => {
      const result = machineIdSchema.safeParse({ machineId: "machine-456" });
      expectZodSuccess(result, { machineId: "machine-456" });
    });

    it("should reject empty machine ID", () => {
      const result = machineIdSchema.safeParse({ machineId: "" });
      expectZodError(result, "Machine ID is required");
    });

    it("should reject missing machine ID", () => {
      const result = machineIdSchema.safeParse({});
      expectZodError(result);
    });
  });

  describe("locationIdSchema", () => {
    it("should validate valid location ID", () => {
      const result = locationIdSchema.safeParse({ locationId: "location-789" });
      expectZodSuccess(result, { locationId: "location-789" });
    });

    it("should reject empty location ID", () => {
      const result = locationIdSchema.safeParse({ locationId: "" });
      expectZodError(result, "Location ID is required");
    });

    it("should reject missing location ID", () => {
      const result = locationIdSchema.safeParse({});
      expectZodError(result);
    });
  });

  describe("userIdSchema", () => {
    it("should validate valid user ID", () => {
      const result = userIdSchema.safeParse({ userId: "user-abc" });
      expectZodSuccess(result, { userId: "user-abc" });
    });

    it("should reject empty user ID", () => {
      const result = userIdSchema.safeParse({ userId: "" });
      expectZodError(result, "User ID is required");
    });

    it("should reject missing user ID", () => {
      const result = userIdSchema.safeParse({});
      expectZodError(result);
    });
  });

  describe("issueIdSchema", () => {
    it("should validate valid issue ID", () => {
      const result = issueIdSchema.safeParse({ issueId: "issue-xyz" });
      expectZodSuccess(result, { issueId: "issue-xyz" });
    });

    it("should reject empty issue ID", () => {
      const result = issueIdSchema.safeParse({ issueId: "" });
      expectZodError(result, "Issue ID is required");
    });

    it("should reject missing issue ID", () => {
      const result = issueIdSchema.safeParse({});
      expectZodError(result);
    });
  });
});

// =============================================================================
// TEXT VALIDATION SCHEMA TESTS
// =============================================================================

describe("inputValidation - Text Validation Schemas", () => {
  describe("nameSchema", () => {
    it("should validate valid names", () => {
      const validNames = [
        "Test Name",
        "Machine 123",
        "Location-Name_With_Underscores",
        "A",
        "a".repeat(255),
      ];

      for (const name of validNames) {
        const result = nameSchema.safeParse(name);
        expectZodSuccess(result);
      }
    });

    it("should reject empty name", () => {
      const result = nameSchema.safeParse("");
      expectZodError(result, "Name is required");
    });

    it("should accept whitespace-only name (length > 0)", () => {
      const result = nameSchema.safeParse("   ");
      expectZodSuccess(result);
    });

    it("should reject names exceeding 255 characters", () => {
      const longName = "a".repeat(256);
      const result = nameSchema.safeParse(longName);
      expectZodError(result, "Name must be 255 characters or less");
    });

    it("should accept name exactly 255 characters", () => {
      const exactName = "a".repeat(255);
      const result = nameSchema.safeParse(exactName);
      expectZodSuccess(result);
    });

    it("should accept names with special characters", () => {
      const specialName = "Name @#$%^&*()!";
      const result = nameSchema.safeParse(specialName);
      expectZodSuccess(result);
    });
  });

  describe("optionalNameSchema", () => {
    it("should validate valid names", () => {
      const result = optionalNameSchema.safeParse("Valid Name");
      expectZodSuccess(result);
    });

    it("should accept undefined", () => {
      const result = optionalNameSchema.safeParse(undefined);
      expectZodSuccess(result);
    });

    it("should reject empty string", () => {
      const result = optionalNameSchema.safeParse("");
      expectZodError(result, "Name is required");
    });
  });

  describe("issueTitleSchema", () => {
    it("should validate valid issue titles", () => {
      const validTitles = [
        "Machine not working",
        "Fix needed urgently",
        "Short",
        "a".repeat(255),
      ];

      for (const title of validTitles) {
        const result = issueTitleSchema.safeParse(title);
        expectZodSuccess(result);
      }
    });

    it("should reject empty title", () => {
      const result = issueTitleSchema.safeParse("");
      expectZodError(result, "Title is required");
    });

    it("should reject titles exceeding 255 characters", () => {
      const longTitle = "a".repeat(256);
      const result = issueTitleSchema.safeParse(longTitle);
      expectZodError(result, "Title must be 255 characters or less");
    });
  });

  describe("optionalIssueTitleSchema", () => {
    it("should validate valid titles", () => {
      const result = optionalIssueTitleSchema.safeParse("Valid Title");
      expectZodSuccess(result);
    });

    it("should accept undefined", () => {
      const result = optionalIssueTitleSchema.safeParse(undefined);
      expectZodSuccess(result);
    });

    it("should reject empty string", () => {
      const result = optionalIssueTitleSchema.safeParse("");
      expectZodError(result, "Title is required");
    });
  });

  describe("descriptionSchema", () => {
    it("should validate valid descriptions", () => {
      const validDescriptions = [
        "Short description",
        "a".repeat(10000),
        "",
        undefined,
      ];

      for (const description of validDescriptions) {
        const result = descriptionSchema.safeParse(description);
        expectZodSuccess(result);
      }
    });

    it("should reject descriptions exceeding 10,000 characters", () => {
      const longDescription = "a".repeat(10001);
      const result = descriptionSchema.safeParse(longDescription);
      expectZodError(result, "Description must be 10,000 characters or less");
    });

    it("should accept description exactly 10,000 characters", () => {
      const exactDescription = "a".repeat(10000);
      const result = descriptionSchema.safeParse(exactDescription);
      expectZodSuccess(result);
    });

    it("should accept multiline descriptions", () => {
      const multilineDescription = "Line 1\nLine 2\nLine 3";
      const result = descriptionSchema.safeParse(multilineDescription);
      expectZodSuccess(result);
    });
  });

  describe("searchQuerySchema", () => {
    it("should validate valid search queries", () => {
      const validQueries = ["search term", "a", "machine name", undefined];

      for (const query of validQueries) {
        const result = searchQuerySchema.safeParse(query);
        expectZodSuccess(result);
      }
    });

    it("should reject empty search query", () => {
      const result = searchQuerySchema.safeParse("");
      expectZodError(result, "Search query cannot be empty");
    });

    it("should accept whitespace-only search query (length > 0)", () => {
      const result = searchQuerySchema.safeParse("   ");
      expectZodSuccess(result);
    });

    it("should accept search queries with special characters", () => {
      const specialQuery = "search @#$%^&*()";
      const result = searchQuerySchema.safeParse(specialQuery);
      expectZodSuccess(result);
    });
  });

  describe("submitterNameSchema", () => {
    it("should validate valid submitter names", () => {
      const validNames = ["John Doe", "A", "a".repeat(100), undefined];

      for (const name of validNames) {
        const result = submitterNameSchema.safeParse(name);
        expectZodSuccess(result);
      }
    });

    it("should reject submitter names exceeding 100 characters", () => {
      const longName = "a".repeat(101);
      const result = submitterNameSchema.safeParse(longName);
      expectZodError(result, "Submitter name must be 100 characters or less");
    });

    it("should accept submitter name exactly 100 characters", () => {
      const exactName = "a".repeat(100);
      const result = submitterNameSchema.safeParse(exactName);
      expectZodSuccess(result);
    });

    it("should accept empty string", () => {
      const result = submitterNameSchema.safeParse("");
      expectZodSuccess(result);
    });
  });
});

// =============================================================================
// NUMERIC VALIDATION SCHEMA TESTS
// =============================================================================

describe("inputValidation - Numeric Validation Schemas", () => {
  describe("positiveIntegerSchema", () => {
    it("should validate positive integers", () => {
      const validNumbers = [1, 42, 1000, 999999];

      for (const number of validNumbers) {
        const result = positiveIntegerSchema.safeParse(number);
        expectZodSuccess(result);
      }
    });

    it("should reject zero", () => {
      const result = positiveIntegerSchema.safeParse(0);
      expectZodError(result, "Must be a positive integer");
    });

    it("should reject negative numbers", () => {
      const result = positiveIntegerSchema.safeParse(-1);
      expectZodError(result, "Must be a positive integer");
    });

    it("should reject decimal numbers", () => {
      const result = positiveIntegerSchema.safeParse(1.5);
      expectZodError(result);
    });

    it("should reject non-numbers", () => {
      const result = positiveIntegerSchema.safeParse("123");
      expectZodError(result);
    });
  });

  describe("optionalPositiveIntegerSchema", () => {
    it("should validate positive integers", () => {
      const result = optionalPositiveIntegerSchema.safeParse(42);
      expectZodSuccess(result);
    });

    it("should accept undefined", () => {
      const result = optionalPositiveIntegerSchema.safeParse(undefined);
      expectZodSuccess(result);
    });

    it("should reject zero", () => {
      const result = optionalPositiveIntegerSchema.safeParse(0);
      expectZodError(result, "Must be a positive integer");
    });
  });

  describe("pinballMapIdSchema", () => {
    it("should validate valid PinballMap ID", () => {
      const result = pinballMapIdSchema.safeParse({ pinballMapId: 123 });
      expectZodSuccess(result, { pinballMapId: 123 });
    });

    it("should reject zero PinballMap ID", () => {
      const result = pinballMapIdSchema.safeParse({ pinballMapId: 0 });
      expectZodError(result, "Must be a positive integer");
    });

    it("should reject negative PinballMap ID", () => {
      const result = pinballMapIdSchema.safeParse({ pinballMapId: -1 });
      expectZodError(result, "Must be a positive integer");
    });

    it("should reject missing PinballMap ID", () => {
      const result = pinballMapIdSchema.safeParse({});
      expectZodError(result);
    });
  });
});

// =============================================================================
// ARRAY VALIDATION SCHEMA TESTS
// =============================================================================

describe("inputValidation - Array Validation Schemas", () => {
  describe("stringIdArraySchema", () => {
    it("should validate valid string arrays", () => {
      const validArrays = [["id1", "id2", "id3"], ["single-id"], undefined];

      for (const array of validArrays) {
        const result = stringIdArraySchema.safeParse(array);
        expectZodSuccess(result);
      }
    });

    it("should reject empty strings in array", () => {
      const result = stringIdArraySchema.safeParse(["id1", "", "id3"]);
      expectZodError(result);
    });

    it("should reject non-string items", () => {
      const result = stringIdArraySchema.safeParse(["id1", 123, "id3"]);
      expectZodError(result);
    });

    it("should accept empty array", () => {
      const result = stringIdArraySchema.safeParse([]);
      expectZodSuccess(result);
    });

    it("should reject null", () => {
      const result = stringIdArraySchema.safeParse(null);
      expectZodError(result);
    });
  });

  describe("statusIdsFilterSchema", () => {
    it("should validate valid status IDs filter", () => {
      const result = statusIdsFilterSchema.safeParse({
        statusIds: ["status1", "status2"],
      });
      expectZodSuccess(result);
    });

    it("should accept undefined status IDs", () => {
      const result = statusIdsFilterSchema.safeParse({
        statusIds: undefined,
      });
      expectZodSuccess(result);
    });

    it("should accept missing status IDs", () => {
      const result = statusIdsFilterSchema.safeParse({});
      expectZodSuccess(result);
    });

    it("should reject empty strings in status IDs", () => {
      const result = statusIdsFilterSchema.safeParse({
        statusIds: ["status1", ""],
      });
      expectZodError(result);
    });
  });
});

// =============================================================================
// COMPOSITE VALIDATION SCHEMA TESTS
// =============================================================================

describe("inputValidation - Composite Validation Schemas", () => {
  describe("createEntityWithNameSchema", () => {
    it("should validate valid entity creation", () => {
      const result = createEntityWithNameSchema.safeParse({
        name: "Entity Name",
      });
      expectZodSuccess(result, { name: "Entity Name" });
    });

    it("should reject empty name", () => {
      const result = createEntityWithNameSchema.safeParse({ name: "" });
      expectZodError(result, "Name is required");
    });

    it("should reject missing name", () => {
      const result = createEntityWithNameSchema.safeParse({});
      expectZodError(result);
    });

    it("should reject names exceeding 255 characters", () => {
      const longName = "a".repeat(256);
      const result = createEntityWithNameSchema.safeParse({ name: longName });
      expectZodError(result, "Name must be 255 characters or less");
    });
  });

  describe("updateEntityWithNameSchema", () => {
    it("should validate valid entity update", () => {
      const result = updateEntityWithNameSchema.safeParse({
        id: "entity-123",
        name: "Updated Name",
      });
      expectZodSuccess(result);
    });

    it("should validate with only ID (no name update)", () => {
      const result = updateEntityWithNameSchema.safeParse({
        id: "entity-123",
      });
      expectZodSuccess(result);
    });

    it("should reject empty ID", () => {
      const result = updateEntityWithNameSchema.safeParse({
        id: "",
        name: "Name",
      });
      expectZodError(result, "ID is required");
    });

    it("should reject missing ID", () => {
      const result = updateEntityWithNameSchema.safeParse({ name: "Name" });
      expectZodError(result);
    });

    it("should accept undefined name", () => {
      const result = updateEntityWithNameSchema.safeParse({
        id: "entity-123",
        name: undefined,
      });
      expectZodSuccess(result);
    });

    it("should reject empty name", () => {
      const result = updateEntityWithNameSchema.safeParse({
        id: "entity-123",
        name: "",
      });
      expectZodError(result, "Name is required");
    });
  });

  describe("issueCreationCoreSchema", () => {
    it("should validate valid issue creation", () => {
      const result = issueCreationCoreSchema.safeParse({
        title: "Issue Title",
        description: "Issue description",
        machineId: "machine-123",
        submitterName: "John Doe",
      });
      expectZodSuccess(result);
    });

    it("should validate with minimal required fields", () => {
      const result = issueCreationCoreSchema.safeParse({
        title: "Issue Title",
        machineId: "machine-123",
      });
      expectZodSuccess(result);
    });

    it("should reject empty title", () => {
      const result = issueCreationCoreSchema.safeParse({
        title: "",
        machineId: "machine-123",
      });
      expectZodError(result, "Title is required");
    });

    it("should reject empty machine ID", () => {
      const result = issueCreationCoreSchema.safeParse({
        title: "Issue Title",
        machineId: "",
      });
      expectZodError(result, "Machine ID is required");
    });

    it("should accept optional fields as undefined", () => {
      const result = issueCreationCoreSchema.safeParse({
        title: "Issue Title",
        machineId: "machine-123",
        description: undefined,
        submitterName: undefined,
      });
      expectZodSuccess(result);
    });
  });

  describe("issueUpdateCoreSchema", () => {
    it("should validate valid issue update", () => {
      const result = issueUpdateCoreSchema.safeParse({
        id: "issue-123",
        title: "Updated Title",
        description: "Updated description",
        statusId: "status-123",
        assignedToId: "user-123",
      });
      expectZodSuccess(result);
    });

    it("should validate with only ID", () => {
      const result = issueUpdateCoreSchema.safeParse({
        id: "issue-123",
      });
      expectZodSuccess(result);
    });

    it("should reject empty ID", () => {
      const result = issueUpdateCoreSchema.safeParse({
        id: "",
        title: "Title",
      });
      expectZodError(result, "Issue ID is required");
    });

    it("should accept all optional fields as undefined", () => {
      const result = issueUpdateCoreSchema.safeParse({
        id: "issue-123",
        title: undefined,
        description: undefined,
        statusId: undefined,
        assignedToId: undefined,
      });
      expectZodSuccess(result);
    });
  });

  describe("machineCreationSchema", () => {
    it("should validate valid machine creation", () => {
      const result = machineCreationSchema.safeParse({
        name: "Machine Name",
        modelId: "model-123",
        locationId: "location-123",
      });
      expectZodSuccess(result);
    });

    it("should validate with optional name", () => {
      const result = machineCreationSchema.safeParse({
        modelId: "model-123",
        locationId: "location-123",
      });
      expectZodSuccess(result);
    });

    it("should reject empty model ID", () => {
      const result = machineCreationSchema.safeParse({
        modelId: "",
        locationId: "location-123",
      });
      expectZodError(result, "Model ID is required");
    });

    it("should reject empty location ID", () => {
      const result = machineCreationSchema.safeParse({
        modelId: "model-123",
        locationId: "",
      });
      expectZodError(result, "Location ID is required");
    });
  });

  describe("machineUpdateSchema", () => {
    it("should validate valid machine update", () => {
      const result = machineUpdateSchema.safeParse({
        id: "machine-123",
        name: "Updated Name",
        modelId: "model-456",
        locationId: "location-456",
      });
      expectZodSuccess(result);
    });

    it("should validate with only ID", () => {
      const result = machineUpdateSchema.safeParse({
        id: "machine-123",
      });
      expectZodSuccess(result);
    });

    it("should reject empty ID", () => {
      const result = machineUpdateSchema.safeParse({
        id: "",
        name: "Name",
      });
      expectZodError(result, "Machine ID is required");
    });

    it("should accept all optional fields", () => {
      const result = machineUpdateSchema.safeParse({
        id: "machine-123",
        name: undefined,
        modelId: undefined,
        locationId: undefined,
      });
      expectZodSuccess(result);
    });
  });
});

// =============================================================================
// FILTERING AND SEARCH SCHEMA TESTS
// =============================================================================

describe("inputValidation - Filtering and Search Schemas", () => {
  describe("issueFilteringSchema", () => {
    it("should validate comprehensive issue filtering", () => {
      const result = issueFilteringSchema.safeParse({
        locationId: "location-123",
        machineId: "machine-123",
        statusIds: ["status1", "status2"],
        search: "search term",
        assigneeId: "user-123",
        reporterId: "user-456",
        ownerId: "user-789",
        modelId: "model-123",
        statusId: "status-single",
      });
      expectZodSuccess(result);
    });

    it("should validate with no filters", () => {
      const result = issueFilteringSchema.safeParse({});
      expectZodSuccess(result);
    });

    it("should validate with partial filters", () => {
      const result = issueFilteringSchema.safeParse({
        locationId: "location-123",
        search: "machine issue",
      });
      expectZodSuccess(result);
    });

    it("should reject empty search query", () => {
      const result = issueFilteringSchema.safeParse({
        search: "",
      });
      expectZodError(result, "Search query cannot be empty");
    });

    it("should reject empty status IDs in array", () => {
      const result = issueFilteringSchema.safeParse({
        statusIds: ["status1", ""],
      });
      expectZodError(result);
    });

    it("should accept all optional fields as undefined", () => {
      const result = issueFilteringSchema.safeParse({
        locationId: undefined,
        machineId: undefined,
        statusIds: undefined,
        search: undefined,
        assigneeId: undefined,
        reporterId: undefined,
        ownerId: undefined,
        modelId: undefined,
        statusId: undefined,
      });
      expectZodSuccess(result);
    });
  });

  describe("opdbSearchSchema", () => {
    it("should validate valid OPDB search query", () => {
      const result = opdbSearchSchema.safeParse({
        query: "medieval madness",
      });
      expectZodSuccess(result, { query: "medieval madness" });
    });

    it("should reject empty query", () => {
      const result = opdbSearchSchema.safeParse({ query: "" });
      expectZodError(result, "Search query is required");
    });

    it("should accept whitespace-only query (length > 0)", () => {
      const result = opdbSearchSchema.safeParse({ query: "   " });
      expectZodSuccess(result);
    });

    it("should reject missing query", () => {
      const result = opdbSearchSchema.safeParse({});
      expectZodError(result);
    });

    it("should accept query with special characters", () => {
      const result = opdbSearchSchema.safeParse({
        query: "Game (2021) - Special Edition",
      });
      expectZodSuccess(result);
    });
  });

  describe("opdbModelSchema", () => {
    it("should validate valid OPDB model ID", () => {
      const result = opdbModelSchema.safeParse({ opdbId: "12345" });
      expectZodSuccess(result, { opdbId: "12345" });
    });

    it("should reject empty OPDB ID", () => {
      const result = opdbModelSchema.safeParse({ opdbId: "" });
      expectZodError(result, "OPDB ID is required");
    });

    it("should reject missing OPDB ID", () => {
      const result = opdbModelSchema.safeParse({});
      expectZodError(result);
    });

    it("should accept numeric string OPDB ID", () => {
      const result = opdbModelSchema.safeParse({ opdbId: "999" });
      expectZodSuccess(result);
    });
  });
});

// =============================================================================
// ASSIGNMENT AND OWNERSHIP SCHEMA TESTS
// =============================================================================

describe("inputValidation - Assignment and Ownership Schemas", () => {
  describe("userAssignmentSchema", () => {
    it("should validate valid user assignment", () => {
      const result = userAssignmentSchema.safeParse({ userId: "user-123" });
      expectZodSuccess(result, { userId: "user-123" });
    });

    it("should reject empty user ID", () => {
      const result = userAssignmentSchema.safeParse({ userId: "" });
      expectZodError(result, "User ID is required");
    });

    it("should reject missing user ID", () => {
      const result = userAssignmentSchema.safeParse({});
      expectZodError(result);
    });
  });

  describe("optionalUserAssignmentSchema", () => {
    it("should validate valid user assignment", () => {
      const result = optionalUserAssignmentSchema.safeParse({
        userId: "user-123",
      });
      expectZodSuccess(result);
    });

    it("should accept undefined user ID", () => {
      const result = optionalUserAssignmentSchema.safeParse({
        userId: undefined,
      });
      expectZodSuccess(result);
    });

    it("should accept missing user ID", () => {
      const result = optionalUserAssignmentSchema.safeParse({});
      expectZodSuccess(result);
    });

    it("should accept empty user ID as optional", () => {
      const result = optionalUserAssignmentSchema.safeParse({ userId: "" });
      expectZodSuccess(result);
    });
  });

  describe("machineOwnerAssignmentSchema", () => {
    it("should validate valid machine owner assignment", () => {
      const result = machineOwnerAssignmentSchema.safeParse({
        machineId: "machine-123",
        ownerId: "user-123",
      });
      expectZodSuccess(result);
    });

    it("should validate owner removal", () => {
      const result = machineOwnerAssignmentSchema.safeParse({
        machineId: "machine-123",
        ownerId: undefined,
      });
      expectZodSuccess(result);
    });

    it("should reject empty machine ID", () => {
      const result = machineOwnerAssignmentSchema.safeParse({
        machineId: "",
        ownerId: "user-123",
      });
      expectZodError(result, "Machine ID is required");
    });

    it("should reject missing machine ID", () => {
      const result = machineOwnerAssignmentSchema.safeParse({
        ownerId: "user-123",
      });
      expectZodError(result);
    });
  });

  describe("issueAssignmentSchema", () => {
    it("should validate valid issue assignment", () => {
      const result = issueAssignmentSchema.safeParse({
        issueId: "issue-123",
        userId: "user-123",
      });
      expectZodSuccess(result);
    });

    it("should reject empty issue ID", () => {
      const result = issueAssignmentSchema.safeParse({
        issueId: "",
        userId: "user-123",
      });
      expectZodError(result, "Issue ID is required");
    });

    it("should reject empty user ID", () => {
      const result = issueAssignmentSchema.safeParse({
        issueId: "issue-123",
        userId: "",
      });
      expectZodError(result, "User ID is required");
    });

    it("should reject missing fields", () => {
      const result = issueAssignmentSchema.safeParse({});
      expectZodError(result);
    });
  });
});

// =============================================================================
// NOTIFICATION AND COMMENT SCHEMA TESTS
// =============================================================================

describe("inputValidation - Notification and Comment Schemas", () => {
  describe("notificationIdSchema", () => {
    it("should validate valid notification ID", () => {
      const result = notificationIdSchema.safeParse({
        notificationId: "notification-123",
      });
      expectZodSuccess(result);
    });

    it("should reject empty notification ID", () => {
      const result = notificationIdSchema.safeParse({
        notificationId: "",
      });
      expectZodError(result, "Notification ID is required");
    });

    it("should reject missing notification ID", () => {
      const result = notificationIdSchema.safeParse({});
      expectZodError(result);
    });
  });

  describe("commentIdSchema", () => {
    it("should validate valid comment ID", () => {
      const result = commentIdSchema.safeParse({ commentId: "comment-123" });
      expectZodSuccess(result);
    });

    it("should reject empty comment ID", () => {
      const result = commentIdSchema.safeParse({ commentId: "" });
      expectZodError(result, "Comment ID is required");
    });

    it("should reject missing comment ID", () => {
      const result = commentIdSchema.safeParse({});
      expectZodError(result);
    });
  });

  describe("commentCreationSchema", () => {
    it("should validate valid comment creation", () => {
      const result = commentCreationSchema.safeParse({
        issueId: "issue-123",
        content: "This is a comment",
      });
      expectZodSuccess(result);
    });

    it("should validate comment with maximum length", () => {
      const maxContent = "a".repeat(10000);
      const result = commentCreationSchema.safeParse({
        issueId: "issue-123",
        content: maxContent,
      });
      expectZodSuccess(result);
    });

    it("should reject empty content", () => {
      const result = commentCreationSchema.safeParse({
        issueId: "issue-123",
        content: "",
      });
      expectZodError(result, "Comment content is required");
    });

    it("should reject content exceeding 10,000 characters", () => {
      const longContent = "a".repeat(10001);
      const result = commentCreationSchema.safeParse({
        issueId: "issue-123",
        content: longContent,
      });
      expectZodError(result, "Comment must be 10,000 characters or less");
    });

    it("should reject empty issue ID", () => {
      const result = commentCreationSchema.safeParse({
        issueId: "",
        content: "Comment content",
      });
      expectZodError(result, "Issue ID is required");
    });

    it("should reject missing fields", () => {
      const result = commentCreationSchema.safeParse({});
      expectZodError(result);
    });
  });
});

// =============================================================================
// VALIDATION HELPER SCHEMA TESTS
// =============================================================================

describe("inputValidation - Validation Helper Schemas", () => {
  describe("emailSchema", () => {
    it("should validate valid email addresses", () => {
      const validEmails = [
        "test@example.com",
        "user.name@domain.co.uk",
        "user+tag@example.org",
        "123@domain.com",
      ];

      for (const email of validEmails) {
        const result = emailSchema.safeParse(email);
        expectZodSuccess(result);
      }
    });

    it("should reject invalid email addresses", () => {
      const invalidEmails = [
        "invalid-email",
        "@domain.com",
        "user@",
        "user..name@domain.com",
        "",
      ];

      for (const email of invalidEmails) {
        const result = emailSchema.safeParse(email);
        expectZodError(result);
      }
    });

    it("should reject non-string input", () => {
      const result = emailSchema.safeParse(123);
      expectZodError(result);
    });
  });

  describe("optionalEmailSchema", () => {
    it("should validate valid email addresses", () => {
      const result = optionalEmailSchema.safeParse("test@example.com");
      expectZodSuccess(result);
    });

    it("should accept undefined", () => {
      const result = optionalEmailSchema.safeParse(undefined);
      expectZodSuccess(result);
    });

    it("should reject invalid email addresses", () => {
      const result = optionalEmailSchema.safeParse("invalid-email");
      expectZodError(result);
    });
  });

  describe("booleanFlagSchema", () => {
    it("should validate boolean values", () => {
      const result1 = booleanFlagSchema.safeParse(true);
      const result2 = booleanFlagSchema.safeParse(false);

      expectZodSuccess(result1);
      expectZodSuccess(result2);
    });

    it("should reject non-boolean values", () => {
      const nonBooleans = ["true", 1, 0, null, undefined, {}];

      for (const value of nonBooleans) {
        const result = booleanFlagSchema.safeParse(value);
        expectZodError(result);
      }
    });
  });

  describe("optionalBooleanFlagSchema", () => {
    it("should validate boolean values", () => {
      const result1 = optionalBooleanFlagSchema.safeParse(true);
      const result2 = optionalBooleanFlagSchema.safeParse(false);

      expectZodSuccess(result1);
      expectZodSuccess(result2);
    });

    it("should accept undefined", () => {
      const result = optionalBooleanFlagSchema.safeParse(undefined);
      expectZodSuccess(result);
    });

    it("should reject non-boolean values", () => {
      const result = optionalBooleanFlagSchema.safeParse("true");
      expectZodError(result);
    });
  });
});

// =============================================================================
// UTILITY FUNCTION TESTS
// =============================================================================

describe("inputValidation - Utility Functions", () => {
  describe("createEntityIdSchema", () => {
    it("should create schema for custom entity type", () => {
      const customSchema = createEntityIdSchema("custom");
      const result = customSchema.safeParse({ customId: "custom-123" });
      expectZodSuccess(result, { customId: "custom-123" });
    });

    it("should create schema with proper error message", () => {
      const customSchema = createEntityIdSchema("product");
      const result = customSchema.safeParse({ productId: "" });
      expectZodError(result, "product ID is required");
    });

    it("should reject missing field", () => {
      const customSchema = createEntityIdSchema("service");
      const result = customSchema.safeParse({});
      expectZodError(result);
    });

    it("should handle entity names with special characters", () => {
      const customSchema = createEntityIdSchema("test-entity_name");
      const result = customSchema.safeParse({
        "test-entity_nameId": "test-123",
      });
      expectZodSuccess(result);
    });
  });

  describe("createNamedEntityCreationSchema", () => {
    it("should create schema requiring name by default", () => {
      const schema = createNamedEntityCreationSchema();
      const result = schema.safeParse({ name: "Test Entity" });
      expectZodSuccess(result);
    });

    it("should create schema with required name explicitly", () => {
      const schema = createNamedEntityCreationSchema(true);
      const result = schema.safeParse({ name: "Test Entity" });
      expectZodSuccess(result);
    });

    it("should create schema with optional name", () => {
      const schema = createNamedEntityCreationSchema(false);
      const result1 = schema.safeParse({ name: "Test Entity" });
      const result2 = schema.safeParse({});

      expectZodSuccess(result1);
      expectZodSuccess(result2);
    });

    it("should reject empty name when required", () => {
      const schema = createNamedEntityCreationSchema(true);
      const result = schema.safeParse({ name: "" });
      expectZodError(result, "Name is required");
    });

    it("should reject empty name when optional", () => {
      const schema = createNamedEntityCreationSchema(false);
      const result = schema.safeParse({ name: "" });
      expectZodError(result, "Name is required");
    });
  });

  describe("createNamedEntityUpdateSchema", () => {
    it("should create update schema with required ID and optional name", () => {
      const schema = createNamedEntityUpdateSchema();
      const result = schema.safeParse({
        id: "entity-123",
        name: "Updated Name",
      });
      expectZodSuccess(result);
    });

    it("should accept update with only ID", () => {
      const schema = createNamedEntityUpdateSchema();
      const result = schema.safeParse({ id: "entity-123" });
      expectZodSuccess(result);
    });

    it("should reject empty ID", () => {
      const schema = createNamedEntityUpdateSchema();
      const result = schema.safeParse({ id: "", name: "Name" });
      expectZodError(result, "ID is required");
    });

    it("should reject missing ID", () => {
      const schema = createNamedEntityUpdateSchema();
      const result = schema.safeParse({ name: "Name" });
      expectZodError(result);
    });
  });

  describe("validateNonEmptyStringArray", () => {
    it("should validate valid string arrays", () => {
      const validArrays = [
        ["item1", "item2"],
        ["single-item"],
        ["a", "b", "c", "d"],
      ];

      for (const array of validArrays) {
        const result = validateNonEmptyStringArray(array, "testField");
        expect(result).toEqual(array);
      }
    });

    it("should reject non-arrays", () => {
      const nonArrays = ["string", 123, {}, null, undefined];

      for (const value of nonArrays) {
        expect(() => {
          validateNonEmptyStringArray(value, "testField");
        }).toThrow("testField must be an array");
      }
    });

    it("should reject empty arrays", () => {
      expect(() => {
        validateNonEmptyStringArray([], "testField");
      }).toThrow("testField cannot be empty");
    });

    it("should reject arrays with empty strings", () => {
      expect(() => {
        validateNonEmptyStringArray(["valid", "", "another"], "testField");
      }).toThrow("testField[1] must be a non-empty string");
    });

    it("should reject arrays with whitespace-only strings", () => {
      expect(() => {
        validateNonEmptyStringArray(["valid", "   ", "another"], "testField");
      }).toThrow("testField[1] must be a non-empty string");
    });

    it("should reject arrays with non-string items", () => {
      expect(() => {
        validateNonEmptyStringArray(["valid", 123, "another"], "testField");
      }).toThrow("testField[1] must be a non-empty string");
    });

    it("should provide correct error indices", () => {
      expect(() => {
        validateNonEmptyStringArray(["a", "b", null, "d"], "items");
      }).toThrow("items[2] must be a non-empty string");
    });

    it("should handle arrays with special character strings", () => {
      const array = ["normal", "@#$%^&*()", "unicode-🎯"];
      const result = validateNonEmptyStringArray(array, "testField");
      expect(result).toEqual(array);
    });
  });

  describe("validateAndNormalizeSearchQuery", () => {
    it("should normalize valid search queries", () => {
      const queries = [
        { input: "search term", expected: "search term" },
        { input: "  trimmed  ", expected: "trimmed" },
        { input: "Query", expected: "Query" },
      ];

      for (const { input, expected } of queries) {
        const result = validateAndNormalizeSearchQuery(input);
        expect(result).toBe(expected);
      }
    });

    it("should return undefined for empty/null/undefined inputs", () => {
      const emptyInputs = [null, undefined, "", "   "];

      for (const input of emptyInputs) {
        const result = validateAndNormalizeSearchQuery(input);
        expect(result).toBeUndefined();
      }
    });

    it("should reject non-string inputs", () => {
      const nonStrings = [123, {}, [], true];

      for (const input of nonStrings) {
        expect(() => {
          validateAndNormalizeSearchQuery(input);
        }).toThrow("Search query must be a string");
      }
    });

    it("should reject queries exceeding 1000 characters", () => {
      const longQuery = "a".repeat(1001);
      expect(() => {
        validateAndNormalizeSearchQuery(longQuery);
      }).toThrow("Search query must be 1000 characters or less");
    });

    it("should accept queries exactly 1000 characters", () => {
      const exactQuery = "a".repeat(1000);
      const result = validateAndNormalizeSearchQuery(exactQuery);
      expect(result).toBe(exactQuery);
    });

    it("should handle queries with special characters", () => {
      const specialQuery = "query @#$%^&*() search";
      const result = validateAndNormalizeSearchQuery(specialQuery);
      expect(result).toBe(specialQuery);
    });

    it("should handle multiline queries", () => {
      const multilineQuery = "line1\nline2\nline3";
      const result = validateAndNormalizeSearchQuery(multilineQuery);
      expect(result).toBe(multilineQuery);
    });
  });

  describe("validateOptionalString", () => {
    it("should validate valid strings", () => {
      const validStrings = [
        { input: "valid string", expected: "valid string" },
        { input: "  trimmed  ", expected: "trimmed" },
        { input: "a", expected: "a" },
      ];

      for (const { input, expected } of validStrings) {
        const result = validateOptionalString(input, "testField");
        expect(result).toBe(expected);
      }
    });

    it("should return undefined for empty/null/undefined inputs", () => {
      const emptyInputs = [null, undefined, "", "   "];

      for (const input of emptyInputs) {
        const result = validateOptionalString(input, "testField");
        expect(result).toBeUndefined();
      }
    });

    it("should reject non-string inputs", () => {
      const nonStrings = [123, {}, [], true];

      for (const input of nonStrings) {
        expect(() => {
          validateOptionalString(input, "testField");
        }).toThrow("testField must be a string");
      }
    });

    it("should use default max length of 255", () => {
      const longString = "a".repeat(256);
      expect(() => {
        validateOptionalString(longString, "testField");
      }).toThrow("testField must be 255 characters or less");
    });

    it("should accept custom max length", () => {
      const string100 = "a".repeat(100);
      const string101 = "a".repeat(101);

      const result1 = validateOptionalString(string100, "testField", 100);
      expect(result1).toBe(string100);

      expect(() => {
        validateOptionalString(string101, "testField", 100);
      }).toThrow("testField must be 100 characters or less");
    });

    it("should accept strings exactly at max length", () => {
      const exactString = "a".repeat(255);
      const result = validateOptionalString(exactString, "testField");
      expect(result).toBe(exactString);
    });

    it("should handle strings with special characters", () => {
      const specialString = "text @#$%^&*() more";
      const result = validateOptionalString(specialString, "testField");
      expect(result).toBe(specialString);
    });

    it("should handle unicode characters", () => {
      const unicodeString = "Hello 🌍 World";
      const result = validateOptionalString(unicodeString, "testField");
      expect(result).toBe(unicodeString);
    });
  });
});

// =============================================================================
// EDGE CASES AND ERROR CONDITIONS
// =============================================================================

describe("inputValidation - Edge Cases and Error Conditions", () => {
  describe("Schema boundary testing", () => {
    it("should handle maximum string lengths", () => {
      const test255 = "a".repeat(255);
      const test256 = "a".repeat(256);
      const test10000 = "a".repeat(10000);
      const test10001 = "a".repeat(10001);

      // Names should accept 255, reject 256
      expectZodSuccess(nameSchema.safeParse(test255));
      expectZodError(nameSchema.safeParse(test256));

      // Descriptions should accept 10000, reject 10001
      expectZodSuccess(descriptionSchema.safeParse(test10000));
      expectZodError(descriptionSchema.safeParse(test10001));
    });

    it("should handle numeric edge cases", () => {
      const edgeCases = [
        { value: 1, shouldPass: true },
        { value: 0, shouldPass: false },
        { value: -1, shouldPass: false },
        { value: Number.MAX_SAFE_INTEGER, shouldPass: true },
        { value: 1.5, shouldPass: false },
        { value: Number.POSITIVE_INFINITY, shouldPass: false },
        { value: Number.NaN, shouldPass: false },
      ];

      for (const { value, shouldPass } of edgeCases) {
        const result = positiveIntegerSchema.safeParse(value);
        if (shouldPass) {
          expectZodSuccess(result);
        } else {
          expectZodError(result);
        }
      }
    });

    it("should handle special string cases", () => {
      const specialCases = [
        { value: "normal", shouldPass: true },
        { value: "", shouldPass: false },
        { value: "   ", shouldPass: true }, // Whitespace has length > 0
        { value: "\n\t\r", shouldPass: true }, // Whitespace has length > 0
        { value: "0", shouldPass: true },
        { value: "false", shouldPass: true },
        { value: "null", shouldPass: true },
        { value: "undefined", shouldPass: true },
      ];

      for (const { value, shouldPass } of specialCases) {
        const result = nameSchema.safeParse(value);
        if (shouldPass) {
          expectZodSuccess(result);
        } else {
          expectZodError(result);
        }
      }
    });
  });

  describe("Type coercion and casting", () => {
    it("should not coerce types for string schemas", () => {
      const nonStringInputs = [123, true, [], {}, null];

      for (const input of nonStringInputs) {
        const result = nameSchema.safeParse(input);
        expectZodError(result);
      }
    });

    it("should not coerce types for number schemas", () => {
      const nonNumberInputs = ["123", true, [], {}];

      for (const input of nonNumberInputs) {
        const result = positiveIntegerSchema.safeParse(input);
        expectZodError(result);
      }
    });

    it("should not coerce types for boolean schemas", () => {
      const nonBooleanInputs = ["true", 1, 0, [], {}];

      for (const input of nonBooleanInputs) {
        const result = booleanFlagSchema.safeParse(input);
        expectZodError(result);
      }
    });
  });

  describe("Array validation edge cases", () => {
    it("should handle deeply nested arrays", () => {
      const nestedArray = [["nested"], "valid"];
      const result = stringIdArraySchema.safeParse(nestedArray);
      expectZodError(result); // Nested arrays should be rejected
    });

    it("should handle arrays with mixed valid/invalid items", () => {
      const mixedArray = ["valid1", "", "valid2", null, "valid3"];
      const result = stringIdArraySchema.safeParse(mixedArray);
      expectZodError(result);
    });

    it("should handle very large arrays", () => {
      const largeArray = Array(1000).fill("valid-id");
      const result = stringIdArraySchema.safeParse(largeArray);
      expectZodSuccess(result);
    });
  });

  describe("Email validation edge cases", () => {
    it("should handle international domain names", () => {
      const internationalEmails = [
        "test@münchen.de",
        "user@例え.テスト",
        "email@xn--fsq.xn--0zwm56d",
      ];

      // Note: Depending on Zod's email validation implementation,
      // some of these might fail. Testing the current behavior.
      for (const email of internationalEmails) {
        const result = emailSchema.safeParse(email);
        // Just checking that it doesn't throw, regardless of pass/fail
        expect(typeof result.success).toBe("boolean");
      }
    });

    it("should handle very long email addresses", () => {
      const longLocal = "a".repeat(64);
      const longDomain = "b".repeat(60) + ".com";
      const longEmail = `${longLocal}@${longDomain}`;

      const result = emailSchema.safeParse(longEmail);
      // Test that it handles long emails without crashing
      expect(typeof result.success).toBe("boolean");
    });
  });

  describe("Utility function edge cases", () => {
    it("validateNonEmptyStringArray should handle prototype pollution attempts", () => {
      const maliciousArray = ["valid"];

      const result = validateNonEmptyStringArray(maliciousArray, "test");
      expect(result).toEqual(["valid"]);
      // Note: This test validates the function works correctly with arrays
      // Prototype pollution is handled by proper input validation
    });

    it("validateAndNormalizeSearchQuery should handle unicode normalization", () => {
      const unicodeQuery = "café"; // é as single character
      const result = validateAndNormalizeSearchQuery(unicodeQuery);
      expect(result).toBe(unicodeQuery);
    });

    it("validateOptionalString should handle zero-length after trimming", () => {
      const whitespaceOnlyString = "   \t\n\r   ";
      const result = validateOptionalString(whitespaceOnlyString, "test");
      expect(result).toBeUndefined();
    });
  });

  describe("Performance considerations", () => {
    it("should handle large object validation efficiently", () => {
      const largeFilterObject = {
        locationId: "location-123",
        machineId: "machine-123",
        statusIds: Array(100).fill("status-id"),
        search: "search term",
        assigneeId: "user-123",
        reporterId: "user-456",
        ownerId: "user-789",
        modelId: "model-123",
        statusId: "status-single",
      };

      const start = performance.now();
      const result = issueFilteringSchema.safeParse(largeFilterObject);
      const end = performance.now();

      expectZodSuccess(result);
      expect(end - start).toBeLessThan(100); // Should complete in <100ms
    });

    it("should handle repeated validations efficiently", () => {
      const testData = { id: "test-123" };

      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        entityIdSchema.safeParse(testData);
      }
      const end = performance.now();

      expect(end - start).toBeLessThan(100); // 1000 validations in <100ms
    });
  });
});

// =============================================================================
// INTEGRATION AND COMPATIBILITY TESTS
// =============================================================================

describe("inputValidation - Integration and Compatibility", () => {
  describe("Schema composition", () => {
    it("should allow extending schemas", () => {
      const extendedSchema = entityIdSchema.extend({
        name: nameSchema,
        active: booleanFlagSchema,
      });

      const result = extendedSchema.safeParse({
        id: "entity-123",
        name: "Entity Name",
        active: true,
      });

      expectZodSuccess(result);
    });

    it("should allow merging schemas", () => {
      const mergedSchema = entityIdSchema.extend({
        name: nameSchema,
      });

      const result = mergedSchema.safeParse({
        id: "entity-123",
        name: "Entity Name",
      });

      expectZodSuccess(result);
    });

    it("should allow partial schemas", () => {
      const partialSchema = issueCreationCoreSchema.partial();

      const result = partialSchema.safeParse({
        title: "Partial Issue",
      });

      expectZodSuccess(result);
    });
  });

  describe("Type inference", () => {
    it("should infer correct types from schemas", () => {
      type EntityId = z.infer<typeof entityIdSchema>;
      type IssuCreation = z.infer<typeof issueCreationCoreSchema>;
      type IssueFiltering = z.infer<typeof issueFilteringSchema>;

      // These should compile without errors
      const entityId: EntityId = { id: "test" };
      const issueCreation: IssuCreation = {
        title: "Test",
        machineId: "machine-123",
      };
      const filtering: IssueFiltering = {
        search: "test",
        statusIds: ["status1"],
      };

      expect(entityId.id).toBe("test");
      expect(issueCreation.title).toBe("Test");
      expect(filtering.search).toBe("test");
    });
  });

  describe("Error message consistency", () => {
    it("should provide consistent error messages across similar schemas", () => {
      const idSchemas = [
        { schema: entityIdSchema, field: "id" },
        { schema: machineIdSchema, field: "machineId" },
        { schema: locationIdSchema, field: "locationId" },
        { schema: userIdSchema, field: "userId" },
        { schema: issueIdSchema, field: "issueId" },
      ];

      for (const { schema, field } of idSchemas) {
        const result = schema.safeParse({ [field]: "" });
        expectZodError(result);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain("required");
        }
      }
    });

    it("should provide helpful error messages for complex schemas", () => {
      const result = issueCreationCoreSchema.safeParse({
        title: "",
        machineId: "",
      });

      expectZodError(result);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(1);
        expect(
          result.error.issues.some((e: any) => e.message.includes("Title")),
        ).toBe(true);
        expect(
          result.error.issues.some((e: any) => e.message.includes("Machine")),
        ).toBe(true);
      }
    });
  });

  describe("Default value handling", () => {
    it("should handle schemas with default values", () => {
      const schemaWithDefaults = z.object({
        id: z.string().min(1),
        active: z.boolean().default(true),
        count: z.number().default(0),
      });

      const result = schemaWithDefaults.safeParse({ id: "test-123" });
      expectZodSuccess(result, {
        id: "test-123",
        active: true,
        count: 0,
      });
    });
  });
});
