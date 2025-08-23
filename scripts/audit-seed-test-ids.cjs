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
