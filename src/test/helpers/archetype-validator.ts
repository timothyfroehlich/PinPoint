/**
 * Test Archetype Quality Validation Framework
 * 
 * Validates that test files follow the correct archetype patterns and
 * comply with memory safety, RLS context, and quality guidelines.
 * 
 * This framework prevents dangerous patterns that can cause:
 * - System lockups from PGlite memory blowouts
 * - Missing RLS context in integration tests
 * - Incorrect archetype usage leading to poor test quality
 * 
 * @see docs/testing/dual-track-testing-strategy.md
 */

import { readFileSync } from "node:fs";
import { basename, extname, dirname } from "node:path";

// =============================================================================
// ARCHETYPE DEFINITIONS
// =============================================================================

export const ARCHETYPE_DEFINITIONS = {
  1: {
    name: "Pure Function Unit Test",
    patterns: {
      required: ["describe(", "test(", "expect("],
      forbidden: ["createTestDatabase", "PGlite", "withIsolatedTest", "tRPC", "render("],
      imports: {
        allowed: ["vitest", "~/utils/", "~/lib/", "~/types/"],
        forbidden: ["~/server/db", "~/test/helpers/worker-scoped-db", "@testing-library/react"],
      },
    },
    agent: "unit-test-architect",
  },
  
  2: {
    name: "Service Business Logic Test",
    patterns: {
      required: ["withBusinessLogicTest", "describe(", "test("],
      forbidden: ["new PGlite(", "createSeededTestDatabase", "render(", "screen."],
      imports: {
        allowed: ["~/test/helpers/worker-scoped-db", "~/server/services/", "vitest"],
        forbidden: ["@testing-library/react", "~/components/"],
      },
    },
    agent: "integration-test-architect",
  },
  
  3: {
    name: "PGlite Integration Test", 
    patterns: {
      required: ["withBusinessLogicTest", "workerDb", "describe(", "test("],
      forbidden: ["new PGlite(", "createSeededTestDatabase", "render(", "screen."],
      imports: {
        allowed: ["~/test/helpers/worker-scoped-db", "drizzle-orm", "~/server/db/schema"],
        forbidden: ["@testing-library/react", "~/components/"],
      },
    },
    agent: "integration-test-architect",
  },
  
  4: {
    name: "React Component Unit Test",
    patterns: {
      required: ["render(", "screen.", "describe(", "test(", "VitestTestWrapper"],
      forbidden: ["withIsolatedTest", "PGlite", "createTestDatabase", "workerDb"],
      imports: {
        allowed: ["@testing-library/react", "~/test/VitestTestWrapper", "vitest"],
        forbidden: ["~/test/helpers/worker-scoped-db", "~/server/db"],
      },
    },
    agent: "unit-test-architect",
  },
  
  5: {
    name: "tRPC Router Test",
    patterns: {
      required: ["appRouter", "createCaller", "createVitestMockContext", "vi.mock"],
      forbidden: ["withIsolatedTest", "workerDb", "render(", "new PGlite("],
      imports: {
        allowed: ["~/test/vitestMockContext", "~/server/api/", "vitest"],
        forbidden: ["~/test/helpers/worker-scoped-db", "@testing-library/react"],
      },
    },
    agent: "integration-test-architect",
  },
  
  6: {
    name: "Permission/Auth Test",
    patterns: {
      required: ["withRLSAwareTest", "testSessions", "sessionVerification"],
      forbidden: ["new PGlite(", "render(", "screen.", "createVitestMockContext"],
      imports: {
        allowed: ["~/test/helpers/session-context", "~/test/helpers/worker-scoped-db"],
        forbidden: ["@testing-library/react", "~/test/vitestMockContext"],
      },
    },
    agent: "security-test-architect",
  },
  
  7: {
    name: "RLS Policy Test", 
    patterns: {
      required: ["withRLSAwareTest", "testSessions", "sql`SET app.current_organization_id"],
      forbidden: ["new PGlite(", "render(", "createVitestMockContext"],
      imports: {
        allowed: ["~/test/helpers/session-context", "~/test/helpers/worker-scoped-db"],
        forbidden: ["@testing-library/react", "~/test/vitestMockContext"],
      },
    },
    agent: "security-test-architect",
  },
  
  8: {
    name: "Schema/Database Constraint Test",
    patterns: {
      required: ["withBusinessLogicTest", "schema.", "constraint", "foreign key"],
      forbidden: ["new PGlite(", "render(", "createVitestMockContext", "screen."],
      imports: {
        allowed: ["~/test/helpers/worker-scoped-db", "~/server/db/schema", "drizzle-orm"],
        forbidden: ["@testing-library/react", "~/test/vitestMockContext"],
      },
    },
    agent: "security-test-architect",
  },
} as const;

