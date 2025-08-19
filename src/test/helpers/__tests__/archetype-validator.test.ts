/**
 * Tests for the archetype validator
 * 
 * Validates that the archetype validator correctly identifies patterns,
 * detects violations, and provides appropriate suggestions.
 */

import { describe, test, expect } from "vitest";
import { 
  validateTestArchetype, 
  detectArchetype,
  ARCHETYPE_DEFINITIONS 
} from "../archetype-validator";

describe("Archetype Validator", () => {
  
  // =============================================================================
  // ARCHETYPE DETECTION TESTS
  // =============================================================================
  
  test("detects Pure Function Unit Test (Archetype 1)", () => {
    const content = `
      import { describe, test, expect } from "vitest";
      import { formatIssueTitle } from "../formatting";
      
      describe("formatIssueTitle", () => {
        test("capitalizes first letter", () => {
          expect(formatIssueTitle("test")).toBe("Test");
        });
      });
    `;
    
    const archetype = detectArchetype(content, "formatting.test.ts");
    expect(archetype).toBe(1);
  });
  
  test("detects Service Business Logic Test (Archetype 2)", () => {
    const content = `
      import { describe, test, expect } from "vitest";
      import { withBusinessLogicTest } from "~/test/helpers/worker-scoped-db";
      import { IssueService } from "../issueService";
      
      test("service creates issue", async ({ workerDb }) => {
        await withBusinessLogicTest(workerDb, async (db) => {
          const service = new IssueService(db);
          // test logic
        });
      });
    `;
    
    const archetype = detectArchetype(content, "issueService.test.ts");
    expect(archetype).toBe(2);
  });
  
  test("detects React Component Unit Test (Archetype 4)", () => {
    const content = `
      import { describe, test, expect } from "vitest";
      import { render, screen } from "@testing-library/react";
      import { VitestTestWrapper } from "~/test/VitestTestWrapper";
      import { IssueList } from "../IssueList";
      
      test("renders issue list", () => {
        render(
          <VitestTestWrapper>
            <IssueList />
          </VitestTestWrapper>
        );
      });
    `;
    
    const archetype = detectArchetype(content, "IssueList.test.tsx");
    expect(archetype).toBe(4);
  });
  
  test("detects tRPC Router Test (Archetype 5)", () => {
    const content = `
      import { createVitestMockContext } from "~/test/vitestMockContext";
      import { appRouter } from "~/server/api/root";
      
      test("router creates issue", async () => {
        const mockCtx = createVitestMockContext({});
        const caller = appRouter.createCaller(mockCtx);
        // test logic
      });
    `;
    
    const archetype = detectArchetype(content, "issue.router.test.ts");
    expect(archetype).toBe(5);
  });
  
  // =============================================================================
  // MEMORY SAFETY VIOLATION DETECTION
  // =============================================================================
  
  test("detects dangerous PGlite per-test pattern", () => {
    const dangerousContent = `
      test("dangerous test", async () => {
        const db = new PGlite(); // DANGEROUS
        // test logic
      });
    `;
    
    const result = validateTestArchetype("dangerous.test.ts", dangerousContent);
    
    expect(result.isValid).toBe(false);
    expect(result.compliance.memorysSafety).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].type).toBe("memory_safety");
    expect(result.errors[0].severity).toBe("critical");
    expect(result.errors[0].message).toContain("memory blowouts");
  });
  
  test("detects dangerous createSeededTestDatabase pattern", () => {
    const dangerousContent = `
      beforeEach(async () => {
        const { db } = await createSeededTestDatabase(); // DANGEROUS
      });
    `;
    
    const result = validateTestArchetype("dangerous.test.ts", dangerousContent);
    
    expect(result.isValid).toBe(false);
    expect(result.compliance.memorysSafety).toBe(false);
    expect(result.errors.some(e => e.message.includes("memory usage"))).toBe(true);
  });
  
  test("accepts safe worker-scoped pattern", () => {
    const safeContent = `
      import { test, withBusinessLogicTest } from "~/test/helpers/worker-scoped-db";
      
      test("safe test", async ({ workerDb }) => {
        await withBusinessLogicTest(workerDb, async (db) => {
          // safe test logic
        });
      });
    `;
    
    const result = validateTestArchetype("safe.test.ts", safeContent);
    
    expect(result.compliance.memorysSafety).toBe(true);
    expect(result.errors.filter(e => e.type === "memory_safety")).toHaveLength(0);
  });
  
  // =============================================================================
  // RLS CONTEXT VALIDATION
  // =============================================================================
  
  test("detects missing RLS context in integration test", () => {
    const missingRLSContent = `
      import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
      
      test("integration test without RLS", async ({ workerDb }) => {
        await withIsolatedTest(workerDb, async (db) => {
          // Missing RLS context setup
          const issues = await db.query.issues.findMany();
        });
      });
    `;
    
    const result = validateTestArchetype("integration.test.ts", missingRLSContent);
    
    expect(result.compliance.rlsContext).toBe(false);
    expect(result.errors.some(e => e.type === "rls_context")).toBe(true);
  });
  
  test("accepts proper RLS context setup", () => {
    const properRLSContent = `
      import { test, withRLSAwareTest } from "~/test/helpers/worker-scoped-db";
      import { testSessions } from "~/test/helpers/session-context";
      
      test("integration test with RLS", async ({ workerDb, organizationId }) => {
        await withRLSAwareTest(workerDb, organizationId, async (db) => {
          await testSessions.admin(db, organizationId);
          const issues = await db.query.issues.findMany();
        });
      });
    `;
    
    const result = validateTestArchetype("integration.test.ts", properRLSContent);
    
    expect(result.compliance.rlsContext).toBe(true);
    expect(result.errors.filter(e => e.type === "rls_context")).toHaveLength(0);
  });
  
  // =============================================================================
  // ARCHETYPE COMPLIANCE VALIDATION
  // =============================================================================
  
  test("detects archetype pattern violations", () => {
    const violatingContent = `
      import { render } from "@testing-library/react"; // React import
      import { describe, test, expect } from "vitest";
      
      // But trying to do database testing
      describe("formatIssueTitle", () => {
        test("formats title", async () => {
          const db = await createTestDatabase(); // Forbidden for Archetype 1
          expect(formatIssueTitle("test")).toBe("Test");
        });
      });
    `;
    
    const result = validateTestArchetype("mixed.test.ts", violatingContent);
    
    expect(result.compliance.archetypePattern).toBe(false);
    expect(result.errors.some(e => e.type === "archetype_mismatch")).toBe(true);
  });
  
  test("accepts proper archetype compliance", () => {
    const compliantContent = `
      import { describe, test, expect } from "vitest";
      import { formatIssueTitle } from "../formatting";
      
      describe("formatIssueTitle", () => {
        test("capitalizes first letter", () => {
          expect(formatIssueTitle("test")).toBe("Test");
        });
      });
    `;
    
    const result = validateTestArchetype("compliant.test.ts", compliantContent);
    
    expect(result.archetype).toBe(1);
    expect(result.agent).toBe("unit-test-architect");
    expect(result.compliance.archetypePattern).toBe(true);
  });
  
  // =============================================================================
  // IMPORT STRUCTURE VALIDATION
  // =============================================================================
  
  test("detects forbidden imports for archetype", () => {
    const badImportsContent = `
      import { describe, test, expect } from "vitest";
      import { withIsolatedTest } from "~/test/helpers/worker-scoped-db"; // Forbidden for pure function test
      import { formatIssueTitle } from "../formatting";
      
      describe("formatIssueTitle", () => {
        test("formats title", () => {
          expect(formatIssueTitle("test")).toBe("Test");
        });
      });
    `;
    
    const result = validateTestArchetype("bad-imports.test.ts", badImportsContent);
    
    expect(result.compliance.importStructure).toBe(false);
    expect(result.errors.some(e => e.type === "import_violation")).toBe(true);
  });
  
  // =============================================================================
  // INTEGRATION TESTS
  // =============================================================================
  
  test("validates complete good test file", () => {
    const goodTestContent = `
      import { describe, test, expect } from "vitest";
      import { formatIssueTitle, validateEmail } from "../utils";
      
      describe("Utility Functions", () => {
        test("formatIssueTitle capitalizes correctly", () => {
          expect(formatIssueTitle("test issue")).toBe("Test issue");
          expect(formatIssueTitle("")).toBe("");
        });
        
        test("formatIssueTitle handles edge cases", () => {
          expect(() => formatIssueTitle(null)).toThrow("Input required");
          expect(() => formatIssueTitle(undefined)).toThrow("Input required");
        });
        
        test("validateEmail works correctly", () => {
          expect(validateEmail("test@example.com")).toBe(true);
          expect(validateEmail("invalid")).toBe(false);
        });
      });
    `;
    
    const result = validateTestArchetype("good-test.test.ts", goodTestContent);
    
    expect(result.isValid).toBe(true);
    expect(result.archetype).toBe(1);
    expect(result.agent).toBe("unit-test-architect");
    expect(result.errors).toHaveLength(0);
    expect(result.compliance.memoryySafety).toBe(true);
    expect(result.compliance.archetypePattern).toBe(true);
  });
  
  test("validates complete bad test file", () => {
    const badTestContent = `
      import { describe, test } from "vitest"; // Missing expect import
      import { render } from "@testing-library/react"; // Wrong archetype import
      import { formatIssueTitle } from "../utils";
      
      describe("Mixed Archetype Test", () => {
        test("dangerous pattern", async () => {
          const db = new PGlite(); // DANGEROUS: Memory safety violation
          const result = formatIssueTitle("test");
          // Missing expectations
        });
      });
    `;
    
    const result = validateTestArchetype("bad-test.test.ts", badTestContent);
    
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.compliance.memoryySafety).toBe(false);
    
    // Should have multiple error types
    const errorTypes = result.errors.map(e => e.type);
    expect(errorTypes).toContain("memory_safety");
  });
  
  // =============================================================================
  // ARCHETYPE DEFINITIONS TEST
  // =============================================================================
  
  test("has definitions for all 8 archetypes", () => {
    expect(Object.keys(ARCHETYPE_DEFINITIONS)).toHaveLength(8);
    
    for (let i = 1; i <= 8; i++) {
      expect(ARCHETYPE_DEFINITIONS[i]).toBeDefined();
      expect(ARCHETYPE_DEFINITIONS[i].name).toMatch(/test/i);
      expect(ARCHETYPE_DEFINITIONS[i].agent).toBeDefined();
      expect(ARCHETYPE_DEFINITIONS[i].patterns).toBeDefined();
      expect(ARCHETYPE_DEFINITIONS[i].patterns.required).toBeInstanceOf(Array);
      expect(ARCHETYPE_DEFINITIONS[i].patterns.forbidden).toBeInstanceOf(Array);
    }
  });
  
  test("archetype definitions have correct agent assignments", () => {
    const expectedAgents = {
      1: "unit-test-architect",
      2: "integration-test-architect", 
      3: "integration-test-architect",
      4: "unit-test-architect",
      5: "integration-test-architect",
      6: "security-test-architect",
      7: "security-test-architect",
      8: "security-test-architect",
    };
    
    for (const [archetype, expectedAgent] of Object.entries(expectedAgents)) {
      expect(ARCHETYPE_DEFINITIONS[parseInt(archetype)].agent).toBe(expectedAgent);
    }
  });
});

