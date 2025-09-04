# Lane C: Codemod Harness - Wave 0 Task File

**Agent:** Lane C Specialist  
**Duration:** 1-2 days  
**Status:** READY FOR EXECUTION  

## Mission

Build a robust codemod harness infrastructure using TypeScript AST tooling. Create the foundation for safe, measurable, and reversible code transformations without actually performing any transformations in Wave 0. Focus on dry-run capabilities, batch processing, and rollback mechanisms.

## Context & Current State

PinPoint has a basic codemod infrastructure that needs systematic expansion:

### Existing Codemod Infrastructure
```
scripts/codemods/
├── README.md              # Documentation for DAL migration codemod
├── migrate-dal-functions.ts # Single transformation (ensureOrgContextAndBindRLS → withOrgRLS)
└── (Missing: harness, utilities, testing framework)
```

### Current Transformation Pattern
The existing `migrate-dal-functions.ts` uses `jscodeshift` for AST manipulation:

```typescript
// Current approach: jscodeshift-based transformation
npx jscodeshift -t scripts/codemods/migrate-dal-functions.ts src/lib/dal/*.ts --dry --parser=tsx
```

### Key Codebase Insights for Codemod Planning

**High-Priority Transformation Targets** (from analysis):
1. **DAL Functions**: `src/lib/dal/*.ts` - 15 files with `ensureOrgContextAndBindRLS` 
2. **Action Files**: `src/lib/actions/*.ts` - 12 files with `requireMemberAccess` calls
3. **Server Components**: `src/app/**/page.tsx` - 25+ files with various auth patterns
4. **API Routes**: `src/app/api/**/*.ts` - Limited but critical auth usage

**Complex Pattern Examples:**
```typescript
// Pattern 1: DAL function transformation (existing codemod handles this)
export const getUserById = cache(async (userId: string) => {
  return ensureOrgContextAndBindRLS(async (tx, context) => {
    const organizationId = context.organization.id;
    // ... database operations
  });
});

// Pattern 2: Action auth migration (needs new codemod)
export async function updateUser(formData: FormData) {
  const { user, organization, membership } = await requireMemberAccess();
  // ... action logic
}

// Pattern 3: Server Component auth (needs new codemod) 
export default async function UserPage({ params }: { params: { id: string } }) {
  const ctx = await getOrganizationContext();
  if (!ctx) redirect('/login');
  // ... component logic
}
```

## Deliverables

### 1. Core Codemod Harness

#### A. Unified Runner Script
**File**: `scripts/codemods/runner.ts`

```typescript
interface CodemodConfig {
  name: string;
  description: string;
  targetPatterns: string[];
  transform: string; // Path to transformation file
  dryRun: boolean;
  batchSize: number;
  maxFiles: number;
}

interface CodemodResult {
  filesProcessed: number;
  filesModified: number;
  filesSkipped: number;
  errors: CodemodError[];
  summary: TransformationSummary;
}

class CodemodRunner {
  async runTransformation(config: CodemodConfig): Promise<CodemodResult> {
    // Implementation
  }
  
  async validateTransformation(config: CodemodConfig): Promise<ValidationResult> {
    // Pre-flight checks
  }
  
  async rollbackTransformation(transformId: string): Promise<void> {
    // Rollback mechanism
  }
}
```

#### B. AST Utilities Framework  
**File**: `scripts/codemods/utils/ast-utils.ts`

