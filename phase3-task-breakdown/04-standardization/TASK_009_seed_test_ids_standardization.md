# TASK 009: SEED_TEST_IDS Standardization Across Test Suite

## 🛠️ PRIORITY: LOW - STANDARDIZATION AND MAINTENANCE

**Status**: LOW IMPACT - 111 tests failing due to hardcoded values instead of SEED_TEST_IDS  
**Impact**: Test maintainability, debugging predictability, test data consistency  
**Agent Type**: unit-test-architect  
**Estimated Effort**: 2-3 days  
**Dependencies**: All higher priority tasks should be completed first

## Objective

Replace hardcoded test values with SEED_TEST_IDS constants across the test suite to ensure predictable debugging, consistent test data, and easier maintenance. This is a systematic cleanup task that improves long-term test suite quality.

## Scope

### Primary Pattern: Hardcoded Test Values (111 failing tests across multiple files)

**Files Requiring SEED_TEST_IDS Standardization:**

**Unit Tests** (42 tests):

- `src/lib/common/__tests__/organizationValidation.test.ts` - **8 tests** (org IDs, user IDs)
- `src/lib/validation/__tests__/issueValidation.test.ts` - **6 tests** (issue data)
- `src/lib/utils/__tests__/machineUtils.test.ts` - **7 tests** (machine IDs, model IDs)
- `src/lib/common/__tests__/userUtils.test.ts` - **5 tests** (user IDs, role values)
- `src/server/utils/__tests__/dateUtils.test.ts` - **4 tests** (timestamp consistency)
- `src/server/utils/__tests__/slugUtils.test.ts` - **3 tests** (organization slugs)
- Other utility test files - **9 tests** (various hardcoded values)

**Service Tests** (31 tests):

- `src/server/services/__tests__/issueService.test.ts` - **8 tests** (issue/machine/org IDs)
- `src/server/services/__tests__/machineService.test.ts` - **6 tests** (machine/location IDs)
- `src/server/services/__tests__/userService.test.ts` - **5 tests** (user/org IDs)
- `src/server/services/__tests__/locationService.test.ts` - **4 tests** (location IDs)
- `src/server/services/__tests__/organizationService.test.ts` - **3 tests** (org IDs)
- Other service test files - **5 tests** (various service data)

**Router Tests** (23 tests):

- `src/server/api/routers/__tests__/issue.test.ts` - **7 tests** (API response IDs)
- `src/server/api/routers/__tests__/machine.test.ts` - **5 tests** (machine data)
- `src/server/api/routers/__tests__/user.test.ts` - **4 tests** (user data)
- `src/server/api/routers/__tests__/organization.test.ts` - **3 tests** (org data)
- Other router test files - **4 tests** (API responses)

**Integration Tests** (15 tests):

- Various integration test files using hardcoded IDs instead of constants

## Error Patterns

### Pattern 1: Hardcoded Organization IDs (Most Common - 40%)

```
❌ ERROR: expected "test-org-1" to be "test-org-pinpoint"
❌ ERROR: Test assumes organization ID but uses different value
❌ ERROR: Cross-test consistency issues with organization references
Found in: Most test files across all archetypes
```

**Translation**: Tests use random or inconsistent organization IDs instead of SEED_TEST_IDS.ORGANIZATIONS.primary.

### Pattern 2: Hardcoded User IDs (30%)

```
❌ ERROR: expected "user-123" to be "test-user-tim"
❌ ERROR: Permission tests fail due to unknown user ID
❌ ERROR: User reference mismatches between test setup and assertions
Found in: Service tests, permission tests, router tests
```

**Translation**: Tests use arbitrary user IDs instead of SEED_TEST_IDS.USERS.\* constants.

### Pattern 3: Hardcoded Machine/Issue IDs (20%)

```
❌ ERROR: expected "machine-1" to match seeded machine ID
❌ ERROR: Issue references non-existent machine in test data
❌ ERROR: Foreign key relationship assumptions don't match reality
Found in: Issue service tests, machine service tests, integration tests
```

**Translation**: Tests assume specific machine or issue IDs that don't match seeded data.

### Pattern 4: Inconsistent Mock Values (10%)

```
❌ ERROR: Mock data uses "mock-org-1" but test expects "test-org"
❌ ERROR: Mock patterns don't align with integration test expectations
❌ ERROR: Unit test mocks inconsistent with integration test data
Found in: Mixed unit/integration test files
```