// =============================================================================
// VALIDATION RESULT TYPES
// =============================================================================

export interface ValidationResult {
  isValid: boolean;
  archetype: number | null;
  agent: string | null;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
  compliance: {
    memorysSafety: boolean;
    rlsContext: boolean;
    archetypePattern: boolean;
    importStructure: boolean;
    errorHandling: boolean;
  };
}

export interface ValidationError {
  type: 'memory_safety' | 'rls_context' | 'archetype_mismatch' | 'import_violation' | 'pattern_violation';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  line?: number;
  suggestion?: string;
}

export interface ValidationWarning {
  type: 'style' | 'performance' | 'maintainability';
  message: string;
  line?: number;
  suggestion?: string;
}

// =============================================================================
// CORE VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validates a test file against archetype patterns and quality standards
 * 
 * @param filePath - Path to the test file to validate
 * @param fileContent - Optional file content (will read from disk if not provided)
 * @returns ValidationResult with detailed compliance information
 */
export function validateTestArchetype(
  filePath: string, 
  fileContent?: string
): ValidationResult {
  const content = fileContent || readFileSync(filePath, 'utf-8');
  const fileName = basename(filePath);
  const result: ValidationResult = {
    isValid: true,
    archetype: null,
    agent: null,
    errors: [],
    warnings: [],
    suggestions: [],
    compliance: {
      memorysSafety: true,
      rlsContext: true,
      archetypePattern: true,
      importStructure: true,
      errorHandling: true,
    },
  };
  
  // Determine archetype
  result.archetype = detectArchetype(content, fileName);
  if (result.archetype) {
    result.agent = ARCHETYPE_DEFINITIONS[result.archetype].agent;
  }
  
  // Run all validations
  validateMemorySafety(content, filePath, result);
  validateRLSContext(content, filePath, result);
  validateArchetypeCompliance(content, filePath, result);
  validateImportStructure(content, filePath, result);
  validateErrorHandling(content, filePath, result);
  validatePerformancePatterns(content, filePath, result);
  
  // Set overall validity
  result.isValid = result.errors.filter(e => e.severity === 'critical' || e.severity === 'high').length === 0;
  
  return result;
}

/**
 * Detects which archetype a test file should follow based on patterns
 */
export function detectArchetype(content: string, fileName: string): number | null {
  const patterns = {
    1: () => !content.includes('db') && !content.includes('render') && content.includes('describe('),
    2: () => content.includes('Service') && content.includes('withBusinessLogicTest'),
    3: () => content.includes('integration.test.ts') || content.includes('withBusinessLogicTest') && content.includes('schema.'),
    4: () => content.includes('render(') && content.includes('@testing-library/react'),
    5: () => content.includes('appRouter') && content.includes('createCaller'),
    6: () => content.includes('testSessions') && content.includes('Permission'),
    7: () => content.includes('RLS') && content.includes('withRLSAwareTest'),
    8: () => content.includes('constraint') || content.includes('schema') && content.includes('foreign'),
  };
  
  for (const [archetype, detector] of Object.entries(patterns)) {
    if (detector()) {
      return parseInt(archetype, 10);
    }
  }
  
  return null;
}

// =============================================================================
// MEMORY SAFETY VALIDATION
// =============================================================================