```typescript
import { Project, SourceFile, SyntaxKind } from 'ts-morph';

export class ASTAnalyzer {
  constructor(private project: Project) {}
  
  // Function analysis utilities
  findAsyncFunctions(sourceFile: SourceFile): FunctionDeclaration[] {
    return sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration)
      .filter(fn => fn.isAsync());
  }
  
  findAuthFunctionCalls(sourceFile: SourceFile): CallExpression[] {
    return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter(call => this.isAuthFunctionCall(call));
  }
  
  // Import management utilities  
  addImportIfMissing(sourceFile: SourceFile, moduleSpecifier: string, importName: string): void {
    // Implementation
  }
  
  removeUnusedImports(sourceFile: SourceFile): void {
    // Implementation  
  }
  
  // Safe transformation utilities
  replaceCallExpression(call: CallExpression, newExpression: string): void {
    // Implementation with error handling
  }
}

export class TransformationValidator {
  validateSyntax(sourceFile: SourceFile): ValidationError[] {
    // Ensure transformations don't break syntax
  }
  
  validateTypeIntegrity(sourceFile: SourceFile): ValidationError[] {
    // Check TypeScript type correctness
  }
  
  validateImports(sourceFile: SourceFile): ValidationError[] {
    // Verify import statements are valid
  }
}
```

#### C. Batch Processing Engine
**File**: `scripts/codemods/utils/batch-processor.ts`

```typescript
interface BatchConfig {
  maxConcurrent: number;
  maxFilesPerBatch: number;
  retryAttempts: number;
  timeoutMs: number;
}

interface ProcessingResult {
  batchId: string;
  filesProcessed: string[];
  filesModified: string[];
  errors: ProcessingError[];
  timing: {
    startTime: number;
    endTime: number;
    duration: number;
  };
}

export class BatchProcessor {
  async processBatch(files: string[], transform: Transform, config: BatchConfig): Promise<ProcessingResult> {
    // Parallel processing with limits
    // Error handling and recovery
    // Progress tracking
  }
  
  async createSafetySnapshot(files: string[]): Promise<SnapshotId> {
    // Create Git stash or backup copies before transformation
  }
  
  async rollbackBatch(snapshotId: SnapshotId): Promise<void> {
    // Restore from snapshot if transformation fails
  }
}
```

### 2. Transformation Templates & Dry-Run System

#### A. Transformation Template System
**Directory**: `scripts/codemods/templates/`

```typescript
// templates/auth-migration-template.ts
export interface AuthMigrationConfig {
  sourceFunction: string; // 'requireMemberAccess'
  targetFunction: string; // 'getRequestAuthContext' 
  destructurePattern?: string; // Optional destructuring change
}

export const AUTH_MIGRATION_TRANSFORMATIONS: Record<string, AuthMigrationConfig> = {
  'requireMemberAccess': {
    sourceFunction: 'requireMemberAccess',
    targetFunction: 'getRequestAuthContext',
    destructurePattern: 'const { user, organization, membership } = ctx;'
  },
  'getOrganizationContext': {
    sourceFunction: 'getOrganizationContext', 
    targetFunction: 'getRequestAuthContext',
    destructurePattern: 'const ctx = await getRequestAuthContext(); if (ctx.kind !== "authorized") return null;'
  }
};
```

#### B. Dry-Run Analysis Engine
**File**: `scripts/codemods/dry-run-analyzer.ts`

```typescript
interface DryRunResult {
  targetFiles: string[];
  plannedChanges: PlannedChange[];
  potentialIssues: TransformationRisk[];
  estimatedImpact: ImpactAnalysis;
}

interface PlannedChange {
  file: string;
  lineNumber: number;
  changeType: 'function-call' | 'import' | 'parameter' | 'return-type';
  before: string;
  after: string;
  confidence: 'high' | 'medium' | 'low';
}

export class DryRunAnalyzer {
  async analyzePlannedTransformation(config: CodemodConfig): Promise<DryRunResult> {
    // Scan target files
    // Identify transformation opportunities
    // Predict issues and conflicts
    // Estimate impact scope
  }
  
  async generateTransformationReport(result: DryRunResult): Promise<string> {
    // Human-readable summary
    // File-by-file breakdown  
    // Risk assessment
    // Recommendation summary
  }
}
```

#### C. Dry-Run Output Format
**File**: `docs/baseline/codemod-dry-run-example.json`

