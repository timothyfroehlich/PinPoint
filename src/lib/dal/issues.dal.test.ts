/**
 * Issues DAL Tests - Enhanced Archetype 4
 * Direct database function testing for Server Components
 */

import { describe, expect, it, beforeAll, vi } from "vitest";
import { getIssuesForOrg, getIssueById, getIssueStatusCounts } from "./issues";
import { testDALFunction, assertOrganizationScoping, createMockAuthContext } from "~/test/rsc-helpers/dal-test-helpers";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

describe("Issues DAL (Enhanced Archetype 4)", () => {
  beforeAll(() => {
    // Note: Uses existing seed data, no per-test database setup
    // This aligns with the integrated RSC approach
  });

  describe("getIssuesForOrg", () => {
    it("returns issues for authenticated organization", async () => {
      const issues = await testDALFunction(() => getIssuesForOrg());
      
      expect(Array.isArray(issues)).toBe(true);
      expect(issues.length).toBeGreaterThan(0);
      
      // Verify structure matches Server Component expectations
      const firstIssue = issues[0];
      expect(firstIssue).toHaveProperty("id");
      expect(firstIssue).toHaveProperty("title");
      expect(firstIssue).toHaveProperty("machine");
      expect(firstIssue.machine).toHaveProperty("name");
    });

    it("enforces organization scoping", async () => {
      await assertOrganizationScoping(() => getIssuesForOrg());
    });

    it("includes machine relationships for Server Components", async () => {
      const issues = await testDALFunction(() => getIssuesForOrg());
      
      const issueWithMachine = issues.find(i => i.machine);
      expect(issueWithMachine?.machine).toHaveProperty("name");
      expect(issueWithMachine?.machine).toHaveProperty("model");
    });
  });

  describe("getIssueById", () => {
    it("returns single issue with full details", async () => {
      const testIssueId = SEED_TEST_IDS.ISSUES.KAIJU_FIGURES;
      
      const issue = await testDALFunction(() => getIssueById(testIssueId));
      
      expect(issue.id).toBe(testIssueId);
      expect(issue).toHaveProperty("machine");
      expect(issue).toHaveProperty("createdByUser");
    });

    it("throws for cross-organization access", async () => {
      const competitorContext = createMockAuthContext(
        SEED_TEST_IDS.USERS.COMPETITOR_ADMIN,
        SEED_TEST_IDS.ORGANIZATIONS.competitor
      );
      
      const primaryOrgIssueId = SEED_TEST_IDS.ISSUES.KAIJU_FIGURES;
      
      await expect(
        testDALFunction(() => getIssueById(primaryOrgIssueId), competitorContext)
      ).rejects.toThrow("Issue not found or access denied");
    });
  });

  describe("getIssueStatusCounts", () => {
    it("returns status counts for dashboard", async () => {
      const statusCounts = await testDALFunction(() => getIssueStatusCounts());
      
      expect(typeof statusCounts).toBe("object");
      
      // Should have at least some statuses with counts
      const statusValues = Object.values(statusCounts);
      expect(statusValues.some(count => count > 0)).toBe(true);
    });

    it("only counts issues for current organization", async () => {
      // Test with primary org
      const primaryCounts = await testDALFunction(
        () => getIssueStatusCounts(),
        createMockAuthContext(SEED_TEST_IDS.USERS.ADMIN, SEED_TEST_IDS.ORGANIZATIONS.primary)
      );
      
      // Test with competitor org  
      const competitorCounts = await testDALFunction(
        () => getIssueStatusCounts(),
        createMockAuthContext(SEED_TEST_IDS.USERS.COMPETITOR_ADMIN, SEED_TEST_IDS.ORGANIZATIONS.competitor)
      );
      
      // Counts should be different (proving org scoping works)
      expect(primaryCounts).not.toEqual(competitorCounts);
    });
  });
});