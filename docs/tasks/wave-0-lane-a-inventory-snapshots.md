# Wave 0 Lane A: Inventory & Snapshots

**Agent Role**: Inventory Specialist  
**Target Duration**: 4-6 hours  
**Priority**: Critical (Foundation for other lanes)

## 🎯 Mission Statement

Create comprehensive JSON inventories of all authentication patterns, server fetchers, role conditionals, and organization-scoped functions in the PinPoint codebase. These inventories provide the immutable baseline that other lanes will use for enforcement, migration planning, and performance measurement.

## 📖 Project Context

**PinPoint** is a multi-tenant SaaS application in pre-beta phase with zero production users. The codebase is undergoing **authentication system modernization** to address a crisis of:
- 8+ competing authentication entrypoints causing race conditions
- Duplicate auth resolver calls (4-5x per request)
- Function name collisions leading to inconsistent caching
- Nondeterministic membership failures

**Phase 1 (Complete)**: Consolidated to single canonical resolver `getRequestAuthContext()`  
**Current Phase**: Wave 0 - Baseline & Guard Rails before implementing unified request context

## 🏗️ Architecture Overview

```
PinPoint Authentication Architecture:
├── Phase 1 Canonical Resolver: src/server/auth/context.ts
├── Current Auth Patterns: Multiple legacy functions still in use
├── DAL Layer: src/server/dal/ (15+ files with org scoping)
├── Server Actions: src/app/*/actions.ts (12+ files with role checks)
├── Server Components: src/app/**/page.tsx (25+ with auth resolution)
└── API Routes: src/app/api/ (limited but critical integration points)
```

**Key Technologies**:
- Next.js 15 App Router with React 19
- TypeScript @tsconfig/strictest
- Supabase SSR with session management
- Drizzle ORM with organization scoping
- AsyncLocalStorage for request context

## 📋 Your Specific Deliverables

Generate these 4 JSON files under `docs/baseline/`:

### 1. `fetchers.json`
All server-side data fetching functions that could benefit from caching:

```json
{
  "serverFetchers": [
    {
      "functionName": "getUserMemberships",
      "filePath": "src/server/dal/users.ts",
      "lineNumber": 45,
      "hasCache": false,
      "callSites": 12,
      "authPattern": "requireMemberAccess"
    }
  ],
  "summary": {
    "totalFetchers": 89,
    "cachedFetchers": 23,
    "uncachedFetchers": 66,
    "highUsageFetchers": 15
  }
}
```

### 2. `role-conditionals.json`
All role-based conditional logic:

```json
{
  "roleConditionals": [
    {
      "pattern": "user.role === 'admin'",
      "filePath": "src/app/admin/page.tsx",
      "lineNumber": 34,
      "context": "Server Component role guard",
      "migrationPriority": "high"
    }
  ],
  "summary": {
    "totalConditionals": 47,
    "directRoleChecks": 31,
    "roleBasedPermissions": 16,
    "serverComponents": 23,
    "serverActions": 24
  }
}
```

### 3. `org-scoped-functions.json`
Functions that perform organization-scoped queries:

```json
{
  "orgScopedFunctions": [
    {
      "functionName": "getIssuesForOrg", 
      "filePath": "src/server/dal/issues.ts",
      "lineNumber": 67,
      "scopingPattern": "ensureOrgContextAndBindRLS",
      "queryCount": 1,
      "authDependency": "requireMemberAccess"
    }
  ],
  "summary": {
    "totalFunctions": 156,
    "withRLSBinding": 89,
    "withExplicitScoping": 67,
    "dalFunctions": 78,
    "serverActions": 45,
    "serverComponents": 33
  }
}
```

### 4. `metrics-initial.json`
Baseline metrics snapshot:

```json
{
  "authResolutionPatterns": [
    {
      "functionName": "getRequestAuthContext",
      "callSites": 23,
      "avgCallsPerRequest": 1.2,
      "files": ["src/server/auth/context.ts"]
    },
    {
      "functionName": "requireMemberAccess", 
      "callSites": 45,
      "avgCallsPerRequest": 2.8,
      "files": ["src/server/dal/permissions.ts"]
    }
  ],
  "baseline": {
    "captureDate": "2025-01-XX",
    "totalAuthCallsPerRequest": 2.4,
    "duplicatePatterns": 12,
    "cacheHitRate": 0.67
  }
}
```