```json
{
  "codemodName": "auth-migration-require-member-access",
  "analysisDate": "2025-01-XX",
  "scope": {
    "totalFiles": 150,
    "targetFiles": 23,  
    "excludedFiles": 5,
    "skipReasons": {
      "test-files": 3,
      "legacy-adapters": 2  
    }
  },
  "plannedChanges": [
    {
      "file": "src/lib/actions/issue-actions.ts",
      "lineNumber": 110,
      "changeType": "function-call",
      "before": "const { user, organization, membership } = await requireMemberAccess();",
      "after": "const ctx = await getRequestAuthContext(); if (ctx.kind !== 'authorized') throw new Error('Auth required');",
      "confidence": "high"
    }
  ],
  "risks": [
    {
      "type": "type-mismatch",
      "severity": "medium", 
      "files": ["src/lib/actions/admin-actions.ts"],
      "description": "Return type change may affect downstream usage"
    }
  ],
  "summary": {
    "functionCallChanges": 47,
    "importChanges": 15,  
    "parameterChanges": 8,
    "estimatedBreakingChanges": 2
  }
}
```

### 3. Rollback & Safety Mechanisms

#### A. Git Integration for Safety
**File**: `scripts/codemods/utils/git-safety.ts`

```typescript
export class GitSafetyManager {
  async createTransformationBranch(codemodName: string): Promise<string> {
    // Create branch: `codemod/${codemodName}-${timestamp}`
    // Switch to new branch
    // Return branch name
  }
  
  async createPreTransformSnapshot(): Promise<string> {
    // Git stash with descriptive message
    // Return stash hash
  }
  
  async validateCleanWorkingDirectory(): Promise<void> {
    // Ensure no uncommitted changes
    // Throw if working directory is dirty
  }
  
  async rollbackTransformation(snapshotId: string): Promise<void> {
    // Restore from Git stash or reset to commit
  }
}
```

#### B. File-Level Backup System
**File**: `scripts/codemods/utils/backup-manager.ts`

```typescript
export class BackupManager {
  private backupDir = '.codemod-backups';
  
  async createFileBackups(files: string[]): Promise<BackupSet> {
    // Copy original files to timestamped backup directory
    // Create manifest with file hashes for integrity
  }
  
  async restoreFromBackup(backupId: string, files?: string[]): Promise<void> {
    // Restore specific files or entire backup set
  }
  
  async cleanupOldBackups(daysToKeep: number): Promise<void> {
    // Remove backup sets older than specified days
  }
  
  async validateBackupIntegrity(backupId: string): Promise<boolean> {
    // Verify file hashes match backup manifest
  }
}
```

#### C. Rollback Testing Framework
**File**: `scripts/codemods/utils/rollback-tester.ts`

```typescript
export class RollbackTester {
  async testRollbackScenario(config: CodemodConfig): Promise<RollbackTestResult> {
    // 1. Apply transformation to test files
    // 2. Verify transformation worked
    // 3. Execute rollback
    // 4. Verify files match original state
    // 5. Return test results
  }
  
  async generateRollbackReport(results: RollbackTestResult[]): Promise<string> {
    // Summary of rollback test effectiveness
    // Any files that couldn't be properly restored
    // Recommendations for improving rollback safety
  }
}
```

### 4. Codemod Registry & Management

#### A. Codemod Registry
**File**: `scripts/codemods/registry.ts`

```typescript
interface CodemodManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  targetPatterns: string[];
  dependencies: string[];
  transformFile: string;
  testFile: string;
  dryRunSupport: boolean;
  rollbackSupport: boolean;
  estimatedRisk: 'low' | 'medium' | 'high';
}

export const CODEMOD_REGISTRY: Record<string, CodemodManifest> = {
  'migrate-dal-functions': {
    id: 'migrate-dal-functions',
    name: 'DAL Function Migration',
    description: 'Migrate DAL functions from ensureOrgContextAndBindRLS to withOrgRLS pattern',
    version: '1.0.0',
    targetPatterns: ['src/lib/dal/*.ts'],
    dependencies: [],
    transformFile: 'migrate-dal-functions.ts',
    testFile: 'migrate-dal-functions.test.ts',
    dryRunSupport: true,
    rollbackSupport: true,
    estimatedRisk: 'medium'
  },
  
  'migrate-require-member-access': {
    id: 'migrate-require-member-access', 
    name: 'requireMemberAccess Migration',
    description: 'Migrate requireMemberAccess calls to getRequestAuthContext pattern',
    version: '1.0.0',
    targetPatterns: ['src/lib/actions/*.ts'],
    dependencies: ['migrate-dal-functions'], // Run after DAL migration
    transformFile: 'migrate-require-member-access.ts', // To be created in Wave 1
    testFile: 'migrate-require-member-access.test.ts',
    dryRunSupport: true,
    rollbackSupport: true,
    estimatedRisk: 'high'
  }
};
```

