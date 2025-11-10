#!/usr/bin/env node

/**
 * Status Overview Script - Unified project status checker
 * Based on patterns from agent-deps.cjs, agent-smoke.cjs, and health-check.cjs
 * Provides structured output optimized for Claude analysis
 */

const { execSync } = require("child_process");

// ANSI color codes for output
const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
};

class StatusChecker {
  constructor() {
    this.results = [];
  }

  log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
  }

  checkDependencies() {
    try {
      // Check for outdated packages - handle case where no packages are outdated
      let outdatedCount = 0;
      try {
        const outdatedOutput = execSync("npm outdated --parseable", {
          encoding: "utf8",
          stdio: "pipe",
        });
        outdatedCount = outdatedOutput.trim().split('\n').filter(line => line.length > 0).length;
      } catch (outdatedError) {
        // npm outdated returns exit code 1 when packages are found, 0 when none found
        if (outdatedError.status === 1 && outdatedError.stdout) {
          outdatedCount = outdatedError.stdout.trim().split('\n').filter(line => line.length > 0).length;
        }
        // If status is 0 or other error, outdatedCount remains 0
      }
      
      // Check for vulnerabilities  
      const auditOutput = execSync("npm audit --audit-level=moderate --json", {
        encoding: "utf8", 
        stdio: "pipe",
      });
      
      const auditData = JSON.parse(auditOutput);
      const high = auditData.metadata?.vulnerabilities?.high || 0;
      const moderate = auditData.metadata?.vulnerabilities?.moderate || 0;
      const critical = auditData.metadata?.vulnerabilities?.critical || 0;
      const total = auditData.metadata?.vulnerabilities?.total || 0;

      this.log("🔍 SYSTEM: dependencies");
      
      if (total === 0 && outdatedCount === 0) {
        this.log("STATUS: ✅ healthy");
        this.log(`DETAILS: 0 vulnerabilities, 0 outdated packages`);
      } else if (critical > 0 || high > 0) {
        this.log("STATUS: ❌ critical");
        this.log(`DETAILS: ${total} vulnerabilities (${critical} critical, ${high} high), ${outdatedCount} outdated`);
      } else {
        this.log("STATUS: ⚠️ maintenance");
        this.log(`DETAILS: ${total} vulnerabilities (${moderate} moderate), ${outdatedCount} outdated packages`);
      }
      this.log("CONTEXT: " + (total > 0 ? "Security updates recommended" : "Routine maintenance available"));
      this.log("");
      
    } catch (error) {
      this.log("🔍 SYSTEM: dependencies");
      this.log("STATUS: ❓ unknown");
      this.log("DETAILS: Unable to check dependency status");
      this.log("CONTEXT: Check npm configuration");
      this.log("");
    }
  }

  checkBuild() {
    try {
      // Use typecheck instead of full build (from status:build pattern)
      execSync("npm run typecheck:brief", {
        encoding: "utf8",
        stdio: "pipe",
      });
      
      this.log("🔍 SYSTEM: build");
      this.log("STATUS: ✅ passing");
      this.log("DETAILS: TypeScript compilation successful");
      this.log("CONTEXT: No build issues detected");
      this.log("");
      
    } catch (error) {
      const output = error.stdout || error.stderr || "";
      const errorCount = (output.match(/error TS\d+:/g) || []).length;
      
      this.log("🔍 SYSTEM: build");
      this.log("STATUS: ❌ failing");
      this.log(`DETAILS: ${errorCount} TypeScript errors found`);
      this.log("CONTEXT: Fix compilation errors before deployment");
      this.log("");
    }
  }

  checkTests() {
    try {
      const output = execSync("npm run test:brief", {
        encoding: "utf8",
        stdio: "pipe",
      });
      
      // Parse test results from vitest output
      const testMatch = output.match(/Tests\s+(\d+)\s+passed/);
      const failMatch = output.match(/(\d+)\s+failed/);
      
      const passed = testMatch ? parseInt(testMatch[1]) : 0;
      const failed = failMatch ? parseInt(failMatch[1]) : 0;
      const total = passed + failed;
      
      this.log("🔍 SYSTEM: tests");
      
      if (failed === 0) {
        this.log("STATUS: ✅ passing");
        this.log(`DETAILS: ${passed}/${total} tests passed`);
        this.log("CONTEXT: All test suites healthy");
      } else {
        this.log("STATUS: ❌ failing");
        this.log(`DETAILS: ${passed}/${total} tests passed, ${failed} failures`);
        this.log("CONTEXT: Test failures need investigation");
      }
      this.log("");
      
    } catch (error) {
      this.log("🔍 SYSTEM: tests");
      this.log("STATUS: ❌ failing");
      this.log("DETAILS: Test suite execution failed");
      this.log("CONTEXT: Check test configuration and dependencies");
      this.log("");
    }
  }

  checkLinting() {
    try {
      execSync("npm run lint:brief", {
        encoding: "utf8",
        stdio: "pipe",
      });
      
      this.log("🔍 SYSTEM: code-quality");
      this.log("STATUS: ✅ passing");
      this.log("DETAILS: No linting violations found");
      this.log("CONTEXT: Code quality standards met");
      this.log("");
      
    } catch (error) {
      const output = error.stdout || error.stderr || "";
      const problemMatch = output.match(/(\d+) problems?/);
      const problems = problemMatch ? parseInt(problemMatch[1]) : 1;
      
      this.log("🔍 SYSTEM: code-quality");
      this.log("STATUS: ⚠️ issues");
      this.log(`DETAILS: ${problems} linting problems found`);
      this.log("CONTEXT: Run 'npm run lint:fix' to auto-fix issues");
      this.log("");
    }
  }

  run() {
    this.log(`${colors.blue}${colors.bold}📊 Project Status Overview${colors.reset}\n`);
    
    this.checkDependencies();
    this.checkBuild();
    this.checkTests();
    this.checkLinting();
  }
}

// Run the status checker
const checker = new StatusChecker();
checker.run();