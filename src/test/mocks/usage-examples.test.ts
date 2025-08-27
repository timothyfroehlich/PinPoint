/**
 * Mock System Usage Examples
 * Demonstrates how to use seed-based mocks across different test archetypes
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  SeedBasedMockFactory,
  MockAuthContextFactory,
  MockDatabaseFactory,
  MockFormDataFactory,
  MockScenarioFactory,
  SEED_TEST_IDS,
} from "./seed-based-mocks";

describe("Mock System Usage Examples", () => {
  
  describe("Archetype 1: Unit Tests - Using Individual Mocks", () => {
    it("demonstrates creating individual mock entities", () => {
      // Create individual mock entities with defaults
      const mockUser = SeedBasedMockFactory.createMockUser();
      const mockOrganization = SeedBasedMockFactory.createMockOrganization();
      const mockMachine = SeedBasedMockFactory.createMockMachine();
      const mockIssue = SeedBasedMockFactory.createMockIssue();

      // Verify mock structure matches expectations
      expect(mockUser.id).toBe(SEED_TEST_IDS.USERS.ADMIN);
      expect(mockUser.organization_id).toBe(SEED_TEST_IDS.ORGANIZATIONS.primary);
      expect(mockOrganization.id).toBe(SEED_TEST_IDS.ORGANIZATIONS.primary);
      expect(mockMachine.organization_id).toBe(SEED_TEST_IDS.ORGANIZATIONS.primary);
      expect(mockIssue.machine_id).toBe(SEED_TEST_IDS.MOCK_PATTERNS.MACHINE);

      // All entities should be properly linked through seed IDs
      expect(mockIssue.created_by_id).toBe(mockUser.id);
      expect(mockIssue.organization_id).toBe(mockOrganization.id);
    });

    it("demonstrates creating mocks with overrides", () => {
      // Create mock with custom values
      const customUser = SeedBasedMockFactory.createMockUser({
        name: "Custom Test User",
        email: "custom@test.dev"
      });

      expect(customUser.name).toBe("Custom Test User");
      expect(customUser.email).toBe("custom@test.dev");
      expect(customUser.id).toBe(SEED_TEST_IDS.USERS.ADMIN); // Still uses seed ID
      expect(customUser.organization_id).toBe(SEED_TEST_IDS.ORGANIZATIONS.primary);
    });

    it("demonstrates creating collections of mocks", () => {
      const issues = SeedBasedMockFactory.createMockIssues(5);
      const statuses = SeedBasedMockFactory.createMockIssueStatuses();
      const priorities = SeedBasedMockFactory.createMockPriorities();

      expect(issues).toHaveLength(5);
      expect(statuses).toHaveLength(4); // Open, In Progress, Resolved, Closed
      expect(priorities).toHaveLength(4); // Low, Medium, High, Urgent

      // Issues should have varied but realistic data
      const issueStatuses = [...new Set(issues.map(i => i.status_id))];
      expect(issueStatuses.length).toBeGreaterThan(1); // Different statuses
    });
  });

  describe("Archetype 2: DAL Tests - Using Auth and Database Mocks", () => {
    let mockDbClient: ReturnType<typeof MockDatabaseFactory.createMockDbClient>;

    beforeEach(() => {
      mockDbClient = MockDatabaseFactory.createMockDbClient();
    });

    it("demonstrates mocking DAL functions with realistic data", async () => {
      // Mock auth context
      const authContext = MockAuthContextFactory.createPrimaryOrgContext();
      
      // Mock database would return our seed-based data
      const expectedIssues = SeedBasedMockFactory.createMockIssues(3);
      mockDbClient.query.issues.findMany.mockResolvedValue(expectedIssues);

      // In a real DAL test, you'd test the actual function
      // const issues = await getIssuesForOrg();
      
      // Verify the mock data structure
      const issues = await mockDbClient.query.issues.findMany();
      
      expect(issues).toHaveLength(3);
      expect(issues[0].organization_id).toBe(SEED_TEST_IDS.ORGANIZATIONS.primary);
      expect(issues.every(issue => issue.machine_id === SEED_TEST_IDS.MOCK_PATTERNS.MACHINE)).toBe(true);
    });

    it("demonstrates cross-organization security testing", () => {
      const scenario = MockScenarioFactory.createCrossOrgSecurityScenario();
      
      // Primary org should only see their data
      expect(scenario.primaryOrg.issues[0].organization_id).toBe(SEED_TEST_IDS.ORGANIZATIONS.primary);
      
      // Competitor org should only see their data
      expect(scenario.competitorOrg.issues[0].organization_id).toBe(SEED_TEST_IDS.ORGANIZATIONS.competitor);
      
      // Organizations should be completely separate
      expect(scenario.primaryOrg.organization.id).not.toBe(scenario.competitorOrg.organization.id);
    });
  });

  describe("Archetype 3: Server Action Tests - Using FormData Mocks", () => {
    it("demonstrates valid FormData creation", () => {
      const formData = MockFormDataFactory.createValidIssueFormData();
      
      // Verify FormData contains expected fields
      expect(formData.get("title")).toBe("Test Issue from Mock");
      expect(formData.get("machineId")).toBe(SEED_TEST_IDS.MOCK_PATTERNS.MACHINE);
      expect(formData.get("priority")).toBe("medium");
      expect(formData.get("assigneeId")).toBe(SEED_TEST_IDS.USERS.ADMIN);
    });

    it("demonstrates FormData with overrides", () => {
      const formData = MockFormDataFactory.createValidIssueFormData({
        title: "Custom Issue Title",
        priority: "high"
      });
      
      expect(formData.get("title")).toBe("Custom Issue Title");
      expect(formData.get("priority")).toBe("high");
      expect(formData.get("machineId")).toBe(SEED_TEST_IDS.MOCK_PATTERNS.MACHINE); // Still uses default
    });

    it("demonstrates invalid FormData for validation testing", () => {
      const formData = MockFormDataFactory.createInvalidFormData();
      
      expect(formData.get("title")).toBe(""); // Invalid: empty
      expect(formData.get("machineId")).toBe("not-a-uuid"); // Invalid: not UUID
      expect(formData.get("priority")).toBe("invalid-priority"); // Invalid: not enum value
    });

    it("demonstrates status update FormData", () => {
      const formData = MockFormDataFactory.createValidStatusUpdateFormData("status-resolved");
      
      expect(formData.get("statusId")).toBe("status-resolved");
    });
  });

  describe("Archetype 4: Integration Tests - Using Complete Scenarios", () => {
    it("demonstrates primary organization scenario", () => {
      const scenario = MockScenarioFactory.createPrimaryOrgScenario();
      
      // Complete scenario has all related entities
      expect(scenario.organization).toBeDefined();
      expect(scenario.users).toHaveLength(1);
      expect(scenario.machines).toHaveLength(1);
      expect(scenario.issues).toHaveLength(3);
      expect(scenario.statuses).toHaveLength(4);
      expect(scenario.priorities).toHaveLength(4);
      expect(scenario.authContext).toBeDefined();
      expect(scenario.dbClient).toBeDefined();

      // All entities should be properly linked
      expect(scenario.authContext.organizationId).toBe(scenario.organization.id);
      expect(scenario.users[0].organization_id).toBe(scenario.organization.id);
      expect(scenario.machines[0].organization_id).toBe(scenario.organization.id);
      expect(scenario.issues.every(issue => 
        issue.organization_id === scenario.organization.id
      )).toBe(true);
    });

    it("demonstrates edge case scenarios", () => {
      const edgeCases = MockScenarioFactory.createEdgeCaseScenarios();
      
      // Empty organization
      expect(edgeCases.emptyOrganization.issues).toHaveLength(0);
      expect(edgeCases.emptyOrganization.machines).toHaveLength(0);
      
      // Unassigned issues
      expect(edgeCases.unassignedIssues.issues.every(issue => 
        issue.assigned_to_id === null
      )).toBe(true);
      
      // High volume
      expect(edgeCases.highVolumeScenario.issues).toHaveLength(50);
    });
  });

  describe("Test Helper Patterns", () => {
    it("demonstrates consistent ID usage across tests", () => {
      // Using SEED_TEST_IDS ensures consistent, predictable IDs across all tests
      const user1 = SeedBasedMockFactory.createMockUser();
      const user2 = SeedBasedMockFactory.createMockUser({ name: "Different Name" });
      
      // Same ID because they're both the primary admin user
      expect(user1.id).toBe(user2.id);
      expect(user1.id).toBe(SEED_TEST_IDS.USERS.ADMIN);
      
      // But different names
      expect(user1.name).not.toBe(user2.name);
    });

    it("demonstrates org scoping test patterns", () => {
      const primaryContext = MockAuthContextFactory.createPrimaryOrgContext();
      const competitorContext = MockAuthContextFactory.createCompetitorOrgContext();
      
      // Different organizations
      expect(primaryContext.organizationId).not.toBe(competitorContext.organizationId);
      expect(primaryContext.organizationId).toBe(SEED_TEST_IDS.ORGANIZATIONS.primary);
      expect(competitorContext.organizationId).toBe(SEED_TEST_IDS.ORGANIZATIONS.competitor);
      
      // Different users
      expect(primaryContext.user.id).not.toBe(competitorContext.user.id);
      expect(primaryContext.user.email).toContain("pinpoint.dev");
      expect(competitorContext.user.email).toContain("competitor.dev");
    });

    it("demonstrates realistic timestamp handling", () => {
      const issue1 = SeedBasedMockFactory.createMockIssue();
      
      // Small delay to ensure different timestamps
      setTimeout(() => {
        const issue2 = SeedBasedMockFactory.createMockIssue();
        
        expect(issue1.created_at).toBeDefined();
        expect(issue2.created_at).toBeDefined();
        expect(new Date(issue1.created_at)).toBeInstanceOf(Date);
        expect(new Date(issue2.created_at)).toBeInstanceOf(Date);
      }, 1);
    });

    it("demonstrates mock data relationships", () => {
      const scenario = MockScenarioFactory.createPrimaryOrgScenario();
      
      // Issues should reference existing users and machines
      const issue = scenario.issues[0];
      const user = scenario.users.find(u => u.id === issue.created_by_id);
      const machine = scenario.machines.find(m => m.id === issue.machine_id);
      
      expect(user).toBeDefined();
      expect(machine).toBeDefined();
      expect(user?.organization_id).toBe(scenario.organization.id);
      expect(machine?.organization_id).toBe(scenario.organization.id);
    });
  });

  describe("Performance and Memory Patterns", () => {
    it("demonstrates efficient mock creation", () => {
      // Large datasets should be created efficiently
      const startTime = performance.now();
      const largeDataset = SeedBasedMockFactory.createMockIssues(100);
      const endTime = performance.now();
      
      expect(largeDataset).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
      
      // Each issue should have unique ID but consistent patterns
      const uniqueIds = new Set(largeDataset.map(issue => issue.id));
      expect(uniqueIds.size).toBe(100); // All unique IDs
      
      // But shared organizational context
      expect(largeDataset.every(issue => 
        issue.organization_id === SEED_TEST_IDS.ORGANIZATIONS.primary
      )).toBe(true);
    });

    it("demonstrates memory-efficient mocking", () => {
      // Mock factory should reuse patterns, not create new objects unnecessarily
      const dbClient1 = MockDatabaseFactory.createMockDbClient();
      const dbClient2 = MockDatabaseFactory.createMockDbClient();
      
      // Different instances
      expect(dbClient1).not.toBe(dbClient2);
      
      // But similar structure
      expect(typeof dbClient1.query.issues.findMany).toBe("function");
      expect(typeof dbClient2.query.issues.findMany).toBe("function");
    });
  });
});