#### B. Registry Manager
**File**: `scripts/codemods/registry-manager.ts`

```typescript
export class RegistryManager {
  async listAvailableCodemods(): Promise<CodemodManifest[]> {
    return Object.values(CODEMOD_REGISTRY);
  }
  
  async getCodemodDependencies(codemodId: string): Promise<string[]> {
    // Return ordered list of dependency codemods
  }
  
  async validateCodemodExists(codemodId: string): Promise<boolean> {
    return codemodId in CODEMOD_REGISTRY;
  }
  
  async planExecutionOrder(codemodIds: string[]): Promise<string[]> {
    // Topological sort based on dependencies  
  }
}
```

## Technical Implementation Details

### AST Tooling Choice: ts-morph vs jscodeshift

**Recommendation: Hybrid Approach**
- **ts-morph** for complex TypeScript analysis (better type information)
- **jscodeshift** for simple pattern transformations (mature ecosystem)

```typescript
// ts-morph example for complex analysis
const project = new Project({
  tsConfigFilePath: "tsconfig.json"
});

const sourceFile = project.getSourceFile("src/lib/actions/issue-actions.ts");
const functionDeclarations = sourceFile.getFunctions();

functionDeclarations.forEach(func => {
  const authCalls = func.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter(call => isAuthFunctionCall(call));
  
  if (authCalls.length > 1) {
    console.warn(`Duplicate auth calls in ${func.getName()}`);
  }
});

// jscodeshift example for simple transformations  
export default function transformer(file, api, options) {
  const j = api.jscodeshift;
  const root = j(file.source);
  
  // Find and replace requireMemberAccess calls
  root.find(j.CallExpression, {
    callee: { name: 'requireMemberAccess' }
  }).replaceWith(
    j.callExpression(
      j.identifier('getRequestAuthContext'),
      []
    )
  );
  
  return root.toSource();
}
```

### Performance & Memory Management

**For Large Codebases:**
- Process files in batches (max 50 files simultaneously)
- Use worker threads for CPU-intensive AST parsing
- Implement memory monitoring and cleanup
- Cache AST parsing results for repeated analysis

```typescript
// Worker thread pattern for AST processing
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';

if (isMainThread) {
  // Main thread: distribute work
  const workers = [];
  const fileBatches = chunkArray(allFiles, 10);
  
  fileBatches.forEach(batch => {
    const worker = new Worker(__filename, { workerData: batch });
    workers.push(worker);
  });
} else {
  // Worker thread: process files  
  const files = workerData;
  const results = await processFileBatch(files);
  parentPort.postMessage(results);
}
```

### Error Handling & Recovery

**Transformation Safety Layers:**
1. **Pre-flight validation** - Syntax check before transformation
2. **Atomic file operations** - All-or-nothing file updates
3. **Transaction log** - Record all changes for rollback
4. **Integrity checks** - Verify TypeScript compilation after changes

```typescript
export class TransformationTransaction {
  private changeLog: FileChange[] = [];
  
  async executeTransformation(files: string[], transform: Transform): Promise<void> {
    // Create backup
    const backupId = await this.backupManager.createBackups(files);
    
    try {
      // Apply transformations atomically
      for (const file of files) {
        const changes = await this.applyTransformToFile(file, transform);
        this.changeLog.push(...changes);
      }
      
      // Validate results
      await this.validateAllChanges();
      
      // Commit if validation passes
      await this.commitChanges();
      
    } catch (error) {
      // Rollback on any failure
      await this.rollbackChanges(backupId);
      throw error;
    }
  }
}
```

