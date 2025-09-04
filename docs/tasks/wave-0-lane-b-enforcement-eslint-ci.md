# Wave 0 Lane B: Enforcement (ESLint/CI)

**Agent Role**: ESLint & CI Enforcement Specialist  
**Target Duration**: 2-3 hours  
**Priority**: High (Safety guardrails for all future work)

## 🎯 Mission Statement

**IMPORTANT**: Significant ESLint work has already been implemented! Your primary role is to **validate, test, and enhance** the existing custom ESLint rules rather than building from scratch. Focus on ensuring zero false positives and complete coverage.

Validate and enhance the existing ESLint enforcement system to prevent regression during authentication modernization. Your guardrails will protect the codebase during Wave 1+ mass migrations.

## 📖 Project Context

**PinPoint** is undergoing authentication system modernization after Phase 1 consolidated to a single canonical resolver. The current challenge is preventing regression while implementing request context (Wave 1) and permissions (Wave 2+).

**Current ESLint State**: Advanced custom rules are already implemented in `eslint.config.js`:
- ✅ `legacyAuth/no-legacy-auth-imports`
- ✅ `duplicateAuth/no-duplicate-auth-resolution` 
- ✅ `missingCache/no-missing-cache-wrapper`
- ✅ `directSupabase/no-direct-supabase-client`
- ✅ Cache enforcement via `no-restricted-syntax`
- ✅ Deep relative import restrictions
- ✅ DAL cross-import prevention

## 🚀 Your Specific Tasks

### Task 1: Validate Existing Rules (1 hour)

**Test each custom rule** to ensure it works correctly:

```bash
# Test legacy auth import detection
npm run lint -- --rule 'legacyAuth/no-legacy-auth-imports: error'

# Test duplicate auth resolution detection  
npm run lint -- --rule 'duplicateAuth/no-duplicate-auth-resolution: error'

# Test cache wrapper enforcement
npm run lint -- --rule 'missingCache/no-missing-cache-wrapper: warn'

# Test direct Supabase client prevention
npm run lint -- --rule 'directSupabase/no-direct-supabase-client: error'
```

Create `scripts/wave-0/test-eslint-rules.js` to systematically test each rule:

```javascript
import { execSync } from 'child_process';
import fs from 'fs';

// Create test files that SHOULD trigger each rule
const testCases = [
  {
    rule: 'legacyAuth/no-legacy-auth-imports',
    badCode: `import { requireOrganizationContext } from '@supabase/auth-helpers-nextjs';`,
    shouldFail: true
  },
  {
    rule: 'duplicateAuth/no-duplicate-auth-resolution', 
    badCode: `
      const auth1 = await getRequestAuthContext();
      const auth2 = await getRequestAuthContext();
    `,
    shouldFail: true
  }
  // Add test cases for all 4 custom rules
];

export function validateRules() {
  // Test each rule systematically
}
```

### Task 2: Enhance Rule Configuration (30 min)

Review and optimize the existing rule configurations:

1. **Severity Levels**: Some rules start as "warn" - identify which should escalate to "error"
2. **Scope Targeting**: Ensure rules only apply to relevant file patterns
3. **Message Clarity**: Verify error messages provide actionable guidance

Focus on these areas in `eslint.config.js`:

```javascript
// Current cache enforcement - verify it catches all patterns
"no-restricted-syntax": [
  "error",
  {
    selector: "ExportNamedDeclaration[declaration.type='FunctionDeclaration'][declaration.async=true]:not([declaration.id.name=/cache$/])",
    message: "Async server functions should be wrapped in cache() per CORE-PERF-001"
  }
]

// Deep import restrictions - ensure coverage is complete  
"import/no-restricted-paths": [
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

### Task 3: CI Integration & Enforcement (45 min)

Ensure ESLint runs in CI and blocks problematic PRs:

1. **Verify CI Pipeline**: Check `.github/workflows/` includes ESLint
2. **Pre-commit Integration**: Confirm husky runs ESLint on staged files
3. **Rule Exemption Process**: Document how to handle legitimate exceptions

Create `scripts/wave-0/ci-lint-test.sh`:
```bash
#!/bin/bash
# Test CI ESLint integration

echo "Testing ESLint in CI mode..."
npm run lint 2>&1 | tee lint-output.log

# Check for expected rule violations
if grep -q "legacyAuth/no-legacy-auth-imports" lint-output.log; then
  echo "✅ Legacy auth rule is active"
else  
  echo "❌ Legacy auth rule not detecting violations"
fi

