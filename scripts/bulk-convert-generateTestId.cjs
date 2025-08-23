#!/usr/bin/env node
/**
 * Bulk Convert generateTestId() to SEED_TEST_IDS
 *
 * Based on comprehensive pattern analysis of 415+ generateTestId() calls
 * across integration and router tests. Handles 85% of cases automatically,
 * flags 15% for manual review.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Files to convert (from pattern analysis)
const INTEGRATION_TEST_FILES = [
  "src/integration-tests/model.core.integration.test.ts",
  "src/integration-tests/schema-data-integrity.integration.test.ts",
  "src/integration-tests/machine.owner.integration.test.ts",
  "src/integration-tests/permissions.integration.test.ts",
  "src/integration-tests/user.integration.test.ts",
  "src/integration-tests/machine.integration.test.ts",
  "src/integration-tests/organization.integration.test.ts",
  "src/integration-tests/role.integration.test.ts",
  "src/integration-tests/notification.integration.test.ts",
  "src/integration-tests/collection.integration.test.ts",
];

const ROUTER_TEST_FILES = [
  "src/server/api/routers/__tests__/issue.test.ts",
  "src/server/api/routers/__tests__/machine.test.ts",
  "src/server/api/routers/__tests__/collection.test.ts",
  "src/server/api/routers/__tests__/location.test.ts",
  "src/server/api/routers/__tests__/user.test.ts",
];

// Core conversion patterns (from subagent analysis)
const AUTOMATED_CONVERSIONS = {
  // Phase 1: Direct SEED_TEST_IDS unwrapping (highest priority)
  "generateTestId\\((SEED_TEST_IDS\\.[A-Z_]+\\.[A-Z_0-9]+)\\)": "$1",

  // Phase 2: Core entity mappings for integration tests
  'generateTestId\\("user"\\)': "SEED_TEST_IDS.USERS.ADMIN",
  'generateTestId\\("test-user"\\)': "SEED_TEST_IDS.USERS.ADMIN",
  'generateTestId\\("target-user"\\)': "SEED_TEST_IDS.USERS.MEMBER1",
  'generateTestId\\("fallback-user"\\)': "SEED_TEST_IDS.USERS.MEMBER2",

  'generateTestId\\("org"\\)': "SEED_TEST_IDS.ORGANIZATIONS.primary",
  'generateTestId\\("test-org"\\)': "SEED_TEST_IDS.ORGANIZATIONS.primary",
  'generateTestId\\("competitor-org"\\)':
    "SEED_TEST_IDS.ORGANIZATIONS.competitor",

  'generateTestId\\("machine"\\)': "SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1",
  'generateTestId\\("test-machine"\\)':
    "SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1",
  'generateTestId\\("competitor-machine"\\)':
    "SEED_TEST_IDS.MACHINES.CACTUS_CANYON_1",

  'generateTestId\\("location"\\)': "SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR",
  'generateTestId\\("test-location"\\)': "SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR",
  'generateTestId\\("competitor-location"\\)':
    "SEED_TEST_IDS.LOCATIONS.UPSTAIRS",

  'generateTestId\\("issue"\\)': "SEED_TEST_IDS.ISSUES.KAIJU_FIGURES",
  'generateTestId\\("competitor-issue"\\)': "SEED_TEST_IDS.ISSUES.LOUD_BUZZING",

  'generateTestId\\("status"\\)': "SEED_TEST_IDS.STATUSES.NEW_PRIMARY",
  'generateTestId\\("priority"\\)': "SEED_TEST_IDS.PRIORITIES.HIGH_PRIMARY",

  'generateTestId\\("role"\\)': "SEED_TEST_IDS.ROLES.ADMIN_PRIMARY",
  'generateTestId\\("admin-role"\\)': "SEED_TEST_IDS.ROLES.ADMIN_PRIMARY",
  'generateTestId\\("test-role"\\)': "SEED_TEST_IDS.ROLES.ADMIN_PRIMARY",

  'generateTestId\\("membership"\\)': "SEED_TEST_IDS.MEMBERSHIPS.ADMIN_PRIMARY",

  // Phase 3: Mock patterns (for service mocks and fallbacks)
  'generateTestId\\("model"\\)': "SEED_TEST_IDS.MOCK_PATTERNS.MODEL",
  'generateTestId\\("collection"\\)': "SEED_TEST_IDS.MOCK_PATTERNS.COLLECTION",
  'generateTestId\\("comment"\\)': "SEED_TEST_IDS.MOCK_PATTERNS.COMMENT",
  'generateTestId\\("notification"\\)':
    "SEED_TEST_IDS.MOCK_PATTERNS.NOTIFICATION",
  'generateTestId\\("test-id"\\)': "SEED_TEST_IDS.MOCK_PATTERNS.ENTITY",
  'generateTestId\\("room-type"\\)': "SEED_TEST_IDS.MOCK_PATTERNS.TYPE",

  // Phase 4: Location/machine variants → generic patterns
  'generateTestId\\("[\\w-]*location[\\w-]*"\\)':
    "SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR",
  'generateTestId\\("[\\w-]*machine[\\w-]*"\\)':
    "SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1",

  // Phase 5: No-argument calls
  "generateTestId\\(\\)": '"mock-generated-id"',
};

// Import statement replacements
const IMPORT_CONVERSIONS = {
  "import.*generateTestId.*from.*test-id-generator.*": "",
  "import.*generateTest(?:Id|Email|Subdomain|Ids).*from.*test-id-generator.*":
    "",
};

// Patterns that need manual review (flag but don't auto-convert)
const MANUAL_REVIEW_PATTERNS = [
  /generateTestId\(`[^`]*\$\{[^}]+\}[^`]*`\)/, // Template literals with variables
  /`[^`]*\$\{generateTestId\([^)]*\)\}[^`]*@[^`]*`/, // Email construction
  /generateTestId\("[^"]*-\d+"?\)/, // Sequential numbered patterns
  /generateTestId\([^)]*\s*\?\s*[^)]*:[^)]*\)/, // Conditional expressions
];

class GenerateTestIdConverter {
  constructor() {
    this.stats = {
      filesProcessed: 0,
      totalReplacements: 0,
      manualReviewCases: 0,
      errors: [],
    };
    this.manualReviewCases = [];
  }

  async convertFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        console.log(`⚠️  File not found: ${filePath}`);
        return;
      }

      const originalContent = fs.readFileSync(filePath, "utf8");
      let content = originalContent;
      let fileReplacements = 0;

      // Check for manual review cases first
      const manualCases = this.findManualReviewCases(content, filePath);
      if (manualCases.length > 0) {
        this.manualReviewCases.push(...manualCases);
        this.stats.manualReviewCases += manualCases.length;
      }

      // Remove old imports first
      for (const [pattern, replacement] of Object.entries(IMPORT_CONVERSIONS)) {
        const regex = new RegExp(pattern, "gm");
        if (regex.test(content)) {
          content = content.replace(regex, replacement);
          fileReplacements++;
        }
      }

      // Add SEED_TEST_IDS import if generateTestId was used
      if (
        originalContent.includes("generateTestId") &&
        !content.includes("SEED_TEST_IDS")
      ) {
        // Find existing imports section and add SEED_TEST_IDS import
        const importMatch = content.match(/^import.*from.*$/gm);
        if (importMatch) {
          const lastImport = importMatch[importMatch.length - 1];
          const insertIndex = content.indexOf(lastImport) + lastImport.length;
          content =
            content.slice(0, insertIndex) +
            '\nimport { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";' +
            content.slice(insertIndex);
        }
      }

      // Apply automated conversions
      for (const [pattern, replacement] of Object.entries(
        AUTOMATED_CONVERSIONS,
      )) {
        const regex = new RegExp(pattern, "g");
        const matches = content.match(regex);
        if (matches) {
          content = content.replace(regex, replacement);
          fileReplacements += matches.length;
          console.log(`  ✅ ${matches.length}x: ${pattern} → ${replacement}`);
        }
      }

      // Write file if changes were made
      if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        console.log(
          `📝 Updated ${filePath} (${fileReplacements} replacements)`,
        );
        this.stats.filesProcessed++;
        this.stats.totalReplacements += fileReplacements;
      } else {
        console.log(`ℹ️  No changes needed: ${filePath}`);
      }
    } catch (error) {
      this.stats.errors.push({ filePath, error: error.message });
      console.error(`❌ Error processing ${filePath}:`, error.message);
    }
  }

  findManualReviewCases(content, filePath) {
    const cases = [];
    const lines = content.split("\n");

    lines.forEach((line, index) => {
      for (const pattern of MANUAL_REVIEW_PATTERNS) {
        const matches = line.match(pattern);
        if (matches) {
          cases.push({
            filePath,
            lineNumber: index + 1,
            line: line.trim(),
            pattern: pattern.toString(),
            match: matches[0],
          });
        }
      }
    });

    return cases;
  }

  async run() {
    console.log(
      "🚀 Starting bulk generateTestId() to SEED_TEST_IDS conversion\n",
    );
    console.log(
      `📊 Analysis: 415+ calls across ${INTEGRATION_TEST_FILES.length + ROUTER_TEST_FILES.length} files`,
    );
    console.log("🎯 Strategy: 85% automated, 15% flagged for manual review\n");

    // Process integration tests
    console.log("🔧 Processing Integration Tests:");
    for (const file of INTEGRATION_TEST_FILES) {
      await this.convertFile(file);
    }

    console.log("\n🔧 Processing Router Tests:");
    // Process router tests
    for (const file of ROUTER_TEST_FILES) {
      await this.convertFile(file);
    }

    // Generate summary report
    this.generateReport();
  }

  generateReport() {
    console.log("\n" + "=".repeat(60));
    console.log("📋 CONVERSION SUMMARY");
    console.log("=".repeat(60));

    console.log(`✅ Files processed: ${this.stats.filesProcessed}`);
    console.log(`🔄 Total replacements: ${this.stats.totalReplacements}`);
    console.log(`⚠️  Manual review cases: ${this.stats.manualReviewCases}`);
    console.log(`❌ Errors: ${this.stats.errors.length}`);

    if (this.stats.errors.length > 0) {
      console.log("\n❌ ERRORS:");
      this.stats.errors.forEach(({ filePath, error }) => {
        console.log(`  ${filePath}: ${error}`);
      });
    }

    if (this.manualReviewCases.length > 0) {
      console.log("\n⚠️  MANUAL REVIEW REQUIRED:");
      this.manualReviewCases.forEach(
        ({ filePath, lineNumber, line, match }) => {
          console.log(`  📄 ${filePath}:${lineNumber}`);
          console.log(`     ${line}`);
          console.log(`     👆 Pattern: ${match}`);
          console.log("");
        },
      );

      console.log("💡 Manual review cases require context-specific decisions:");
      console.log("   • Template literals with variables");
      console.log("   • Email construction patterns");
      console.log("   • Sequential numbered IDs");
      console.log("   • Conditional ID generation");
    }

    console.log("\n🎯 NEXT STEPS:");
    console.log("1. Review manual cases above");
    console.log("2. Run tests: npm run test:brief");
    console.log("3. Fix any TypeScript errors");
    console.log("4. Validate all generateTestId() calls removed");
    console.log("5. Delete test-id-generator.ts when ready");

    if (this.stats.manualReviewCases > 0) {
      console.log(
        `\n⚠️  ${this.stats.manualReviewCases} cases need manual attention before completion`,
      );
    } else {
      console.log("\n✅ All patterns converted! Ready for validation");
    }
  }
}

// Run the conversion
const converter = new GenerateTestIdConverter();
converter.run().catch(console.error);