**Translation**: Mock data uses different ID patterns than integration tests.

## Root Cause Analysis

### 1. **Historical Inconsistency**

Tests were written at different times using different ID conventions:

```typescript
// INCONSISTENT PATTERNS ACROSS TESTS:
"org-1"; // Early test pattern
"test-org"; // Later test pattern
"mock-org-123"; // Mock test pattern
"organization-1"; // Yet another pattern
```

### 2. **Missing SEED_TEST_IDS Awareness**

Many tests were written before SEED_TEST_IDS was established as the standard.

### 3. **Copy-Paste Development**

Tests copied from other files maintained the hardcoded values from the original.

### 4. **Lack of Standard Examples**

No clear template or documentation showing proper SEED_TEST_IDS usage.

## Requirements

### Phase 1: Pattern Analysis and Tooling (Day 1)

1. **Audit all hardcoded test values** across the test suite
2. **Create automated replacement tooling** for common patterns
3. **Document standard SEED_TEST_IDS usage** patterns

### Phase 2: Systematic Replacement (Days 2-3)

1. **Replace hardcoded values** with SEED_TEST_IDS constants
2. **Verify test consistency** across files using same entities
3. **Update mock patterns** to align with SEED_TEST_IDS
4. **Validate no test behavior changes** from standardization

## Technical Specifications

### Fix 1: SEED_TEST_IDS Usage Audit Tool

**File**: `scripts/audit-seed-test-ids.js`

```javascript
#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const glob = require("glob");

// Common hardcoded patterns to detect
const HARDCODED_PATTERNS = [
  /["']test-org-\d+["']/g,
  /["']org-\d+["']/g,
  /["']user-\d+["']/g,
  /["']test-user-\d+["']/g,
  /["']machine-\d+["']/g,
  /["']issue-\d+["']/g,
  /["']mock-[a-z]+-\d+["']/g,
  /["'](test-)?organization-\d+["']/g,
];

// Suggested SEED_TEST_IDS replacements
const REPLACEMENT_MAP = {
  '"test-org-1"': "SEED_TEST_IDS.ORGANIZATIONS.primary",
  '"test-org-2"': "SEED_TEST_IDS.ORGANIZATIONS.competitor",
  '"org-1"': "SEED_TEST_IDS.ORGANIZATIONS.primary",
  '"user-1"': "SEED_TEST_IDS.USERS.ADMIN",
  '"user-admin"': "SEED_TEST_IDS.USERS.ADMIN",
  '"test-user-tim"': "SEED_TEST_IDS.USERS.ADMIN",
  '"machine-1"': "SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1",
  '"machine-mm-001"': "SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1",
  '"issue-1"': "SEED_TEST_IDS.ISSUES.ISSUE_1",
  '"mock-org-1"': "SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION",
  '"mock-machine-1"': "SEED_TEST_IDS.MOCK_PATTERNS.MACHINE",
  '"mock-user-1"': "SEED_TEST_IDS.MOCK_PATTERNS.USER",
};

function auditFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const findings = [];

  // Check for hardcoded patterns
  HARDCODED_PATTERNS.forEach((pattern, index) => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach((match) => {
        const suggestion =
          REPLACEMENT_MAP[match] || "SEED_TEST_IDS.[APPROPRIATE_CONSTANT]";
        findings.push({
          file: filePath,
          line: content.substring(0, content.indexOf(match)).split("\n").length,
          hardcoded: match,
          suggestion,
        });
      });
    }
  });

  return findings;
}

function main() {
  console.log("🔍 Auditing hardcoded test values...\n");

  const testFiles = glob.sync("src/**/*.test.ts", { cwd: process.cwd() });
  let totalFindings = 0;

  testFiles.forEach((file) => {
    const findings = auditFile(file);
    if (findings.length > 0) {
      console.log(`📄 ${file}:`);
      findings.forEach((finding) => {
        console.log(
          `  Line ${finding.line}: ${finding.hardcoded} → ${finding.suggestion}`,
        );
        totalFindings++;
      });
      console.log("");
    }
  });

  console.log(
    `\n📊 Found ${totalFindings} hardcoded values across ${testFiles.length} test files\n`,
  );

  if (totalFindings > 0) {
    console.log(
      '🛠️ Run "npm run fix-seed-test-ids" to automatically replace common patterns',
    );
  }
}

if (require.main === module) {
  main();
}
```