## Integration with Other Lanes

### Support Lane A (Inventory)
- Use Lane A's function inventories to target specific patterns
- Validate codemod scope matches inventory findings
- Cross-reference transformation results with usage counts

### Coordinate with Lane B (ESLint)
- Ensure codemods don't trigger new ESLint violations  
- Temporarily disable conflicting rules during transformation
- Test that transformed code passes enhanced ESLint checks

### Enable Lane D (Metrics)
- Provide transformation metrics (files modified, patterns changed)
- Measure performance impact of transformations
- Track rollback usage and effectiveness

## Success Criteria & Validation

### Wave 0 Success Criteria
✅ **Robust Runner**: Can execute existing DAL codemod safely  
✅ **Dry-Run System**: Shows planned changes without modification  
✅ **Rollback Mechanism**: Can restore files after transformation  
✅ **Batch Processing**: Handles 50+ files efficiently  
✅ **Safety Checks**: Prevents transformation of dirty working directory  
✅ **Error Handling**: Graceful failure with informative messages  

### Validation Tests
```bash
# Test 1: Dry-run accuracy
npm run codemod:dry-run migrate-dal-functions
# Should show planned changes without modifying files

# Test 2: Safe transformation execution  
npm run codemod:execute migrate-dal-functions --batch-size=5
# Should transform files and pass type checking

# Test 3: Rollback functionality
npm run codemod:rollback <snapshot-id>
# Should restore original file state

# Test 4: Error handling
npm run codemod:execute nonexistent-codemod
# Should fail gracefully with helpful error

# Test 5: Large batch processing
npm run codemod:dry-run migrate-require-member-access
# Should handle 20+ files without memory issues
```

### Performance Benchmarks
- **File Analysis**: < 100ms per TypeScript file
- **Batch Processing**: 50 files in < 5 seconds
- **Memory Usage**: < 500MB peak for full codebase analysis
- **Rollback Speed**: < 2 seconds for 100 file rollback

## Risk Management

### Major Risks
- **AST Parsing Failures** - TypeScript files with complex patterns
- **Memory Exhaustion** - Processing entire codebase simultaneously  
- **Git Integration Issues** - Backup/rollback failures
- **Type System Violations** - Transformations break TypeScript compilation

### Mitigation Strategies
- **Parser Fallbacks** - Multiple AST parsing strategies
- **Memory Monitoring** - Process size limits and cleanup
- **Multiple Backup Methods** - Git + file system backups
- **Validation Pipeline** - TypeScript check after every transformation

## Future Wave Preparation

Your codemod harness will enable:
- **Wave 1**: Large-scale `requireMemberAccess` → `getRequestAuthContext` migration
- **Wave 2**: Permission DSL pattern introduction and migration  
- **Wave 3**: Cache wrapper additions and performance optimizations
- **Wave 4**: Test pattern migrations and cleanup

The infrastructure you build in Wave 0 is the foundation for all subsequent automated migrations.

## Dependencies & Prerequisites

### Required Understanding
- `scripts/codemods/migrate-dal-functions.ts` - Existing transformation pattern
- `scripts/codemods/README.md` - Current codemod documentation  
- Lane A output - Target functions and usage patterns
- `tsconfig.json` configurations - TypeScript project structure

### Development Environment  
```bash
# Install required AST tooling
npm install --save-dev ts-morph jscodeshift @types/jscodeshift

# Verify TypeScript compilation works
npm run typecheck

# Test existing codemod functionality
cd scripts/codemods
npx jscodeshift -t migrate-dal-functions.ts ../../src/lib/dal/users.ts --dry --parser=tsx
```

Build the transformation infrastructure that will power PinPoint's authentication modernization journey.