function validateMemorySafety(content: string, filePath: string, result: ValidationResult): void {
  const dangerousPatterns = [
    {
      pattern: /new PGlite\(/g,
      message: "CRITICAL: Per-test PGlite instances cause memory blowouts and system lockups",
      suggestion: "Use worker-scoped PGlite with withBusinessLogicTest helper instead",
    },
    {
      pattern: /createSeededTestDatabase\(\)/g,
      message: "CRITICAL: Per-test database creation causes 50-100MB memory usage per test",
      suggestion: "Use withBusinessLogicTest with worker-scoped database pattern",
    },
    {
      pattern: /beforeEach.*createTestDatabase/g,
      message: "CRITICAL: beforeEach database creation multiplies memory usage by test count",
      suggestion: "Use worker-scoped fixtures with test.extend pattern",
    },
    {
      pattern: /beforeAll.*new PGlite/g,
      message: "HIGH: Multiple PGlite instances across test files cause memory issues",
      suggestion: "Use single worker-scoped PGlite instance per worker",
    },
  ];
  
  for (const { pattern, message, suggestion } of dangerousPatterns) {
    const matches = Array.from(content.matchAll(pattern));
    for (const match of matches) {
      result.errors.push({
        type: 'memory_safety',
        severity: 'critical',
        message,
        suggestion,
        line: getLineNumber(content, match.index || 0),
      });
      result.compliance.memorysSafety = false;
    }
  }
  
  // Check for safe patterns
  if (content.includes('integration') && !content.includes('withBusinessLogicTest') && !content.includes('withRLSAwareTest')) {
    result.warnings.push({
      type: 'performance',
      message: "Integration test should use withBusinessLogicTest or withRLSAwareTest helpers",
      suggestion: "Import and use proper test isolation helpers for memory safety",
    });
  }
}

// =============================================================================
// RLS CONTEXT VALIDATION
// =============================================================================

function validateRLSContext(content: string, filePath: string, result: ValidationResult): void {
  const isIntegrationTest = content.includes('integration.test.ts') || 
                           content.includes('withRLSAwareTest') ||
                           content.includes('testSessions');
  
  if (!isIntegrationTest) return;
  
  const rlsPatterns = [
    'SET app.current_organization_id',
    'testSessions.',
    'withRLSAwareTest',
    'sessionVerification',
  ];
  
  const hasRLSPattern = rlsPatterns.some(pattern => content.includes(pattern));
  
  if (!hasRLSPattern) {
    result.errors.push({
      type: 'rls_context',
      severity: 'high',
      message: "Integration test missing RLS session context management",
      suggestion: "Use testSessions helpers or withRLSAwareTest for organizational scoping",
    });
    result.compliance.rlsContext = false;
  }
  
  // Check for organizational isolation testing
  if (content.includes('organizationId') && !content.includes('cross-org')) {
    result.suggestions.push("Consider adding cross-organizational isolation tests");
  }
}

// =============================================================================
// ARCHETYPE COMPLIANCE VALIDATION
// =============================================================================

function validateArchetypeCompliance(content: string, filePath: string, result: ValidationResult): void {
  if (!result.archetype) return;
  
  const archetype = ARCHETYPE_DEFINITIONS[result.archetype];
  
  // Check required patterns
  for (const pattern of archetype.patterns.required) {
    if (!content.includes(pattern)) {
      result.errors.push({
        type: 'archetype_mismatch',
        severity: 'medium',
        message: `Missing required pattern for ${archetype.name}: ${pattern}`,
        suggestion: `Add ${pattern} to follow ${archetype.name} archetype`,
      });
      result.compliance.archetypePattern = false;
    }
  }
  
  // Check forbidden patterns
  for (const pattern of archetype.patterns.forbidden) {
    if (content.includes(pattern)) {
      result.errors.push({
        type: 'archetype_mismatch',
        severity: 'medium',
        message: `Forbidden pattern in ${archetype.name}: ${pattern}`,
        suggestion: `Remove ${pattern} to comply with ${archetype.name} archetype`,
      });
      result.compliance.archetypePattern = false;
    }
  }
  
  // Suggest correct agent
  if (result.agent) {
    result.suggestions.push(`This test should be handled by: ${result.agent}`);
  }
}

// =============================================================================
// IMPORT STRUCTURE VALIDATION
// =============================================================================

function validateImportStructure(content: string, filePath: string, result: ValidationResult): void {
  const importLines = content.split('\n').filter(line => 
    line.trim().startsWith('import ') || line.trim().startsWith('from ')
  );
  
  if (!result.archetype) return;
  
  const archetype = ARCHETYPE_DEFINITIONS[result.archetype];
  
  // Check for forbidden imports
  for (const line of importLines) {
    for (const forbidden of archetype.imports.forbidden) {
      if (line.includes(forbidden)) {
        result.errors.push({
          type: 'import_violation',
          severity: 'medium',
          message: `Forbidden import for ${archetype.name}: ${forbidden}`,
          suggestion: `Remove import of ${forbidden} - not needed for this archetype`,
          line: getLineNumber(content, content.indexOf(line)),
        });
        result.compliance.importStructure = false;
      }
    }
  }
  
  // Suggest required imports
  const hasRequiredImports = archetype.imports.allowed.some(allowed => 
    importLines.some(line => line.includes(allowed))
  );
  
  if (!hasRequiredImports) {
    result.warnings.push({
      type: 'maintainability',
      message: `Consider importing from: ${archetype.imports.allowed.join(', ')}`,
      suggestion: "Add necessary imports for this archetype",
    });
  }
}

// =============================================================================
// ERROR HANDLING VALIDATION
// =============================================================================

function validateErrorHandling(content: string, filePath: string, result: ValidationResult): void {
  const hasExpectRejects = content.includes('expect(') && content.includes('.rejects.toThrow');
  const hasExpectThrows = content.includes('expect(() =>') && content.includes(').toThrow');
  const hasTryCatch = content.includes('try {') && content.includes('catch (');
  
  if (content.includes('test(') && !hasExpectRejects && !hasExpectThrows && !hasTryCatch) {
    result.warnings.push({
      type: 'maintainability',
      message: "No error handling tests found",
      suggestion: "Consider adding tests for error scenarios with expect().rejects.toThrow() or try/catch",
    });
  }
  
  // Check for proper error assertion patterns
  if (content.includes('.toThrow()') && !content.includes('.toThrow(')) {
    result.warnings.push({
      type: 'maintainability',
      message: "Generic error matching - consider specific error messages",
      suggestion: "Use .toThrow('specific message') for better test precision",
    });
  }
}

// =============================================================================
// PERFORMANCE PATTERN VALIDATION
// =============================================================================

function validatePerformancePatterns(content: string, filePath: string, result: ValidationResult): void {
  // Check for performance anti-patterns
  const performanceIssues = [
    {
      pattern: /await.*forEach/g,
      message: "Performance issue: forEach with async/await doesn't run in parallel",
      suggestion: "Use Promise.all() with map() for parallel execution",
    },
    {
      pattern: /for.*await.*findMany/g,
      message: "Performance issue: Multiple database queries in loop",
      suggestion: "Consider batch queries or single query with IN clause",
    },
    {
      pattern: /beforeEach.*await/g,
      message: "Performance issue: Async setup in beforeEach slows all tests",
      suggestion: "Move expensive setup to beforeAll or use lazy initialization",
    },
  ];
  
  for (const { pattern, message, suggestion } of performanceIssues) {
    const matches = Array.from(content.matchAll(pattern));
    if (matches.length > 0) {
      result.warnings.push({
        type: 'performance',
        message,
        suggestion,
      });
    }
  }
  
  // Check for good performance patterns
  if (content.includes('withBusinessLogicTest')) {
    result.suggestions.push("Good: Using fast business logic testing pattern");
  }
  
  if (content.includes('Promise.all(')) {
    result.suggestions.push("Good: Using parallel execution pattern");
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function getLineNumber(content: string, index: number): number {
  return content.substring(0, index).split('\n').length;
}

/**
 * Batch validation for multiple test files
 */
export function validateTestFiles(filePaths: string[]): Map<string, ValidationResult> {
  const results = new Map<string, ValidationResult>();
  
  for (const filePath of filePaths) {
    try {
      const result = validateTestArchetype(filePath);
      results.set(filePath, result);
    } catch (error) {
      results.set(filePath, {
        isValid: false,
        archetype: null,
        agent: null,
        errors: [{
          type: 'pattern_violation',
          severity: 'critical',
          message: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
        }],
        warnings: [],
        suggestions: [],
        compliance: {
          memorysSafety: false,
          rlsContext: false,
          archetypePattern: false,
          importStructure: false,
          errorHandling: false,
        },
      });
    }
  }
  
  return results;
}

/**
 * Generate validation report for CLI/CI usage
 */
export function generateValidationReport(results: Map<string, ValidationResult>): string {
  const report = ['='.repeat(80), 'TEST ARCHETYPE VALIDATION REPORT', '='.repeat(80), ''];
  
  let totalFiles = 0;
  let validFiles = 0;
  let criticalErrors = 0;
  let highErrors = 0;
  let warnings = 0;
  
  for (const [filePath, result] of results) {
    totalFiles++;
    if (result.isValid) validFiles++;
    
    criticalErrors += result.errors.filter(e => e.severity === 'critical').length;
    highErrors += result.errors.filter(e => e.severity === 'high').length;
    warnings += result.warnings.length;
    
    if (!result.isValid || result.warnings.length > 0) {
      report.push(`📁 ${filePath}`);
      report.push(`   Archetype: ${result.archetype ? ARCHETYPE_DEFINITIONS[result.archetype].name : 'Unknown'}`);
      report.push(`   Agent: ${result.agent || 'Unknown'}`);
      report.push('');
      
      if (result.errors.length > 0) {
        report.push('   ❌ ERRORS:');
        for (const error of result.errors) {
          const icon = error.severity === 'critical' ? '🔥' : 
                      error.severity === 'high' ? '⚠️' : 
                      error.severity === 'medium' ? '⚡' : 'ℹ️';
          report.push(`      ${icon} ${error.message}`);
          if (error.suggestion) {
            report.push(`         💡 ${error.suggestion}`);
          }
        }
        report.push('');
      }
      
      if (result.warnings.length > 0) {
        report.push('   ⚠️ WARNINGS:');
        for (const warning of result.warnings) {
          report.push(`      • ${warning.message}`);
          if (warning.suggestion) {
            report.push(`        💡 ${warning.suggestion}`);
          }
        }
        report.push('');
      }
      
      if (result.suggestions.length > 0) {
        report.push('   💡 SUGGESTIONS:');
        for (const suggestion of result.suggestions) {
          report.push(`      • ${suggestion}`);
        }
        report.push('');
      }
      
      report.push('');
    }
  }
  
  // Summary
  report.push('='.repeat(80));
  report.push('SUMMARY');
  report.push('='.repeat(80));
  report.push(`Total files validated: ${totalFiles}`);
  report.push(`Valid files: ${validFiles} (${Math.round((validFiles / totalFiles) * 100)}%)`);
  report.push(`Critical errors: ${criticalErrors}`);
  report.push(`High priority errors: ${highErrors}`);
  report.push(`Warnings: ${warnings}`);
  report.push('');
  
  if (criticalErrors > 0) {
    report.push('🔥 CRITICAL ISSUES DETECTED - Fix immediately to prevent system lockups');
  } else if (highErrors > 0) {
    report.push('⚠️ HIGH PRIORITY ISSUES - Fix before proceeding');
  } else if (validFiles === totalFiles) {
    report.push('✅ ALL FILES PASS VALIDATION');
  }
  
  return report.join('\n');
}

/**
 * CLI-friendly validation for single files
 */
export function validateSingleFile(filePath: string): void {
  const result = validateTestArchetype(filePath);
  const report = generateValidationReport(new Map([[filePath, result]]));
  console.log(report);
  
  // Exit with error code if validation fails
  if (!result.isValid) {
    process.exit(1);
  }
}

// Export for CLI usage
if (require.main === module) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node archetype-validator.js <test-file-path>');
    process.exit(1);
  }
  
  validateSingleFile(filePath);
}