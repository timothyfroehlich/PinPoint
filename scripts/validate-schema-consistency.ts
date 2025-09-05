#!/usr/bin/env tsx
/**
 * Validation Schema Consistency Checker
 *
 * Scans the codebase for validation patterns and detects:
 * 1. Duplicate validation logic that should use centralized schemas
 * 2. Inconsistent validation limits across the same data types
 * 3. Missing imports from the centralized validation library
 * 4. Inline validation patterns that bypass the shared schemas
 *
 * Usage: npm run validate:consistency
 */

import { readFile, readdir, stat } from "fs/promises";
import { join, relative } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..");

// Known centralized validation patterns that should be used
const CENTRALIZED_PATTERNS = {
  // ID patterns
  ID_REQUIRED: /z\.string\(\)\.min\(1.*?required.*?\)/gi,
  UUID_PATTERN: /z\.string\(\).*?uuid/gi,
  
  // Text content patterns
  NAME_VALIDATION: /z\.string\(\)\.min\(1.*?name.*?required.*?\)\.max\(\d+/gi,
  TITLE_VALIDATION: /z\.string\(\)\.min\(1.*?title.*?required.*?\)\.max\(\d+/gi,
  COMMENT_VALIDATION: /z\.string\(\)\.min\(1.*?comment.*?\)\.max\(\d+/gi,
  DESCRIPTION_VALIDATION: /z\.string\(\).*?description.*?max\(\d+/gi,
  
  // Email patterns
  EMAIL_VALIDATION: /z\.string\(\)\.email\(/gi,
  
  // Search patterns
  SEARCH_VALIDATION: /z\.string\(\).*?search.*?max\(\d+/gi,
} as const;

// Expected imports from centralized validation
const EXPECTED_IMPORTS = [
  "idSchema",
  "uuidSchema", 
  "nameSchema",
  "titleSchema",
  "commentContentSchema",
  "descriptionSchema",
  "emailSchema",
  "searchQuerySchema",
] as const;

interface ValidationIssue {
  file: string;
  line: number;
  type: "duplicate" | "inconsistent" | "missing_import" | "inline_pattern";
  pattern: string;
  suggestion: string;
  severity: "error" | "warning" | "info";
}

class ValidationConsistencyChecker {
  private issues: ValidationIssue[] = [];
  private checkedFiles = 0;
  private totalFiles = 0;

  async scan(): Promise<ValidationIssue[]> {
    console.log("🔍 Scanning codebase for validation consistency...\n");
    
    await this.scanDirectory(join(PROJECT_ROOT, "src"));
    
    console.log(`\n📊 Scanned ${this.checkedFiles} files\n`);
    
    if (this.issues.length === 0) {
      console.log("✅ No validation consistency issues found!");
    } else {
      this.reportIssues();
    }
    
    return this.issues;
  }

  private async scanDirectory(dirPath: string): Promise<void> {
    try {
      const entries = await readdir(dirPath);
      
      for (const entry of entries) {
        const fullPath = join(dirPath, entry);
        const stats = await stat(fullPath);
        
        if (stats.isDirectory()) {
          // Skip node_modules and other unwanted directories
          if (!entry.startsWith(".") && !["node_modules", "dist", "build"].includes(entry)) {
            await this.scanDirectory(fullPath);
          }
        } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
          this.totalFiles++;
          await this.scanFile(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${dirPath}:`, error);
    }
  }

  private async scanFile(filePath: string): Promise<void> {
    try {
      const content = await readFile(filePath, "utf-8");
      const relativePath = relative(PROJECT_ROOT, filePath);
      
      this.checkedFiles++;
      
      // Skip centralized validation files themselves
      if (filePath.includes("lib/validation") || filePath.includes("lib/common/inputValidation")) {
        return;
      }
      
      // Check for duplicate validation patterns
      this.checkDuplicatePatterns(content, relativePath);
      
      // Check for missing imports
      this.checkMissingImports(content, relativePath);
      
      // Check for inline validation patterns
      this.checkInlinePatterns(content, relativePath);
      
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
    }
  }

  private checkDuplicatePatterns(content: string, filePath: string): void {
    const lines = content.split("\n");
    
    lines.forEach((line, index) => {
      // Check for inline ID validation
      if (line.match(/z\.string\(\)\.min\(1.*?required.*?\)/i) && !line.includes("createIdSchema")) {
        this.issues.push({
          file: filePath,
          line: index + 1,
          type: "duplicate",
          pattern: line.trim(),
          suggestion: "Use `idSchema` from ~/lib/validation/schemas",
          severity: "error"
        });
      }
      
      // Check for inline name validation
      if (line.match(/z\.string\(\)\.min\(1.*?name.*?required.*?\)\.max\(255/i)) {
        this.issues.push({
          file: filePath,
          line: index + 1,
          type: "duplicate",
          pattern: line.trim(),
          suggestion: "Use `nameSchema` from ~/lib/validation/schemas",
          severity: "error"
        });
      }
      
      // Check for inline title validation  
      if (line.match(/z\.string\(\)\.min\(1.*?title.*?required.*?\)\.max\(200/i)) {
        this.issues.push({
          file: filePath,
          line: index + 1,
          type: "duplicate",
          pattern: line.trim(),
          suggestion: "Use `titleSchema` from ~/lib/validation/schemas",
          severity: "error"
        });
      }
      
      // Check for inline comment validation
      if (line.match(/z\.string\(\)\.min\(1.*?comment.*?\)\.max\(2000/i)) {
        this.issues.push({
          file: filePath,
          line: index + 1,
          type: "duplicate",
          pattern: line.trim(),
          suggestion: "Use `commentContentSchema` from ~/lib/validation/schemas",
          severity: "error"
        });
      }
      
      // Check for inline email validation
      if (line.match(/z\.string\(\)\.email\(/i) && !line.includes("emailSchema")) {
        this.issues.push({
          file: filePath,
          line: index + 1,
          type: "duplicate",
          pattern: line.trim(),
          suggestion: "Use `emailSchema` from ~/lib/validation/schemas",
          severity: "warning"
        });
      }
    });
  }

  private checkMissingImports(content: string, filePath: string): void {
    // Check if file uses validation but doesn't import from centralized schemas
    const hasValidation = /z\.(string|object|array)/.test(content);
    const hasZodImport = /from ['"](?:zod|~\/lib\/validation)/.test(content);
    const hasCentralizedImport = /from ['"]~\/lib\/validation/.test(content);
    
    if (hasValidation && hasZodImport && !hasCentralizedImport) {
      // Check if it uses patterns that should come from centralized validation
      const hasIdValidation = /z\.string\(\)\.min\(1.*?required/.test(content);
      const hasNameValidation = /name.*required/.test(content);
      const hasTitleValidation = /title.*required/.test(content);
      
      if (hasIdValidation || hasNameValidation || hasTitleValidation) {
        this.issues.push({
          file: filePath,
          line: 1,
          type: "missing_import",
          pattern: "Missing centralized validation import",
          suggestion: "Import validation schemas from ~/lib/validation/schemas",
          severity: "warning"
        });
      }
    }
  }

  private checkInlinePatterns(content: string, filePath: string): void {
    const lines = content.split("\n");
    
    lines.forEach((line, index) => {
      // Check for hardcoded limits that don't match LIMITS constants
      const maxMatches = line.match(/\.max\((\d+)/g);
      if (maxMatches) {
        maxMatches.forEach(match => {
          const limit = parseInt(match.replace(/\.max\(/, ""));
          
          // Check if it's a non-standard limit that should use LIMITS
          if ([200, 255, 320, 2000, 5000].includes(limit) && !line.includes("LIMITS.")) {
            this.issues.push({
              file: filePath,
              line: index + 1,
              type: "inline_pattern",
              pattern: line.trim(),
              suggestion: `Use LIMITS constant instead of hardcoded ${limit}`,
              severity: "info"
            });
          }
        });
      }
      
      // Check for inconsistent error messages
      if (line.includes("is required") || line.includes("required")) {
        const hasCustomMessage = /min\(1,\s*[{"]/.test(line);
        if (hasCustomMessage && !line.includes("createIdSchema") && !line.includes("Schema")) {
          this.issues.push({
            file: filePath,
            line: index + 1,
            type: "inline_pattern",
            pattern: line.trim(),
            suggestion: "Consider using centralized schema with consistent error messages",
            severity: "info"
          });
        }
      }
    });
  }

  private reportIssues(): void {
    const groupedIssues = this.issues.reduce((groups, issue) => {
      const key = issue.type;
      if (!groups[key]) groups[key] = [];
      groups[key].push(issue);
      return groups;
    }, {} as Record<string, ValidationIssue[]>);

    console.log(`❌ Found ${this.issues.length} validation consistency issues:\n`);

    // Report errors first
    if (groupedIssues.duplicate) {
      console.log("🚨 DUPLICATE VALIDATION PATTERNS (should use centralized schemas):");
      groupedIssues.duplicate.forEach(issue => {
        console.log(`   ${issue.file}:${issue.line}`);
        console.log(`   Pattern: ${issue.pattern}`);
        console.log(`   Fix: ${issue.suggestion}\n`);
      });
    }

    // Report warnings
    if (groupedIssues.missing_import) {
      console.log("⚠️  MISSING CENTRALIZED IMPORTS:");
      groupedIssues.missing_import.forEach(issue => {
        console.log(`   ${issue.file}: ${issue.suggestion}\n`);
      });
    }

    // Report info
    if (groupedIssues.inline_pattern) {
      console.log("💡 INLINE PATTERNS (could be improved):");
      groupedIssues.inline_pattern.forEach(issue => {
        console.log(`   ${issue.file}:${issue.line}`);
        console.log(`   Suggestion: ${issue.suggestion}\n`);
      });
    }

    // Summary
    const errorCount = (groupedIssues.duplicate || []).length;
    const warningCount = (groupedIssues.missing_import || []).length;
    const infoCount = (groupedIssues.inline_pattern || []).length;

    console.log("📈 Summary:");
    console.log(`   Errors: ${errorCount} (must fix)`);
    console.log(`   Warnings: ${warningCount} (should fix)`);  
    console.log(`   Info: ${infoCount} (could improve)`);

    if (errorCount > 0) {
      console.log("\n🎯 Priority: Fix duplicate validation patterns first");
      process.exit(1);
    }
  }
}

// CLI execution
async function main() {
  const checker = new ValidationConsistencyChecker();
  await checker.scan();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { ValidationConsistencyChecker };