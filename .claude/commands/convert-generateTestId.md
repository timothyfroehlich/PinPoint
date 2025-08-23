# Convert generateTestId to SEED_TEST_IDS

**Purpose:** Systematically convert `generateTestId()` calls to `SEED_TEST_IDS` constants and log complex cases requiring additional seed data.

**Usage:** `/convert-generateTestId <file-path>`

**Example:** `/convert-generateTestId src/integration-tests/model.core.integration.test.ts`

---

## Agent Task Instructions

You are a specialized conversion agent. Your job is to convert `generateTestId()` calls to proper `SEED_TEST_IDS` patterns while logging cases that need architectural decisions.

### ⚠️ CRITICAL CONTEXT: generateTestId() IS COMPLETELY DELETED

**THE FUNCTION NO LONGER EXISTS** - `src/test/helpers/test-id-generator.ts` now throws errors instead of generating IDs. Any remaining `generateTestId()` calls will cause **TypeScript compilation errors** and **test failures**. This is intentional "scorched earth" enforcement.

**Your job:** Convert every single `generateTestId()` call or the file won't compile.

### CRITICAL FILES TO READ FIRST:

1. **Target file** (provided by user)
2. **`/var/home/froeht/Code/PinPoint/src/test/constants/seed-test-ids.ts`** - Available constants
3. **`/var/home/froeht/Code/PinPoint/NON_NEGOTIABLES.md`** - Conversion requirements

### CONVERSION PATTERNS:

#### CONVERSION RULE: Use Real SEED_TEST_IDS Constants Only

**Convert ONLY what maps to actual minimal seed constants:**

```typescript
// ✅ CONVERT: Direct mappings to real seed data
generateTestId("user") → SEED_TEST_IDS.USERS.ADMIN
generateTestId("org") → SEED_TEST_IDS.ORGANIZATIONS.primary
generateTestId("machine") → SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1
generateTestId("issue") → SEED_TEST_IDS.ISSUES.KAIJU_FIGURES
generateTestId("location") → SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR
generateTestId("status") → SEED_TEST_IDS.STATUSES.NEW_PRIMARY
generateTestId("priority") → SEED_TEST_IDS.PRIORITIES.HIGH_PRIMARY
generateTestId("role") → SEED_TEST_IDS.ROLES.ADMIN_PRIMARY

// ✅ CONVERT: Mock patterns for unit tests
generateTestId("model") → SEED_TEST_IDS.MOCK_PATTERNS.MODEL
generateTestId("collection") → SEED_TEST_IDS.MOCK_PATTERNS.COLLECTION
generateTestId("comment") → SEED_TEST_IDS.MOCK_PATTERNS.COMMENT
generateTestId("notification") → SEED_TEST_IDS.MOCK_PATTERNS.NOTIFICATION
generateTestId("type") → SEED_TEST_IDS.MOCK_PATTERNS.TYPE
generateTestId("entity") → SEED_TEST_IDS.MOCK_PATTERNS.ENTITY
```

#### LOG (Don't Convert): Cases Needing More Than Minimal Seed

```typescript
// ❌ LOG ONLY - needs multiple distinct entities
generateTestId("model-1"); // Test needs multiple models
generateTestId("model-2"); // But minimal seed only has MOCK_PATTERNS.MODEL
generateTestId("qr-1"); // Test needs multiple QR codes
generateTestId("auto-1"); // Test needs multiple collections

// ❌ LOG ONLY - template literals
generateTestId(`machine-${i + 1}`) // Dynamic generation
// ❌ LOG ONLY - email construction
`user-${generateTestId("user")}@test.com`;
```

**🚨 NEVER create arbitrary strings like "mock-williams-model" - use real constants or log it!**

#### Phase 3: Import Cleanup

```typescript
// ❌ Remove old import
import { generateTestId } from "~/test/helpers/test-id-generator";

// ✅ Add new import (if not already present)
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
```

### COMPLEX CASES TO LOG (DO NOT CONVERT):

Log these patterns to `.claude/logs/generateTestId-conversion-notes.md`:

1. **Template literals with variables:**

   ```typescript
   generateTestId(`machine-${i + 1}`);
   generateTestId(`complex-qr-${i + 1}`);
   ```

2. **Email construction:**

   ```typescript
   `fk-user-${generateTestId("fk-user")}@test.example``target-${generateTestId("email")}@example.com`;
   ```

3. **Multiple entities needed:**
   - Tests using model-1, model-2, model-3... (more than available in SEED_TEST_IDS)
   - Cross-org isolation tests needing competitor-specific data

### LOG FORMAT:

Append to `.claude/logs/generateTestId-conversion-notes.md`:

```markdown
## FILE: [filename]

### TEST: "[test name or describe block]"

**NEEDS:** [Description of what the test requires]
**CURRENT PATTERN:** [The generateTestId pattern found]
**AVAILABLE:** [What exists in SEED_TEST_IDS]
**SOLUTION:** [Recommended approach]

---
```

### EXECUTION STEPS:

1. **Read all required files** (target, SEED_TEST_IDS, NON_NEGOTIABLES)
2. **Analyze generateTestId usage patterns** in the target file
3. **Apply Phase 1 & 2 conversions** using the patterns above
4. **Update imports** (remove generateTestId, add SEED_TEST_IDS if needed)
5. **Log complex cases** that need architectural decisions
6. **Create conversion summary** showing what was converted vs logged
7. **Save updated file**
8. **NO linting, testing, or validation** - just conversion

### IMPORTANT CONSTRAINTS:

- **NO test runs or linting** during conversion
- **NEVER** guess at SEED_TEST_IDS values - read the actual file
- **ALWAYS** log rather than guess for complex patterns
- **PRESERVE** test logic - only change ID generation patterns
- **CREATE** logs directory if it doesn't exist
- **APPEND** to existing log file, don't overwrite

### SUCCESS CRITERIA:

- All simple `generateTestId()` calls converted to appropriate constants
- Complex cases logged with clear architectural recommendations
- Import statements properly updated
- No TypeScript compilation errors from converted patterns
- Detailed log entry created for follow-up architectural decisions
