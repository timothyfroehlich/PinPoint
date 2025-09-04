# Lane B: Enforcement (ESLint/CI) - Wave 0 Task File

**Agent:** Lane B Specialist  
**Duration:** 1-2 days  
**Status:** READY FOR EXECUTION  

## Mission

Enhance and expand ESLint enforcement to prevent regression during authentication migration. Add rules to catch deep relative imports, missing cache() wrappers, duplicate auth patterns, and deprecated authentication imports. Create CI safety net before high-volume codemods begin.

## Context & Current State

PinPoint has a sophisticated ESLint configuration with existing custom rules and enforcement patterns:

### Current Enforcement Infrastructure
- **Base Config**: `eslint.config.js` - TypeScript ESLint with strict rules
- **Custom Rules**: `eslint-rules/no-legacy-auth-imports.js` - Legacy auth prevention
- **Tooling Config**: `tooling.config.js` - Centralized rule management
- **Pattern Coverage**: 560+ lines of rule configuration

### Existing Authentication Enforcement
```javascript
// Current legacy auth prevention (eslint-rules/no-legacy-auth-imports.js)
const LEGACY_FUNCTIONS = [
  'requireMemberAccess',
  'requireOrganizationContext', 
  'getOrganizationContext',
  'ensureOrgContextAndBindRLS'
];
```

### Current Deep Import Prevention
```javascript  
// Current relative import restrictions (eslint.config.js:127-144)
"no-restricted-imports": [
  "error", 
  {
    patterns: [
      {
        group: ["../../*", "../../../*", "../../../../*"],
        message: "Use the '~/' path alias instead of deep relative imports"
      }
    ]
  }
]
```

### Missing Enforcement (Your Target Areas)

1. **Missing Cache Wrapper Detection** - No rules for uncached async functions
2. **Duplicate Auth Pattern Detection** - No rules preventing multiple auth calls
3. **Direct Supabase Client Usage** - Limited to specific paths only  
4. **Incomplete Return Type Enforcement** - Only warnings for complex functions

## Deliverables

### 1. Enhanced ESLint Rules

#### A. New Custom Rule: `no-missing-cache-wrapper`
**File**: `eslint-rules/no-missing-cache-wrapper.js`

Detects async server functions that should be wrapped in `cache()`:

```javascript
// Target Pattern Detection:
export async function getUserById(id: string) {  // ❌ Should be cached
  return await db.query.users.findFirst({
    where: eq(users.id, id)
  });
}

// Correct Pattern:
export const getUserById = cache(async (id: string) => { // ✅ Properly cached
  return await db.query.users.findFirst({
    where: eq(users.id, id)
  });
});
```

#### B. New Custom Rule: `no-duplicate-auth-resolution`  
**File**: `eslint-rules/no-duplicate-auth-resolution.js`

Prevents multiple authentication resolution calls within single function:

```javascript
// Problematic Pattern Detection:
export async function someAction() {
  const ctx1 = await requireMemberAccess(); // ❌ First auth call
  // ... some logic
  const ctx2 = await getOrganizationContext(); // ❌ Second auth call - redundant
}
```

#### C. Enhanced Rule: Expand `no-legacy-auth-imports`
**File**: `eslint-rules/no-legacy-auth-imports.js` (modify existing)

Add more functions to the forbidden list based on Lane A inventory:

```javascript
const LEGACY_FUNCTIONS = [
  'requireMemberAccess',
  'requireOrganizationContext', 
  'getOrganizationContext',
  'ensureOrgContextAndBindRLS',
  // ADD FROM LANE A INVENTORY:
  'getActionAuthContext',
  'getServerAuthContext', 
  'requireActionAuthContextWithPermission',
  'getUserWithOrganization'
];
```

#### D. New Custom Rule: `no-direct-supabase-client`
**File**: `eslint-rules/no-direct-supabase-client.js`

Prevents direct `createClient` usage outside approved server wrapper:

```javascript
// Forbidden Pattern:
import { createClient } from '@supabase/supabase-js'; // ❌

// Required Pattern:
import { createClient } from '~/lib/supabase/server'; // ✅
```

