/**
 * Golden Example: Type-Safe Testing with Generated Zod Schemas
 *
 * This file demonstrates the optimal pattern for creating tests using
 * automatically generated Zod schemas from Prisma models. This approach
 * ensures type safety, validates mock data structure, and provides
 * LLM agents with clear examples of proper testing patterns.
 */

import { jest } from "@jest/globals";

import {
  UserSchema,
  UserCreateInputSchema,
  IssueSchema,
  IssueUncheckedCreateInputSchema,
  MachineSchema,
} from "../../../../prisma/generated/zod";
import { createMockContext, type MockContext } from "../../../test/mockContext";

// Import generated Zod schemas for validation

// Import Prisma types for type checking
import type { User, Issue, Machine } from "@prisma/client";

describe("Golden Example: Schema-Validated Testing", () => {
  let ctx: MockContext;

  beforeEach(() => {
    ctx = createMockContext();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("User Operations with Schema Validation", () => {
    it("should create user with schema-validated mock data", async () => {
      // ✅ Generate type-safe mock data using Zod schema validation
      const mockUserData: User = UserSchema.parse({
        id: "clh7xkg7w0000x9yz0qj3k1vq",
        name: "Test User",
        email: "test@example.com",
        emailVerified: null,
        image: null,
        createdAt: new Date("2024-01-01T00:00:00Z"),
        updatedAt: new Date("2024-01-01T00:00:00Z"),
        bio: null,
        profilePicture: null,
        emailNotificationsEnabled: true,
        pushNotificationsEnabled: false,
        notificationFrequency: "IMMEDIATE",
      });

      // ✅ Validate input data against generated input schema
      const inputData = UserCreateInputSchema.parse({
        name: "Test User",
        email: "test@example.com",
        emailNotificationsEnabled: true,
        notificationFrequency: "IMMEDIATE",
      });

      // Mock Prisma response
      ctx.db.user.create.mockResolvedValue(mockUserData);

      // Execute the operation (this would be your actual service/router call)
      const result = await ctx.db.user.create({ data: inputData });

      // Assertions
      expect(result).toEqual(mockUserData);
      expect(ctx.db.user.create).toHaveBeenCalledWith({
        data: inputData,
      });

      // ✅ Verify the result matches the schema
      expect(() => UserSchema.parse(result)).not.toThrow();
    });

    it("should handle validation errors gracefully", () => {
      // ❌ This should fail schema validation
      expect(() => {
        UserSchema.parse({
          id: "invalid-id", // Invalid CUID format
          email: "test@example.com",
          // Missing required fields
        });
      }).toThrow();

      // ✅ This should pass validation
      expect(() => {
        UserCreateInputSchema.parse({
          email: "test@example.com",
          name: "Valid User",
        });
      }).not.toThrow();
    });
  });

  describe("Issue Operations with Schema Validation", () => {
    it("should create issue with proper relationships", async () => {
      // ✅ Create machine mock data first
      const mockMachine: Machine = MachineSchema.parse({
        id: "clh7xkg7w0001x9yz0qj3k1vq",
        name: "Medieval Madness #1",
        organizationId: "clh7xkg7w0002x9yz0qj3k1vq",
        locationId: "clh7xkg7w0007x9yz0qj3k1vq",
        modelId: "clh7xkg7w0003x9yz0qj3k1vq",
        ownerId: "clh7xkg7w0000x9yz0qj3k1vq",
        ownerNotificationsEnabled: true,
        notifyOnNewIssues: true,
        notifyOnStatusChanges: true,
        notifyOnComments: false,
        qrCodeId: "clh7xkg7w0004x9yz0qj3k1vq",
        qrCodeUrl: null,
        qrCodeGeneratedAt: null,
      });

      // ✅ Create issue mock data with validated structure
      const mockIssue: Issue = IssueSchema.parse({
        id: "clh7xkg7w0008x9yz0qj3k1vq",
        title: "Flipper not working",
        description: "Left flipper is unresponsive",
        consistency: "Always",
        checklist: null,
        createdAt: new Date("2024-01-01T00:00:00Z"),
        updatedAt: new Date("2024-01-01T00:00:00Z"),
        resolvedAt: null,
        organizationId: "clh7xkg7w0002x9yz0qj3k1vq",
        machineId: "clh7xkg7w0001x9yz0qj3k1vq",
        statusId: "clh7xkg7w0005x9yz0qj3k1vq",
        priorityId: "clh7xkg7w0006x9yz0qj3k1vq",
        createdById: "clh7xkg7w0000x9yz0qj3k1vq",
        assignedToId: null,
      });

      // ✅ Validate input data structure
      const issueInput = IssueUncheckedCreateInputSchema.parse({
        title: "Flipper not working",
        description: "Left flipper is unresponsive",
        consistency: "Always",
        organizationId: "clh7xkg7w0002x9yz0qj3k1vq",
        machineId: "clh7xkg7w0001x9yz0qj3k1vq",
        statusId: "clh7xkg7w0005x9yz0qj3k1vq",
        priorityId: "clh7xkg7w0006x9yz0qj3k1vq",
        createdById: "clh7xkg7w0000x9yz0qj3k1vq",
      });

      // Mock Prisma responses
      ctx.db.machine.findUnique.mockResolvedValue(mockMachine);
      ctx.db.issue.create.mockResolvedValue(mockIssue);

      // Execute operations
      const machine = await ctx.db.machine.findUnique({
        where: { id: "clh7xkg7w0001x9yz0qj3k1vq" },
      });
      const issue = await ctx.db.issue.create({ data: issueInput });

      // Assertions with schema validation
      expect(machine).toEqual(mockMachine);
      expect(issue).toEqual(mockIssue);
      expect(() => MachineSchema.parse(machine)).not.toThrow();
      expect(() => IssueSchema.parse(issue)).not.toThrow();
    });
  });

  describe("Schema Utility Functions", () => {
    it("should provide type-safe mock data generation helpers", () => {
      // ✅ Helper function for creating valid mock data
      const createValidUser = (overrides: Partial<User> = {}): User => {
        const baseUser = {
          id: "clh7xkg7w0009x9yz0qj3k1vq",
          name: "Default User",
          email: "default@example.com",
          emailVerified: null,
          image: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          bio: null,
          profilePicture: null,
          emailNotificationsEnabled: true,
          pushNotificationsEnabled: false,
          notificationFrequency: "IMMEDIATE" as const,
        };

        const userData = { ...baseUser, ...overrides };

        // ✅ Always validate with schema
        return UserSchema.parse(userData);
      };

      // Test the helper
      const user1 = createValidUser();
      const user2 = createValidUser({
        name: "Custom User",
        email: "custom@example.com",
      });

      expect(user1.name).toBe("Default User");
      expect(user2.name).toBe("Custom User");
      expect(() => UserSchema.parse(user1)).not.toThrow();
      expect(() => UserSchema.parse(user2)).not.toThrow();
    });

    it("should demonstrate schema-driven field requirements", () => {
      // The schemas tell us exactly what fields are required vs optional

      // ✅ Minimal valid user creation (only required fields)
      const minimalUserInput = UserCreateInputSchema.parse({
        // All fields are optional in UserCreateInput due to defaults
      });

      // ✅ Full user data (demonstrates all available fields)
      const fullUserInput = UserCreateInputSchema.parse({
        name: "Full User",
        email: "full@example.com",
        bio: "Test bio",
        emailNotificationsEnabled: false,
        pushNotificationsEnabled: true,
        notificationFrequency: "DAILY",
      });

      expect(minimalUserInput).toBeDefined();
      expect(fullUserInput.name).toBe("Full User");
    });
  });
});

/**
 * Key Benefits Demonstrated:
 *
 * 1. **Type Safety**: All mock data is validated against generated schemas
 * 2. **Schema Compliance**: Tests ensure data matches exactly what Prisma expects
 * 3. **Agent Friendly**: Clear patterns for LLM agents to follow
 * 4. **Validation**: Automatic detection of invalid mock data
 * 5. **Documentation**: Schemas serve as living documentation of data structure
 * 6. **Maintainability**: Schema changes automatically update test requirements
 */

export {
  UserSchema,
  UserCreateInputSchema,
  IssueSchema,
  IssueCreateInputSchema,
};