## 🔧 Implementation Strategy

### Phase 1: Setup & Validation (30 min)
1. Ensure clean git working directory
2. Verify development server is running (`npm run dev`)
3. Create `docs/baseline/` directory
4. Test basic AST parsing with one small file

### Phase 2: Build Scanning Tools (2 hours)
Create `scripts/wave-0/` directory with utilities:

```javascript
// scripts/wave-0/ast-scanner.js
import ts from 'typescript';
import fs from 'fs';
import path from 'path';

export function scanForAuthPatterns(filePath) {
  const sourceFile = ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.ES2022,
    true
  );
  
  const patterns = [];
  
  function visit(node) {
    // Scan for function calls, role checks, auth patterns
    if (ts.isCallExpression(node)) {
      // Capture relevant patterns
    }
    ts.forEachChild(node, visit);
  }
  
  visit(sourceFile);
  return patterns;
}
```

### Phase 3: Execute Comprehensive Scans (2 hours)
Scan these key directories:
- `src/server/dal/` - Organization-scoped functions
- `src/app/*/actions.ts` - Server Actions with auth
- `src/app/**/page.tsx` - Server Components with auth
- `src/server/auth/` - Authentication utilities
- `src/lib/` - Shared utilities and helpers

### Phase 4: Generate JSON Inventories (1 hour)
Transform scan results into the required JSON format with counts, summaries, and metadata.

### Phase 5: Validation & Quality Check (30 min)
- Verify all JSON files are valid
- Check counts make sense (non-zero, reasonable)
- Spot-check 5-10 entries manually
- Run script twice to ensure stable output

## 🔍 Key Search Patterns

Use these patterns to find relevant code:

```bash
# Auth function calls
rg "requireMemberAccess|getRequestAuthContext|ensureOrgContextAndBindRLS" --type ts

# Role conditionals
rg "\.role\s*===|\.role\s*!==|checkRole|hasRole" --type ts

# Organization scoping
rg "organizationId|orgId" --type ts -A 2 -B 2

# Caching patterns
rg "cache\(|unstable_cache" --type ts

# Server fetcher patterns
rg "export\s+(async\s+)?function|export\s+const\s+\w+\s*=" src/server/dal --type ts
```

## 🤝 Coordination with Other Lanes

**→ Lane B (ESLint)**: Your inventories will inform which patterns to target with new ESLint rules  
**→ Lane C (Codemods)**: Function lists guide transformation priorities  
**→ Lane D (Metrics)**: Auth pattern counts validate baseline measurements

**Communication**: Update `docs/baseline/progress.md` with status every hour

## ⚠️ Risk Mitigation

**Incomplete Coverage**: Use both AST parsing AND regex grep to cross-validate findings  
**Dynamic Patterns**: May miss dynamic imports - supplement with manual review of high-traffic files  
**False Positives**: Include context and line numbers for manual verification

## ✅ Success Criteria

- [ ] All 4 JSON files generated and valid
- [ ] Summary counts are non-zero and reasonable  
- [ ] Spot-check 10 random entries manually confirms accuracy
- [ ] Second script run produces identical results (stability test)
- [ ] Lane B and Lane C teams can use your data immediately

## 📚 Key Files to Understand

Before starting, briefly review these files:
- `src/server/auth/context.ts` - Phase 1 canonical resolver
- `docs/auth/phase-roadmap/AUTHENTICATION_CRISIS_ANALYSIS.md` - Full context
- `docs/auth/PHASE1_COMPLETION.md` - What was already fixed
- `eslint.config.js` - Current enforcement rules

## 🚀 Start Here

1. Create `docs/baseline/` directory
2. Create `scripts/wave-0/` for your utilities  
3. Start with small test scan on `src/server/auth/context.ts`
4. Build comprehensive AST + regex scanning tools
5. Execute full codebase scans
6. Generate and validate JSON inventories

**Remember**: You're providing the foundation data that makes all other Wave 0 work possible. Accuracy and completeness are critical!