### 2. Enhanced Core ESLint Configuration

#### A. Mandatory Cache() Rules
**Location**: `eslint.config.js` - Add to main rules section

```javascript
rules: {
  // ... existing rules
  
  // Enforce cache() wrapper for async server functions
  "no-restricted-syntax": [
    "error",
    // ... existing restricted syntax rules
    {
      selector: "ExportNamedDeclaration[declaration.type='FunctionDeclaration'][declaration.async=true]:not([declaration.id.name=/cache$/])",
      message: "Async server functions should be wrapped in cache() per CORE-PERF-001"
    },
    {
      selector: "VariableDeclarator[id.name!=/cache$/] > ArrowFunctionExpression[async=true]",
      message: "Async server functions should be wrapped in cache() per CORE-PERF-001"  
    }
  ],
  
  // Custom rules integration
  "missingCache/no-missing-cache-wrapper": "warn", // Start as warning
  "duplicateAuth/no-duplicate-auth-resolution": "error",
  "directSupabase/no-direct-supabase-client": "error"
}
```

#### B. Enhanced Return Type Enforcement
**Location**: `eslint.config.js` - Modify existing rule

```javascript
"@typescript-eslint/explicit-function-return-type": [
  "error", // Upgrade from "warn" to "error"
  {
    allowExpressions: true,
    allowTypedFunctionExpressions: true,
    allowHigherOrderFunctions: true,
    allowDirectConstAssertionInArrowFunctions: true,
    // New: Require return types for all async functions
    allowConciseArrowFunctionExpressionsStartingWithVoid: false
  }
]
```

#### C. Stricter Deep Import Prevention
**Location**: `eslint.config.js` - Enhance existing rule

```javascript
"no-restricted-imports": [
  "error",
  {
    paths: [
      // ... existing path restrictions
      
      // New: Prevent DAL cross-imports
      {
        name: "~/lib/dal/*",
        message: "DAL modules should not import each other. Use ~/lib/dal/shared for common utilities."
      }
    ],
    patterns: [
      // Existing patterns PLUS:
      {
        group: ["../lib/dal/*", "../../lib/dal/*"],
        message: "Use '~/lib/dal/*' alias instead of relative DAL imports"
      },
      {
        group: ["**/organization-context", "../organization-context"],  
        message: "Import getRequestAuthContext from '~/server/auth/context' instead"
      }
    ]
  }
]
```

### 3. CI Integration Enhancements

#### A. Enhanced Pre-commit Hooks
**Location**: `package.json` scripts section

```json
{
  "scripts": {
    "pre-commit:auth-safety": "node scripts/check-auth-safety.js",
    "pre-commit:cache-check": "eslint --no-eslintrc --config eslint.cache-check.js src/",
    "pre-commit:all": "npm-run-all --parallel pre-commit:lint-staged pre-commit:auth-safety pre-commit:cache-check"
  }
}
```

#### B. New Safety Check Script
**File**: `scripts/check-auth-safety.js`

```javascript
#!/usr/bin/env node
/**
 * Pre-commit safety check for authentication patterns
 * Prevents commits with dangerous auth patterns
 */

const { execSync } = require('child_process');

const DANGEROUS_PATTERNS = [
  'requireMemberAccess.*requireMemberAccess', // Duplicate auth calls
  'createClient.*@supabase/supabase-js',       // Direct Supabase usage  
  'export async function.*(?!cache)',          // Uncached async exports
];

function checkAuthSafety() {
  console.log('🔐 Checking authentication safety patterns...');
  
  DANGEROUS_PATTERNS.forEach(pattern => {
    try {
      const result = execSync(`rg "${pattern}" src/ --type ts`, { encoding: 'utf8' });
      if (result.trim()) {
        console.error(`❌ Dangerous pattern detected: ${pattern}`);
        console.error(result);
        process.exit(1);
      }
    } catch (error) {
      // Pattern not found - good!
    }
  });
  
  console.log('✅ Authentication patterns are safe');
}

checkAuthSafety();
```