# Test other rules similarly
```

### Task 4: Documentation & Rule Reference (30 min)

Create comprehensive documentation for the enforcement system:

**File**: `docs/baseline/eslint-rules-reference.md`
```markdown
# ESLint Rules Reference - Wave 0 Enforcement

## Custom Authentication Rules

### legacyAuth/no-legacy-auth-imports
- **Purpose**: Prevent importing deprecated auth helpers
- **Severity**: Error
- **Triggers**: Imports from `@supabase/auth-helpers-nextjs`
- **Fix**: Use `~/server/auth/context` canonical resolver

### duplicateAuth/no-duplicate-auth-resolution
- **Purpose**: Prevent multiple auth calls in same scope  
- **Severity**: Error
- **Triggers**: Multiple calls to `getRequestAuthContext()`
- **Fix**: Store result in variable, reuse within scope
```

### Task 5: False Positive Analysis (15 min)

Run full lint against codebase and analyze any false positives:

```bash
npm run lint > full-lint-results.txt 2>&1

# Manually review each violation to ensure they're legitimate
# Document any false positives and adjust rules accordingly
```

## 🔧 Validation Testing

Create `scripts/wave-0/eslint-validation-suite.js`:

```javascript
// Test suite that creates intentionally bad code
// to verify each rule catches what it should

const testViolations = [
  {
    description: "Legacy auth import should be caught",
    code: `import { requireOrganizationContext } from '@supabase/auth-helpers-nextjs';`,
    expectedRule: "legacyAuth/no-legacy-auth-imports"
  },
  {
    description: "Duplicate auth resolution should be caught", 
    code: `
      async function test() {
        const auth1 = await getRequestAuthContext();
        const auth2 = await getRequestAuthContext(); // Should trigger error
      }
    `,
    expectedRule: "duplicateAuth/no-duplicate-auth-resolution"
  },
  {
    description: "Uncached async server function should be warned",
    code: `export async function getData() { return db.query.users.findMany(); }`,
    expectedRule: "missingCache/no-missing-cache-wrapper"
  },
  {
    description: "Direct Supabase client creation should be blocked",
    code: `import { createClient } from '@supabase/supabase-js'; const client = createClient();`,
    expectedRule: "directSupabase/no-direct-supabase-client" 
  }
];
```

## 📊 Success Metrics

Track these metrics for validation:

```json
{
  "eslintValidation": {
    "customRulesActive": 4,
    "falsePositives": 0,
    "missedViolations": 0,
    "ciIntegrationWorking": true,
    "preCommitBlocking": true
  }
}
```

## 🤝 Coordination with Other Lanes

**← Lane A (Inventories)**: Use their function lists to verify your rules catch all relevant patterns  
**→ Lane C (Codemods)**: Your rules will guide which transformations are safe  
**→ Lane D (Metrics)**: ESLint violations provide performance optimization targets

## ⚠️ Key Risks & Mitigations

**False Positives Blocking Development**: Start new rules as warnings, escalate to errors after validation  
**Rule Performance**: Custom AST rules can slow linting - benchmark with `time npm run lint`  
**Pattern Evolution**: As code changes in future waves, rules may need adjustment

## ✅ Success Criteria

- [ ] All 4 custom rules validated with test cases
- [ ] Zero false positives on current codebase
- [ ] CI integration confirmed working  
- [ ] Pre-commit hooks prevent rule violations
- [ ] Rule reference documentation created
- [ ] Lane A's inventory data validates rule coverage

## 📚 Key Files to Review

**Current Implementation**:
- `eslint.config.js` - All custom rules are here
- `eslint-rules/` - Individual rule implementations  
- `package.json` - Lint scripts and pre-commit setup
- `.github/workflows/` - CI ESLint integration

**Custom Rule Files** (already implemented):
- `eslint-rules/no-legacy-auth-imports.js`
- `eslint-rules/no-duplicate-auth-resolution.js` 
- `eslint-rules/no-missing-cache-wrapper.js`
- `eslint-rules/no-direct-supabase-client.js`

## 🚀 Start Here

1. **Audit Current State**: Run `npm run lint` and review what's already working
2. **Test Custom Rules**: Create systematic test cases for each rule
3. **Validate Configuration**: Ensure rules target the right files with appropriate severity
4. **Document System**: Create comprehensive rule reference
5. **Integration Testing**: Verify CI and pre-commit enforcement

**Remember**: You're validating and enhancing an already sophisticated system. Focus on ensuring it's bulletproof for the mass migrations coming in future waves!