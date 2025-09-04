# Lane A: Inventory & Snapshots - Wave 0 Task File

**Agent:** Lane A Specialist  
**Duration:** 1-2 days  
**Status:** READY FOR EXECUTION  

## Mission

Create comprehensive inventories of the current authentication patterns, fetchers, role checks, and organization-scoped functions throughout the PinPoint codebase. Generate immutable JSON snapshots for baseline measurement before any migration begins.

## Context & Current State

The PinPoint codebase has multiple authentication patterns that evolved organically:

### Primary Authentication Functions (Currently in Use)
- `requireMemberAccess` - Most heavily used (7+ action files)  
- `getOrganizationContext` - Context resolution without throwing
- `requireOrganizationContext` - Context resolution with throwing
- `getRequestAuthContext` - NEW canonical resolver (target pattern)
- `ensureOrgContextAndBindRLS` - DAL-specific pattern (needs migration)

### Key Locations to Inventory
- **Action files**: `src/lib/actions/*.ts` (12 files, heavy auth usage)
- **DAL layer**: `src/lib/dal/*.ts` (15 files, org-scoped functions)  
- **API routes**: `src/app/api/**/*.ts` (limited auth usage)
- **Page components**: `src/app/**/page.tsx` (25+ server components)

### Current Auth Infrastructure
- **Canonical resolver**: `src/server/auth/context.ts` - NEW pattern
- **Legacy adapters**: `src/lib/organization-context.ts` - Transition wrappers
- **Supabase integration**: `src/lib/supabase/server.ts` - SSR helpers
- **Instrumentation**: `src/lib/auth/instrumentation.ts` - Metrics tracking

## Deliverables

### 1. Authentication Functions Inventory
**File**: `docs/baseline/auth-functions.json`

```json
{
  "inventoryDate": "2025-01-XX",
  "totalFunctions": 0,
  "patterns": {
    "context": [],
    "requirement": [],
    "action": [],
    "supabase": [],
    "rls": []
  },
  "functions": [
    {
      "name": "requireMemberAccess",
      "location": "src/lib/organization-context.ts:173",
      "pattern": "requirement",
      "usageCount": 0,
      "callSites": [],
      "description": "Primary auth function, heavily used"
    }
  ],
  "highUsageFunctions": [],
  "duplicateNames": []
}
```

### 2. Server Fetchers Inventory
**File**: `docs/baseline/server-fetchers.json`

```json
{
  "inventoryDate": "2025-01-XX", 
  "totalFetchers": 0,
  "cacheWrapped": 0,
  "uncachedFetchers": [],
  "fetchers": [
    {
      "name": "getUserById",
      "location": "src/lib/dal/users.ts:45",
      "isCached": false,
      "isAsync": true,
      "returnType": "Promise<User | null>",
      "usesAuth": true,
      "authPattern": "ensureOrgContextAndBindRLS",
      "callSites": []
    }
  ],
  "patterns": {
    "ensureOrgContextAndBindRLS": 0,
    "withOrgRLS": 0,
    "directDbAccess": 0,
    "supabaseClient": 0
  }
}
```

### 3. Role Conditionals Inventory
**File**: `docs/baseline/role-conditionals.json`

```json
{
  "inventoryDate": "2025-01-XX",
  "totalConditionals": 0,
  "conditionals": [
    {
      "location": "src/lib/actions/admin-actions.ts:97",
      "condition": "membership.role.name === 'admin'",
      "context": "Server Action",
      "function": "deleteUser",
      "lineNumber": 97
    }
  ],
  "roleChecks": {
    "admin": 0,
    "manager": 0,
    "member": 0,
    "viewer": 0
  },
  "patterns": {
    "hardcodedRoleNames": 0,
    "roleIdComparisons": 0,
    "permissionChecks": 0
  }
}
```

### 4. Organization-Scoped Functions Inventory  
**File**: `docs/baseline/org-scoped-functions.json`

```json
{
  "inventoryDate": "2025-01-XX",
  "totalFunctions": 0,
  "scopingPatterns": {
    "explicitOrgId": 0,
    "rlsBinding": 0,
    "contextResolution": 0
  },
  "functions": [
    {
      "name": "getIssuesByStatus",
      "location": "src/lib/dal/issues.ts:123",
      "scopingMethod": "ensureOrgContextAndBindRLS",
      "requiresOrgId": true,
      "isPubliclyAccessible": false,
      "usesRLS": true
    }
  ],
  "violations": [
    {
      "location": "src/lib/dal/something.ts:45",
      "issue": "Missing organization scoping",
      "severity": "critical"
    }
  ]
}
```

## Technical Approach

### Phase 1: Static Code Analysis

**Tool Setup:**
```bash
# Install analysis dependencies if needed
npm install --dev @babel/parser @babel/traverse ts-morph

# Use existing Grep tool for pattern detection
# Use Read tool for detailed file analysis
```

**Search Strategies:**

```bash
# Find all authentication function usage
rg "requireMemberAccess|getOrganizationContext|requireOrganizationContext" --type ts -A 3 -B 3

# Find all cache() usage
rg "cache\(" --type ts -l

# Find all async server functions  
rg "export.*async.*function|export.*async.*=" --type ts

# Find all role conditionals
rg "role\.name|membership\.role|\.role\." --type ts -A 2 -B 2

# Find org-scoped database operations
rg "ensureOrgContextAndBindRLS|withOrgRLS|organizationId" --type ts
```