### 4. Validation & Testing Framework

#### A. ESLint Rule Testing
**File**: `eslint-rules/__tests__/rule-tests.js`

```javascript
const { RuleTester } = require('eslint');
const noCacheWrapper = require('../no-missing-cache-wrapper');
const noDuplicateAuth = require('../no-duplicate-auth-resolution');

const ruleTester = new RuleTester({
  parserOptions: { ecmaVersion: 2020, sourceType: 'module' }
});

// Test cache wrapper detection
ruleTester.run('no-missing-cache-wrapper', noCacheWrapper, {
  valid: [
    'export const getUserById = cache(async (id) => { return user; });'
  ],
  invalid: [
    {
      code: 'export async function getUserById(id) { return user; }',
      errors: [{ message: 'Async server function should use cache() wrapper' }]
    }
  ]
});
```

#### B. Integration Testing Script
**File**: `scripts/test-eslint-enforcement.js`

Creates temporary files with problematic patterns and verifies ESLint catches them:

```javascript
const fs = require('fs');
const { execSync } = require('child_process');

const TEST_CASES = [
  {
    name: 'duplicate-auth',
    code: `
      export async function badAction() {
        const ctx1 = await requireMemberAccess();
        const ctx2 = await getOrganizationContext();
        return 'bad';
      }
    `,
    expectedError: 'no-duplicate-auth-resolution'
  },
  // ... more test cases
];

function testESLintEnforcement() {
  TEST_CASES.forEach(testCase => {
    const tempFile = `.temp-${testCase.name}.ts`;
    fs.writeFileSync(tempFile, testCase.code);
    
    try {
      execSync(`npx eslint ${tempFile}`, { stdio: 'pipe' });
      console.error(`❌ Test ${testCase.name} failed - ESLint should have caught this`);
      process.exit(1);
    } catch (error) {
      if (error.stdout.includes(testCase.expectedError)) {
        console.log(`✅ Test ${testCase.name} passed`);
      } else {
        console.error(`❌ Test ${testCase.name} failed - wrong error type`);
        process.exit(1);
      }
    } finally {
      fs.unlinkSync(tempFile);
    }
  });
}
```

## Technical Implementation Plan

### Phase 1: Custom Rule Development

**Priority Order:**
1. **`no-duplicate-auth-resolution`** - Most critical for Wave 1 safety
2. **`no-missing-cache-wrapper`** - Important for performance  
3. **Enhanced `no-legacy-auth-imports`** - Expand forbidden functions
4. **`no-direct-supabase-client`** - Prevent SSR issues

**Development Pattern for Each Rule:**
```javascript
// Rule structure template
export default {
  meta: {
    type: 'problem', // or 'suggestion'  
    docs: {
      description: 'Rule description',
      category: 'Possible Errors',
    },
    fixable: null, // 'code' if auto-fixable
    schema: [], // Options schema
    messages: {
      ruleViolation: 'Error message template'
    }
  },
  
  create(context) {
    return {
      // AST node visitors
      FunctionDeclaration(node) {
        // Rule logic
      }
    };
  }
};
```

### Phase 2: ESLint Configuration Enhancement

**Integration Steps:**
1. Add custom rules to plugins section in `eslint.config.js`
2. Configure rule severity levels (start with warnings)  
3. Add file-specific overrides for necessary exceptions
4. Test against existing codebase to measure false positive rate

**Configuration Template:**
```javascript
{
  plugins: {
    // ... existing plugins
    "missingCache": {
      rules: {
        "no-missing-cache-wrapper": require('./eslint-rules/no-missing-cache-wrapper')
      }
    },
    "duplicateAuth": {
      rules: {
        "no-duplicate-auth-resolution": require('./eslint-rules/no-duplicate-auth-resolution')  
      }
    }
  },
  rules: {
    // ... existing rules
    "missingCache/no-missing-cache-wrapper": "warn", // Start lenient
    "duplicateAuth/no-duplicate-auth-resolution": "error" // Critical safety
  }
}
```

### Phase 3: CI Integration & Testing