### Fix 2: Automated Replacement Script

**File**: `scripts/fix-seed-test-ids.js`

```javascript
#!/usr/bin/env node

const fs = require("fs");
const glob = require("glob");

const REPLACEMENT_MAP = {
  // Organizations
  '"test-org-1"': "SEED_TEST_IDS.ORGANIZATIONS.primary",
  '"test-org-2"': "SEED_TEST_IDS.ORGANIZATIONS.competitor",
  '"test-org-pinpoint"': "SEED_TEST_IDS.ORGANIZATIONS.primary",
  '"test-org-competitor"': "SEED_TEST_IDS.ORGANIZATIONS.competitor",
  '"org-1"': "SEED_TEST_IDS.ORGANIZATIONS.primary",
  '"org-2"': "SEED_TEST_IDS.ORGANIZATIONS.competitor",

  // Users
  '"user-1"': "SEED_TEST_IDS.USERS.ADMIN",
  '"user-admin"': "SEED_TEST_IDS.USERS.ADMIN",
  '"test-user-tim"': "SEED_TEST_IDS.USERS.ADMIN",
  '"test-user-harry"': "SEED_TEST_IDS.USERS.MEMBER1",
  '"user-member"': "SEED_TEST_IDS.USERS.MEMBER1",

  // Machines
  '"machine-1"': "SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1",
  '"machine-mm-001"': "SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1",
  '"machine-afm-001"': "SEED_TEST_IDS.MACHINES.ATTACK_FROM_MARS_1",

  // Issues
  '"issue-1"': "SEED_TEST_IDS.ISSUES.ISSUE_1",
  '"issue-2"': "SEED_TEST_IDS.ISSUES.ISSUE_2",

  // Mock patterns for unit tests
  '"mock-org-1"': "SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION",
  '"mock-machine-1"': "SEED_TEST_IDS.MOCK_PATTERNS.MACHINE",
  '"mock-user-1"': "SEED_TEST_IDS.MOCK_PATTERNS.USER",
  '"mock-issue-1"': "SEED_TEST_IDS.MOCK_PATTERNS.ISSUE",
};

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  let replacements = 0;

  // Check if file already imports SEED_TEST_IDS
  const hasImport = content.includes("SEED_TEST_IDS");

  // Apply replacements
  Object.entries(REPLACEMENT_MAP).forEach(([hardcoded, replacement]) => {
    const count = (content.match(new RegExp(escapeRegex(hardcoded), "g")) || [])
      .length;
    if (count > 0) {
      content = content.replace(
        new RegExp(escapeRegex(hardcoded), "g"),
        replacement,
      );
      replacements += count;
    }
  });

  // Add import if needed and replacements were made
  if (replacements > 0 && !hasImport) {
    // Find existing imports
    const importMatch = content.match(/import.*from.*['"~][^'"]*['"];?\n/g);
    if (importMatch) {
      // Add after last import
      const lastImportIndex = content.lastIndexOf(
        importMatch[importMatch.length - 1],
      );
      const insertIndex =
        lastImportIndex + importMatch[importMatch.length - 1].length;
      const newImport =
        'import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";\n';
      content =
        content.slice(0, insertIndex) + newImport + content.slice(insertIndex);
    } else {
      // Add at top of file
      content =
        'import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";\n\n' +
        content;
    }
  }

  if (replacements > 0) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ ${filePath}: ${replacements} replacements`);
  }

  return replacements;
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function main() {
  console.log("🔧 Fixing hardcoded test values...\n");

  const testFiles = glob.sync("src/**/*.test.ts", { cwd: process.cwd() });
  let totalReplacements = 0;

  testFiles.forEach((file) => {
    totalReplacements += fixFile(file);
  });

  console.log(`\n🎉 Made ${totalReplacements} replacements across test files`);
  console.log(
    "\n⚠️  Please review changes and run tests to ensure functionality is preserved",
  );
}

if (require.main === module) {
  main();
}
```

### Fix 3: Standard SEED_TEST_IDS Usage Patterns

**File**: `docs/testing/seed-test-ids-guide.md`

````markdown
# SEED_TEST_IDS Usage Guide

## Standard Patterns by Test Type

### Unit Tests (Mock Data)

```typescript
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

