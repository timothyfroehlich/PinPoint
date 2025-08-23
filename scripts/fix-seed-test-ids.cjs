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