### Phase 2: AST Analysis for Complex Patterns

**Key Files to Parse:**
1. **Actions**: `src/lib/actions/*.ts` - Complex auth flows
2. **DAL**: `src/lib/dal/*.ts` - Database access patterns  
3. **API Routes**: `src/app/api/**/*.ts` - HTTP auth patterns
4. **Pages**: `src/app/**/page.tsx` - Server Component auth

**Pattern Detection:**
- Function exports with async keyword
- Import statements for auth functions
- Call expressions with auth function names
- JSX expressions with conditional rendering based on roles

### Phase 3: Cross-Reference & Validation

**Consistency Checks:**
1. Verify function counts match between static analysis and AST parsing
2. Cross-reference call sites with actual function definitions
3. Validate no phantom functions (defined but never called)
4. Check for missing cache() wrappers on async functions

## Implementation Script Structure

Create `scripts/phase-0/inventory-generator.ts`:

```typescript
interface InventoryConfig {
  outputDir: string;
  patterns: {
    authFunctions: string[];
    dalFiles: string[];
    actionFiles: string[];
    apiRoutes: string[];
  };
}

class AuthInventoryGenerator {
  async generateAuthFunctions(): Promise<AuthFunctionsInventory> {
    // Implementation
  }
  
  async generateServerFetchers(): Promise<ServerFetchersInventory> {
    // Implementation  
  }
  
  async generateRoleConditionals(): Promise<RoleConditionalsInventory> {
    // Implementation
  }
  
  async generateOrgScopedFunctions(): Promise<OrgScopedFunctionsInventory> {
    // Implementation
  }
}
```

## Key Insights from Codebase Analysis

### Authentication Patterns Currently in Use

1. **Most Critical**: `requireMemberAccess` used in 7+ action files
2. **Transition Pattern**: `getRequestAuthContext` is the target (canonical resolver)
3. **Legacy Pattern**: `ensureOrgContextAndBindRLS` needs migration in DAL layer
4. **SSR Pattern**: Supabase server client with proper cookie handling

### High-Priority Files for Analysis

**Actions with Heavy Auth Usage:**
- `src/lib/actions/issue-actions.ts` - 5+ auth calls
- `src/lib/actions/machine-actions.ts` - 7+ auth calls  
- `src/lib/actions/admin-actions.ts` - 5+ auth calls
- `src/lib/actions/comment-actions.ts` - 4+ auth calls

**DAL Files with RLS Patterns:**
- `src/lib/dal/users.ts` - User management with org scoping
- `src/lib/dal/issues.ts` - Issue queries with org filtering
- `src/lib/dal/machines.ts` - Machine data with org boundary
- `src/lib/dal/organizations.ts` - Org management functions

### Instrumentation Integration

The codebase already has basic instrumentation at `src/lib/auth/instrumentation.ts`. Your inventory should integrate with this to provide usage metrics:

```typescript
import { trackAuthResolverCall } from "~/lib/auth/instrumentation";

// Track detected usage
trackAuthResolverCall('requireMemberAccess', 'inventory-phase');
```

## Validation Steps

1. **Consistency Check**: Run inventory generation twice - outputs should be identical
2. **Coverage Verification**: Manual spot-check 5-10 functions to verify accuracy  
3. **Integration Test**: Verify instrumentation tracking works with existing metrics API
4. **Baseline Stability**: Ensure JSON files contain complete, non-empty data

## Risk Mitigation

### Common Pitfalls
- **Dynamic Imports**: May miss functions loaded via dynamic imports
- **String Templates**: Auth function names in template literals won't be detected
- **Aliased Imports**: Functions imported with different names

### Fallback Strategies
- Use both regex (Grep) and AST parsing for comprehensive coverage
- Manual verification of high-usage functions
- Cross-reference with existing `LEGACY_AUTH_INVENTORY` in `src/lib/auth/legacy-inventory.ts`

## Dependencies & Prerequisites

### Files You Need to Understand
- `src/lib/auth/legacy-inventory.ts` - Existing function catalog
- `eslint-rules/no-legacy-auth-imports.js` - Current enforcement
- `src/lib/auth/instrumentation.ts` - Metrics integration
- `docs/auth/phase-roadmap/wave-0-baseline-and-guardrails.md` - Overall strategy

### Environment Setup
```bash
# Ensure development server is running for context
npm run dev

# Install any needed analysis tools
npm install

# Verify linting works (baseline enforcement)  
npm run lint
```

### Success Criteria

✅ **4 Complete JSON Files**: All baseline inventories generated  
✅ **Non-Zero Counts**: Functions and patterns properly detected  
✅ **Consistency**: Repeated runs produce identical outputs  
✅ **Integration**: Works with existing instrumentation system  
✅ **Documentation**: Clear methodology and assumptions documented

## Next Steps (After Completion)

Your inventories will feed into:
- **Lane B**: ESLint rule enhancements based on detected patterns
- **Lane C**: Codemod target identification from your function lists  
- **Lane D**: Baseline metrics correlation with your usage counts
- **Wave 1**: Migration priority based on your high-usage function identification

Coordinate with other Lane agents to ensure consistent data structures and validation approaches.