// Use MOCK_PATTERNS for unit tests with mocked data
expect(result.organizationId).toBe(SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION);
expect(result.userId).toBe(SEED_TEST_IDS.MOCK_PATTERNS.USER);
expect(result.machineId).toBe(SEED_TEST_IDS.MOCK_PATTERNS.MACHINE);
```
````

### Integration Tests (Real Data)

```typescript
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

// Use specific constants for integration tests with seeded data
await withIsolatedTest(workerDb, async (db) => {
  const issue = await db.query.issues.findFirst({
    where: eq(issues.organizationId, SEED_TEST_IDS.ORGANIZATIONS.primary),
  });

  expect(issue.machineId).toBe(SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1);
});
```

### Service Tests (Business Logic)

```typescript
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

// Use primary org for most service logic tests
const result = await issueService.create({
  title: "Test Issue",
  organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
  machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
  createdBy: SEED_TEST_IDS.USERS.ADMIN,
});
```

### Cross-Organization Tests

```typescript
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

// Test organizational boundaries
const primaryData = await getDataForOrg(SEED_TEST_IDS.ORGANIZATIONS.primary);
const competitorData = await getDataForOrg(
  SEED_TEST_IDS.ORGANIZATIONS.competitor,
);

// Should be isolated
expect(primaryData).not.toContainEqual(competitorData[0]);
```

## Replacement Patterns

### Before (Inconsistent)

```typescript
const orgId = "test-org-1";
const userId = "user-123";
const machineId = "machine-mm-001";
const issueId = "issue-abc";
```

### After (Standardized)

```typescript
const orgId = SEED_TEST_IDS.ORGANIZATIONS.primary;
const userId = SEED_TEST_IDS.USERS.ADMIN;
const machineId = SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1;
const issueId = SEED_TEST_IDS.ISSUES.ISSUE_1;
```

````

### Fix 4: File-by-File Application Example

**File**: `src/lib/common/__tests__/organizationValidation.test.ts` (BEFORE/AFTER)

```typescript
// BEFORE (INCONSISTENT HARDCODED VALUES):
describe("Organization validation", () => {
  test("validates organization ID format", () => {
    expect(isValidOrganizationId("org-1")).toBe(true);
    expect(isValidOrganizationId("test-org")).toBe(true);
    expect(isValidOrganizationId("invalid")).toBe(false);
  });

  test("validates organization membership", async () => {
    const mockUser = {
      id: "user-123",
      organizationId: "test-org-pinpoint"
    };

    const result = await validateMembership(mockUser, "test-org-pinpoint");
    expect(result.isValid).toBe(true);
  });

  test("rejects cross-organization access", async () => {
    const mockUser = {
      id: "user-123",
      organizationId: "org-1"
    };

    const result = await validateMembership(mockUser, "org-2");
    expect(result.isValid).toBe(false);
  });
});

// AFTER (STANDARDIZED WITH SEED_TEST_IDS):
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

describe("Organization validation", () => {
  test("validates organization ID format", () => {
    expect(isValidOrganizationId(SEED_TEST_IDS.ORGANIZATIONS.primary)).toBe(true);
    expect(isValidOrganizationId(SEED_TEST_IDS.ORGANIZATIONS.competitor)).toBe(true);
    expect(isValidOrganizationId("invalid")).toBe(false);
  });

  test("validates organization membership", async () => {
    const mockUser = {
      id: SEED_TEST_IDS.USERS.ADMIN,
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary
    };

    const result = await validateMembership(mockUser, SEED_TEST_IDS.ORGANIZATIONS.primary);
    expect(result.isValid).toBe(true);
  });

  test("rejects cross-organization access", async () => {
    const mockUser = {
      id: SEED_TEST_IDS.USERS.ADMIN,
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary
    };

    const result = await validateMembership(mockUser, SEED_TEST_IDS.ORGANIZATIONS.competitor);
    expect(result.isValid).toBe(false);
  });
});
````

### Fix 5: Mock Pattern Standardization

**Pattern**: Standardize mock data patterns across test types

```typescript
// Unit Test Mock Pattern (STANDARDIZED)
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

const mockIssueData = {
  id: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE,
  title: "Mock Issue",
  organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
  machineId: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
  createdBy: SEED_TEST_IDS.MOCK_PATTERNS.USER,
};

// Integration Test Pattern (STANDARDIZED)
const integrationIssueData = {
  id: SEED_TEST_IDS.ISSUES.ISSUE_1,
  title: "Integration Issue",
  organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
  machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
  createdBy: SEED_TEST_IDS.USERS.ADMIN,
};
```

