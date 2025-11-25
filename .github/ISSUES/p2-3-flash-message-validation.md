# [P2] Add Runtime Validation for Flash Messages

**Priority:** P2 - Medium (Low Risk)
**Effort:** 30 minutes
**Parent Issue:** Security Review Main Issue

## Problem

Flash messages are deserialized from cookies using `JSON.parse()` with type assertion but **no runtime validation**.

**Current Code:**
```typescript
// src/lib/flash.ts:80
export async function readFlash(): Promise<Flash | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(FLASH_COOKIE_KEY)?.value;

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(decodeURIComponent(raw)) as Flash;  // ← No validation
  } catch {
    return null;
  }
}
```

**Risk:** LOW
- Cookie is httpOnly (not accessible to JavaScript) ✅
- Cookie is server-set only (via `setFlash`) ✅
- Try-catch prevents crash on invalid JSON ✅
- Flash messages only displayed to user who triggered them ✅

**Potential Attack:**
If an attacker could modify cookies (e.g., through XSS or client-side manipulation), they could inject malicious data into the Flash object structure.

**Reference:** Section 2.1 (Low Issue #2) of [SECURITY_REVIEW_2025-11-25.md](https://github.com/timothyfroehlich/PinPoint/blob/claude/security-review-codebase-011jfKFnKjKcqTDdG5njh7kQ/SECURITY_REVIEW_2025-11-25.md)

## Recommended Solution

Add Zod schema validation for runtime type checking:

```typescript
import { z } from "zod";

// Add schema definition
const flashSchema = z.object({
  type: z.enum(['success', 'error']),
  message: z.string(),
  fields: z.record(z.string()).optional(),
});

export type Flash = z.infer<typeof flashSchema>;

export async function readFlash(): Promise<Flash | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(FLASH_COOKIE_KEY)?.value;

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    // Add runtime validation
    return flashSchema.parse(parsed);
  } catch {
    // Invalid JSON or failed validation - return null
    return null;
  }
}
```

**Benefits:**
- Runtime validation ensures Flash object structure is correct
- Prevents injection of unexpected fields
- Type-safe with Zod inference
- Fails gracefully (returns null on invalid data)
- Consistent with existing Zod usage throughout codebase

## Alternative: Manual Validation

If avoiding Zod dependency for this one function:

```typescript
function isValidFlash(data: unknown): data is Flash {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  // Validate type field
  if (obj.type !== 'success' && obj.type !== 'error') {
    return false;
  }

  // Validate message field
  if (typeof obj.message !== 'string') {
    return false;
  }

  // Validate optional fields field
  if (obj.fields !== undefined) {
    if (typeof obj.fields !== 'object' || obj.fields === null) {
      return false;
    }
    // Ensure all field values are strings
    for (const value of Object.values(obj.fields)) {
      if (typeof value !== 'string') {
        return false;
      }
    }
  }

  return true;
}

export async function readFlash(): Promise<Flash | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(FLASH_COOKIE_KEY)?.value;

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(raw));

    if (!isValidFlash(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}
```

**Pros:**
- No additional dependencies
- Explicit validation logic

**Cons:**
- More verbose
- Need to maintain manual type guard
- Less DRY (Zod schema can be reused)

## Acceptance Criteria

- [ ] Zod schema added for Flash type
- [ ] `readFlash()` validates deserialized data with schema
- [ ] Invalid flash data returns null (graceful degradation)
- [ ] Flash type inferred from Zod schema
- [ ] Existing flash functionality still works
- [ ] Tests added for validation edge cases

## Testing

```typescript
// Test: Valid flash message
test("readFlash - valid flash message", async () => {
  await setFlash({ type: "success", message: "Test message" });
  const flash = await readFlash();

  expect(flash).toEqual({ type: "success", message: "Test message" });
});

// Test: Invalid flash structure (missing type)
test("readFlash - invalid flash structure", async () => {
  // Manually set invalid cookie
  const cookies = await cookies();
  cookies.set(FLASH_COOKIE_KEY, JSON.stringify({ message: "Test" }));

  const flash = await readFlash();
  expect(flash).toBeNull(); // Should return null on invalid structure
});

// Test: Malicious flash data
test("readFlash - malicious flash data", async () => {
  const cookies = await cookies();
  cookies.set(
    FLASH_COOKIE_KEY,
    JSON.stringify({
      type: "success",
      message: "<script>alert('XSS')</script>",
      extraField: "malicious",
    })
  );

  const flash = await readFlash();

  // Should parse (message will be escaped by React anyway)
  expect(flash).not.toBeNull();
  // Extra field should be stripped by strict schema
});

// Test: Invalid JSON
test("readFlash - invalid JSON", async () => {
  const cookies = await cookies();
  cookies.set(FLASH_COOKIE_KEY, "not valid JSON{");

  const flash = await readFlash();
  expect(flash).toBeNull();
});
```

## Files to Modify

- `src/lib/flash.ts` (add Zod schema and validation)
- `src/test/unit/flash.test.ts` (add validation tests - new file if doesn't exist)

## Benefits

1. **Defense-in-Depth:** Additional layer of validation
2. **Consistency:** Aligns with existing Zod usage (CORE-SEC-002)
3. **Type Safety:** Runtime validation matches TypeScript types
4. **Graceful Degradation:** Invalid data doesn't crash the app
5. **Future-Proof:** Easier to extend Flash type safely

## Labels

`security`, `priority: medium`, `enhancement`, `good first issue`