// =============================================================================
// TEMPLATE COMPLIANCE TESTS
// =============================================================================

describe("Template Compliance", () => {
  
  test("all templates should pass their own archetype validation", () => {
    // This is a meta-test - the actual templates should pass validation
    // when they are used as examples
    
    const templateContent = `
      import { describe, test, expect } from "vitest";
      import { formatIssueTitle } from "../formatting";
      
      describe("YourFunction", () => {
        test("handles typical valid input correctly", () => {
          const result = formatIssueTitle("test input");
          expect(result).toBe("Test input");
        });
        
        test("handles edge cases gracefully", () => {
          expect(() => formatIssueTitle(null)).toThrow();
        });
      });
    `;
    
    const result = validateTestArchetype("template.test.ts", templateContent);
    
    expect(result.isValid).toBe(true);
    expect(result.archetype).toBe(1);
    expect(result.errors).toHaveLength(0);
  });
});

/*
ARCHETYPE VALIDATOR TEST CHARACTERISTICS:
- Tests archetype detection accuracy
- Tests memory safety violation detection
- Tests RLS context validation
- Tests archetype compliance checking
- Tests import structure validation
- Tests integration scenarios

WHEN TO RUN THESE TESTS:
✅ When modifying the archetype validator logic
✅ When adding new archetype definitions
✅ When changing validation rules
✅ As part of CI/CD to ensure validator quality
✅ When debugging false positives/negatives

PURPOSE:
This test suite ensures the archetype validator correctly:
1. Identifies which archetype a test should follow
2. Detects dangerous patterns that cause system issues
3. Validates RLS context setup in integration tests
4. Ensures tests follow their archetype's patterns
5. Provides helpful error messages and suggestions

The validator is critical for maintaining test quality and
preventing dangerous patterns that can cause system lockups.
*/