## Success Criteria

### Quantitative Success:

- [ ] **111/111 tests** updated to use SEED_TEST_IDS constants
- [ ] **Zero hardcoded organization IDs** in test assertions
- [ ] **Zero hardcoded user IDs** in test setup
- [ ] **Consistent ID patterns** across all test types

### Qualitative Success:

- [ ] **Predictable debugging**: Test failures reference known constants
- [ ] **Cross-test consistency**: Same entities use same IDs across all tests
- [ ] **Maintenance ease**: Changing test data IDs only requires updating constants file
- [ ] **Standard patterns established**: Clear guidance for future test development

### Pattern Compliance:

- [ ] Unit tests use `SEED_TEST_IDS.MOCK_PATTERNS.*`
- [ ] Integration tests use `SEED_TEST_IDS.ORGANIZATIONS.primary`
- [ ] Service tests use appropriate entity-specific constants
- [ ] Cross-org tests use both `primary` and `competitor` organizations

## Implementation Strategy

### Day 1: Tooling and Analysis

**Morning: Audit and Tooling**

1. **Create audit script** to identify all hardcoded patterns
2. **Run comprehensive audit** across entire test suite
3. **Create automated replacement script** for common patterns

**Afternoon: High-Impact File Testing** 4. **Test replacement script** on 2-3 high-impact files 5. **Validate no test behavior changes** from standardization 6. **Refine replacement patterns** based on initial results

### Day 2: Systematic Application

**Morning: Unit and Service Tests**

1. **Apply replacement script** to unit test files (42 tests)
2. **Manual review and refinement** for complex cases
3. **Apply to service test files** (31 tests)
4. **Validate test suite still passes** after replacements

### Day 3: Integration and Final Cleanup

**Afternoon: Router and Integration Tests** 5. **Apply to router test files** (23 tests) 6. **Apply to integration test files** (15 tests) 7. **Final manual review** of all changes 8. **Full test suite validation** and documentation update

## Validation Commands

```bash
# Audit hardcoded values
node scripts/audit-seed-test-ids.js

# Apply automated fixes
node scripts/fix-seed-test-ids.js

# Validate changes don't break tests
npm run test:brief

# Check specific file types
npm run test src/lib/common/__tests__/ # Unit tests
npm run test src/server/services/__tests__/ # Service tests
npm run test src/server/api/routers/__tests__/ # Router tests

# Full validation
npm run test
npm run typecheck
```

## Dependencies

**Depends on**:

- **All higher priority tasks completed** - This is cleanup/standardization work
- **SEED_TEST_IDS constants** - Must be complete and stable

**Blocks**:

- Nothing (this is maintenance/standardization)

## Unknown Areas Requiring Investigation

1. **Edge Cases**: Are there valid reasons some tests need hardcoded values?
2. **Performance Impact**: Do constant lookups impact test performance?
3. **Pattern Completeness**: Are there hardcoded patterns the audit script misses?
4. **Future Maintenance**: How do we prevent regression to hardcoded values?

## Related Documentation

- **SEED_TEST_IDS constants**: Single source of truth for test data
- **Testing patterns**: All archetypes should use consistent ID patterns
- **Maintenance guides**: Long-term test suite maintenance approach

## Notes for Agent

This task is **pure maintenance and standardization**. It doesn't fix functionality but makes the test suite:

- **More maintainable**: Changes to test data IDs only happen in one place
- **More debuggable**: Test failures reference predictable, known constants
- **More consistent**: Same entities always use same IDs across all tests
- **More professional**: Eliminates arbitrary, inconsistent hardcoded values

**Key principles**:

1. **Consistency over convention**: Use SEED_TEST_IDS everywhere, even when hardcoded values might seem simpler
2. **Pattern separation**: Unit tests use MOCK_PATTERNS, integration tests use entity-specific constants
3. **Automation first**: Use scripts for bulk replacements, manual review for edge cases
4. **No behavior changes**: Standardization should not change test behavior, only test data values

**Implementation approach**: This is a good candidate for automation since most replacements are straightforward string substitutions. The key is ensuring the replacement script handles edge cases correctly and doesn't break test logic.

**Success metric**: When complete, all test failures will reference predictable constants, making debugging much easier and test maintenance more straightforward.