**Pipeline Integration:**
1. Add ESLint enforcement to pre-commit hooks
2. Create safety check scripts for dangerous patterns  
3. Add integration testing for rule effectiveness
4. Configure CI to fail on new rule violations

## Key Implementation Details

### AST Pattern Recognition

For detecting uncached async functions:
```javascript
// Target: export async function name() {}
selector: "ExportNamedDeclaration[declaration.type='FunctionDeclaration'][declaration.async=true]"

// Target: export const name = async () => {}  
selector: "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator[init.type='ArrowFunctionExpression'][init.async=true]"
```

For detecting duplicate auth calls:
```javascript
// Look for multiple calls to auth functions within same scope
function checkDuplicateAuthCalls(node) {
  const authCalls = [];
  // Traverse function body
  // Count calls to LEGACY_FUNCTIONS
  // Report if > 1
}
```

### False Positive Management

**Expected False Positives:**
- Test files may need duplicate auth calls for testing
- Some utility functions may need direct Supabase access
- Legacy migration files should be excluded

**Mitigation Strategy:**
```javascript
// File-specific exemptions
files: ["src/lib/auth/legacy-adapters.ts", "**/*.test.ts"],
rules: {
  "duplicateAuth/no-duplicate-auth-resolution": "off"
}
```

### Performance Considerations

**Rule Performance:**
- Use efficient AST selectors
- Avoid traversing entire subtrees when possible
- Cache file-level analysis results
- Skip analysis for excluded file patterns

## Integration with Other Lanes

### Coordinate with Lane A (Inventory)
- Use Lane A's function inventory to populate LEGACY_FUNCTIONS array
- Cross-reference high-usage functions for priority enforcement
- Validate rule effectiveness against Lane A's call site data

### Support Lane C (Codemods)  
- Ensure ESLint rules won't conflict with codemod transformations
- Provide rule exemptions for codemod target files during migration
- Create temporary rule relaxation for migration phases

### Enable Lane D (Metrics)
- ESLint violations should be measurable via CI metrics
- Track rule violation trends over time
- Correlate rule violations with authentication resolution metrics

## Success Criteria

✅ **4+ New Custom Rules**: Implemented and tested  
✅ **Zero False Positives**: On current codebase (with appropriate exemptions)  
✅ **CI Integration**: Pre-commit hooks catch violations  
✅ **Baseline Compatibility**: No new violations on existing code  
✅ **Rule Testing**: Automated tests verify rule behavior  
✅ **Documentation**: Clear rule descriptions and examples  

## Risk Mitigation

### Major Risks
- **False Positive Storm**: New rules flag legitimate patterns
- **Performance Impact**: Complex AST analysis slows linting  
- **Migration Conflicts**: Rules block necessary codemod patterns

### Mitigation Strategies  
- **Gradual Rollout**: Start with warnings, escalate to errors
- **Exemption Strategy**: Clear file/pattern exceptions
- **Performance Testing**: Measure lint time impact
- **Rollback Plan**: Easy rule disabling via config

## Testing Strategy

### Unit Testing (Per Rule)
```bash
cd eslint-rules
npm test -- --testNamePattern="no-missing-cache-wrapper"
```

### Integration Testing (Full Codebase)  
```bash
# Should pass with exemptions
npm run lint

# Should fail with deliberate violations
npm run test:eslint-enforcement
```

### Performance Testing
```bash
# Measure before/after lint times  
time npm run lint > lint-timing.log
```

## Dependencies & Prerequisites

### Files to Understand First
- `eslint.config.js` - Current rule structure
- `tooling.config.js` - Centralized configuration patterns
- `eslint-rules/no-legacy-auth-imports.js` - Existing custom rule example
- Output from Lane A - Function inventories for rule targeting

### Environment Setup
```bash
# Install ESLint rule testing utilities
npm install --save-dev @typescript-eslint/rule-tester

# Verify current ESLint works
npm run lint

# Check current rule coverage
npm run lint -- --print-config src/lib/actions/shared.ts
```

Your enhanced enforcement will provide the safety net needed for subsequent high-volume migrations in Wave 1 and beyond.
