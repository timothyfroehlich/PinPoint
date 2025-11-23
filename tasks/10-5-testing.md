# Task 10.5: Testing Gap Remediation - Email & Auth Flows

**Status**: Ready for Parallel Execution
**Created**: 2025-11-22
**Priority**: HIGH (Stops whack-a-mole debugging cycle)
**Estimated Total Effort**: 14-17 hours (5-6 hours with 5 parallel agents)

---

## Context: The Whack-a-Mole Pattern

### Recent Bug History (Last 5 Commits)

1. **`eb912c6`**: Added ports 3200/3300 to `supabase/config.toml` redirect URLs
2. **`48a071a`**: Added same ports to `actions.ts` origin allowlist (different file!)
3. **`8656b06`**: Enabled Mailpit in CI (was being excluded from supabase start)
4. **`828ca86`**: Added explicit wait for login page (race condition)
5. **`4c848a0`**: Fixed regex bug + removed debug console.logs

### Root Cause Analysis

**Problem**: Configuration is scattered across files (`config.toml`, `actions.ts`) with **no validation**. E2E tests are the **only** line of defense, leading to:

- Slow feedback cycle (E2E tests take ~40s)
- Brittle tests (timing issues, environment-specific failures)
- Configuration drift (ports added to one file but not the other)
- Security risks (untested origin validation, URL resolution logic)

**Current Test Coverage** (INVERTED PYRAMID):

```
      /E2E\      ← Only layer catching issues (slow, expensive)
     /------\
    /  Intg  \   ← Bypasses application logic
   /----------\
  /   Unit     \ ← MISSING (0 tests for critical code)
 /--------------\
```

**Target Test Coverage** (BALANCED PYRAMID):

```
        /\
       /E2E\     ← User journeys only
      /------\
     / Intg  \   ← Auth flows + DB integration
    /----------\
   /    Unit    \ ← Logic validation + security
  /--------------\
```

---

## Goals

### Primary Objectives

1. ✅ **Stop whack-a-mole debugging**: Add unit tests for configuration validation
2. ✅ **Test security-critical code**: Origin validation, URL resolution, redirect logic
3. ✅ **Reduce E2E test overhead**: Move implementation details to unit/integration tests
4. ✅ **Catch proven production bugs**: Regex extraction, cookie detection, timing issues

### Success Criteria

- [ ] **All 5 recent commits would have been caught by lower-level tests**
- [ ] **E2E test focuses on user journey, not implementation**
- [ ] **Test pyramid ratio**: ~70% unit, ~25% integration, ~5% E2E
- [ ] **All tests pass**: `npm run preflight` succeeds
- [ ] **Security code coverage**: 100% for origin validation, URL resolution

---

## Work Streams (Parallel Execution)

**CRITICAL**: Streams 1-5 have **NO dependencies** and can run simultaneously on different agents.

### Parallel Execution Map

```
┌─────────────────────────────────────────────────────────────┐
│                     PHASE 1: PARALLEL                       │
├─────────────────────────────────────────────────────────────┤
│ Agent A → Stream 1: Validation Schemas      (~2 hours)     │
│ Agent B → Stream 2: Security Logic          (~5 hours)  ⚠️  │
│ Agent C → Stream 5: Config Validation       (~3 hours)  ⚠️  │
│ Agent D → Stream 3: Utilities               (~2 hours)     │
│ Agent E → Stream 4: Integration Tests       (~4 hours)     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  PHASE 2: SEQUENTIAL                        │
├─────────────────────────────────────────────────────────────┤
│ Agent X → Stream 6: E2E Refactoring         (~2 hours)     │
└─────────────────────────────────────────────────────────────┘

⚠️ = Highest priority (stops whack-a-mole)
```

---

## Stream 1: Unit Tests - Validation Schemas

**Priority**: Medium
**Estimated Effort**: 1-2 hours
**Agent Can Start**: Immediately
**Dependencies**: None

### Files to Create

- `src/app/(auth)/schemas.test.ts` (NEW)

### Files to Read

- `src/app/(auth)/schemas.ts` (schemas to test)
- `src/lib/flash.test.ts` (example unit test pattern)

### Scope

Add comprehensive unit tests for:

1. `forgotPasswordSchema` (5 tests)
2. `resetPasswordSchema` (5 tests)

### Detailed Test Specifications

#### 1.1 forgotPasswordSchema Tests

**File**: `src/app/(auth)/schemas.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { forgotPasswordSchema } from "./schemas";

describe("forgotPasswordSchema", () => {
  it("should accept valid standard email", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "user@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("should accept email with + sign (gmail aliases)", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "user+test@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("should accept email with subdomain", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "user@mail.example.com",
    });
    expect(result.success).toBe(true);
  });

  it("should reject email without @", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "userexample.com",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("email");
    }
  });

  it("should reject email without domain", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "user@",
    });
    expect(result.success).toBe(false);
  });
});
```

#### 1.2 resetPasswordSchema Tests

```typescript
describe("resetPasswordSchema", () => {
  it("should accept valid password and matching confirmation", () => {
    const result = resetPasswordSchema.safeParse({
      password: "SecurePass123!",
      confirmPassword: "SecurePass123!",
    });
    expect(result.success).toBe(true);
  });

  it("should accept password at minimum length (8 chars)", () => {
    const result = resetPasswordSchema.safeParse({
      password: "12345678",
      confirmPassword: "12345678",
    });
    expect(result.success).toBe(true);
  });

  it("should reject password below minimum length (7 chars)", () => {
    const result = resetPasswordSchema.safeParse({
      password: "1234567",
      confirmPassword: "1234567",
    });
    expect(result.success).toBe(false);
  });

  it("should reject password mismatch", () => {
    const result = resetPasswordSchema.safeParse({
      password: "SecurePass123!",
      confirmPassword: "DifferentPass123!",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("match");
    }
  });

  it("should accept password with unicode characters", () => {
    const result = resetPasswordSchema.safeParse({
      password: "Pāsswörd123!",
      confirmPassword: "Pāsswörd123!",
    });
    expect(result.success).toBe(true);
  });
});
```

### Success Criteria

- [ ] All 10 tests pass
- [ ] Test file follows existing patterns (see `src/lib/flash.test.ts`)
- [ ] Edge cases covered (min/max length, special characters)
- [ ] Error messages validated for user-facing schemas

---

## Stream 2: Unit Tests - Security Logic

**Priority**: 🔴 **HIGHEST** (Stops whack-a-mole)
**Estimated Effort**: 4-5 hours
**Agent Can Start**: Immediately
**Dependencies**: None

### Files to Create

- `src/app/(auth)/actions.test.ts` (NEW)
- `src/app/auth/callback/route.test.ts` (NEW)

### Files to Read

- `src/app/(auth)/actions.ts` (Server Actions to test)
- `src/app/auth/callback/route.ts` (callback route to test)
- `supabase/config.toml` (to understand expected ports)

### Scope

Add unit tests for **security-critical logic**:

1. Origin resolution (5 tests)
2. Origin allowlist validation (3 tests) ← **Whack-a-mole fix**
3. Callback URL construction (2 tests)
4. URL validation in auth callback (5 tests)

### Detailed Test Specifications

#### 2.1 Origin Resolution Tests

**File**: `src/app/(auth)/actions.test.ts`

**Challenge**: `forgotPasswordAction` is a Server Action that accesses `headers()`. We need to mock Next.js server context.

**Mocking Strategy**:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { forgotPasswordAction } from "./actions";

// Mock Next.js server modules
vi.mock("next/headers", () => ({
  headers: vi.fn(),
  cookies: vi.fn(),
}));

// Mock Supabase client
vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Mock flash messages
vi.mock("~/lib/flash", () => ({
  setFlash: vi.fn(),
}));
```

**Tests**:

```typescript
describe("forgotPasswordAction - Origin Resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should use origin header when present", async () => {
    const mockHeaders = new Map([["origin", "http://localhost:3000"]]);

    vi.mocked(headers).mockResolvedValue({
      get: (key: string) => mockHeaders.get(key) ?? null,
    } as any);

    const mockSupabase = {
      auth: {
        resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const formData = new FormData();
    formData.set("email", "test@example.com");

    await forgotPasswordAction(formData);

    expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "test@example.com",
      expect.objectContaining({
        redirectTo: expect.stringContaining("http://localhost:3000"),
      })
    );
  });

  it("should fall back to x-forwarded-proto + x-forwarded-host when origin missing", async () => {
    const mockHeaders = new Map([
      ["x-forwarded-proto", "https"],
      ["x-forwarded-host", "example.com"],
    ]);

    vi.mocked(headers).mockResolvedValue({
      get: (key: string) => mockHeaders.get(key) ?? null,
    } as any);

    const mockSupabase = {
      auth: {
        resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const formData = new FormData();
    formData.set("email", "test@example.com");

    await forgotPasswordAction(formData);

    expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "test@example.com",
      expect.objectContaining({
        redirectTo: expect.stringContaining("https://example.com"),
      })
    );
  });

  it("should fall back to NEXT_PUBLIC_SITE_URL when all headers missing", async () => {
    const mockHeaders = new Map();
    vi.mocked(headers).mockResolvedValue({
      get: () => null,
    } as any);

    // Set env var
    process.env.NEXT_PUBLIC_SITE_URL = "https://pinpoint.example.com";

    const mockSupabase = {
      auth: {
        resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const formData = new FormData();
    formData.set("email", "test@example.com");

    await forgotPasswordAction(formData);

    expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "test@example.com",
      expect.objectContaining({
        redirectTo: expect.stringContaining("https://pinpoint.example.com"),
      })
    );

    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it("should handle PORT environment variable for local dev", async () => {
    const mockHeaders = new Map([["host", "localhost"]]);
    vi.mocked(headers).mockResolvedValue({
      get: (key: string) => mockHeaders.get(key) ?? null,
    } as any);

    process.env.PORT = "3100";

    const mockSupabase = {
      auth: {
        resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const formData = new FormData();
    formData.set("email", "test@example.com");

    await forgotPasswordAction(formData);

    expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "test@example.com",
      expect.objectContaining({
        redirectTo: expect.stringContaining("http://localhost:3100"),
      })
    );

    delete process.env.PORT;
  });

  it("should throw error if origin cannot be resolved", async () => {
    vi.mocked(headers).mockResolvedValue({
      get: () => null,
    } as any);

    // No env vars set
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.PORT;

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const formData = new FormData();
    formData.set("email", "test@example.com");

    const result = await forgotPasswordAction(formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("SERVER");
    }
  });
});
```

#### 2.2 Origin Allowlist Validation Tests

**CRITICAL**: This is the **root cause of whack-a-mole commits**. Test that all expected ports are allowed.

```typescript
describe("forgotPasswordAction - Origin Allowlist Validation", () => {
  const setupMockForOrigin = (origin: string) => {
    const mockHeaders = new Map([["origin", origin]]);
    vi.mocked(headers).mockResolvedValue({
      get: (key: string) => mockHeaders.get(key) ?? null,
    } as any);

    const mockSupabase = {
      auth: {
        resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);
    return mockSupabase;
  };

  it("should accept localhost:3000 (main worktree)", async () => {
    const mockSupabase = setupMockForOrigin("http://localhost:3000");

    const formData = new FormData();
    formData.set("email", "test@example.com");

    const result = await forgotPasswordAction(formData);

    expect(result.ok).toBe(true);
    expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalled();
  });

  it("should accept localhost:3100 (secondary worktree)", async () => {
    const mockSupabase = setupMockForOrigin("http://localhost:3100");

    const formData = new FormData();
    formData.set("email", "test@example.com");

    const result = await forgotPasswordAction(formData);

    expect(result.ok).toBe(true);
    expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalled();
  });

  it("should accept localhost:3200 (review worktree)", async () => {
    const mockSupabase = setupMockForOrigin("http://localhost:3200");

    const formData = new FormData();
    formData.set("email", "test@example.com");

    const result = await forgotPasswordAction(formData);

    expect(result.ok).toBe(true);
    expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalled();
  });

  it("should accept localhost:3300 (antigravity worktree)", async () => {
    const mockSupabase = setupMockForOrigin("http://localhost:3300");

    const formData = new FormData();
    formData.set("email", "test@example.com");

    const result = await forgotPasswordAction(formData);

    expect(result.ok).toBe(true);
    expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalled();
  });

  it("should accept NEXT_PUBLIC_SITE_URL if set", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://pinpoint-staging.vercel.app";
    const mockSupabase = setupMockForOrigin(
      "https://pinpoint-staging.vercel.app"
    );

    const formData = new FormData();
    formData.set("email", "test@example.com");

    const result = await forgotPasswordAction(formData);

    expect(result.ok).toBe(true);
    expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalled();

    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it("should reject unknown origin (security)", async () => {
    setupMockForOrigin("http://evil.com");

    const formData = new FormData();
    formData.set("email", "test@example.com");

    const result = await forgotPasswordAction(formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("SERVER");
    }
  });
});
```

**⚠️ CRITICAL**: If any of the worktree port tests fail, it means we're missing a port in the allowlist. This would have caught commits `eb912c6` and `48a071a`.

#### 2.3 URL Validation Tests (Auth Callback)

**File**: `src/app/auth/callback/route.test.ts`

**Scope**: Test `isInternalUrl()` and `resolveRedirectPath()` helpers to prevent open redirect vulnerabilities.

```typescript
import { describe, it, expect } from "vitest";

// Copy helper functions from route.ts for unit testing
function isInternalUrl(url: string): boolean {
  return url.startsWith("/");
}

function resolveRedirectPath({
  nextParam,
  origin,
  forwardedHost,
}: {
  nextParam: string;
  origin: string;
  forwardedHost: string | null;
}): string {
  // Copy implementation from route.ts
  // This is a simplified version for example
  if (isInternalUrl(nextParam)) {
    return nextParam;
  }
  return "/";
}

describe("isInternalUrl", () => {
  it("should return true for root path", () => {
    expect(isInternalUrl("/")).toBe(true);
  });

  it("should return true for internal paths", () => {
    expect(isInternalUrl("/dashboard")).toBe(true);
    expect(isInternalUrl("/reset-password")).toBe(true);
  });

  it("should return false for external URLs", () => {
    expect(isInternalUrl("http://example.com")).toBe(false);
    expect(isInternalUrl("https://evil.com/phishing")).toBe(false);
  });

  it("should return false for protocol-relative URLs", () => {
    expect(isInternalUrl("//evil.com/phishing")).toBe(false);
  });
});

describe("resolveRedirectPath", () => {
  it("should accept valid internal path", () => {
    const result = resolveRedirectPath({
      nextParam: "/dashboard",
      origin: "http://localhost:3000",
      forwardedHost: null,
    });
    expect(result).toBe("/dashboard");
  });

  it("should reject external URL (open redirect prevention)", () => {
    const result = resolveRedirectPath({
      nextParam: "https://evil.com/steal-session",
      origin: "http://localhost:3000",
      forwardedHost: null,
    });
    expect(result).toBe("/");
  });

  it("should reject protocol-relative URL", () => {
    const result = resolveRedirectPath({
      nextParam: "//evil.com/phishing",
      origin: "http://localhost:3000",
      forwardedHost: null,
    });
    expect(result).toBe("/");
  });

  it("should sanitize path traversal attempts", () => {
    const result = resolveRedirectPath({
      nextParam: "/../../../etc/passwd",
      origin: "http://localhost:3000",
      forwardedHost: null,
    });
    // Should either reject or sanitize
    expect(result).not.toContain("..");
  });
});
```

### Success Criteria

- [ ] All 15 tests pass
- [ ] All 4 worktree ports tested (3000, 3100, 3200, 3300)
- [ ] Origin resolution fallback chain fully covered
- [ ] Open redirect attacks prevented (external URL rejected)
- [ ] Mocking strategy documented in test file

---

## Stream 3: Unit Tests - Utilities

**Priority**: Medium
**Estimated Effort**: 1-2 hours
**Agent Can Start**: Immediately
**Dependencies**: None

### Files to Create

- `e2e/support/mailpit.test.ts` (NEW)

### Files to Read

- `e2e/support/mailpit.ts` (utilities to test)

### Scope

Add unit tests for **brittle utility code**:

1. Password reset link regex extraction (3 tests)
2. HTML entity decoding (2 tests)

### Detailed Test Specifications

#### 3.1 Mailpit Regex Tests

**File**: `e2e/support/mailpit.test.ts`

**Background**: Commit `4c848a0` fixed a regex bug in production. This proves the regex is brittle and needs unit tests.

```typescript
import { describe, it, expect } from "vitest";

// Extract the regex and decoding logic for unit testing
const PASSWORD_RESET_LINK_REGEX =
  /<a[^>]+href="([^"]+supabase[^"]+type=recovery[^"]+)"[^>]*>/i;

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x3D;/g, "=");
}

function extractPasswordResetLink(htmlBody: string): string | null {
  const match = PASSWORD_RESET_LINK_REGEX.exec(htmlBody);
  if (!match?.[1]) return null;
  return decodeHtmlEntities(match[1]);
}

describe("extractPasswordResetLink", () => {
  it("should extract valid Supabase password reset link from HTML", () => {
    const htmlBody = `
      <html>
        <body>
          <p>Reset your password:</p>
          <a href="http://localhost:54321/auth/v1/verify?token=abc123&amp;type=recovery&amp;redirect_to=http://localhost:3000/reset-password">
            Reset Password
          </a>
        </body>
      </html>
    `;

    const link = extractPasswordResetLink(htmlBody);

    expect(link).toBeTruthy();
    expect(link).toContain("type=recovery");
    expect(link).toContain("redirect_to=");
    expect(link).not.toContain("&amp;"); // Should be decoded
  });

  it("should return null when no reset link in HTML", () => {
    const htmlBody = `
      <html>
        <body>
          <p>This is a different email with no reset link.</p>
        </body>
      </html>
    `;

    const link = extractPasswordResetLink(htmlBody);

    expect(link).toBeNull();
  });

  it("should handle malformed HTML gracefully", () => {
    const htmlBody = `
      <html>
        <body>
          <a href="broken link
          <p>Unclosed tags
    `;

    const link = extractPasswordResetLink(htmlBody);

    expect(link).toBeNull();
  });
});

describe("decodeHtmlEntities", () => {
  it("should decode all common HTML entities", () => {
    const encoded =
      "token=abc&amp;type=recovery&lt;script&gt;&quot;alert&#x3D;1&quot;";
    const decoded = decodeHtmlEntities(encoded);

    expect(decoded).toBe('token=abc&type=recovery<script>"alert=1"');
    expect(decoded).toContain("&");
    expect(decoded).toContain("<");
    expect(decoded).toContain(">");
    expect(decoded).toContain('"');
    expect(decoded).toContain("=");
  });

  it("should leave unknown entities unchanged", () => {
    const text = "unknown&nbsp;entity";
    const decoded = decodeHtmlEntities(text);

    expect(decoded).toBe("unknown&nbsp;entity"); // &nbsp; not in our list
  });
});
```

### Success Criteria

- [x] All 5 tests pass
- [x] Regex extraction handles valid Supabase email HTML
- [x] Regex returns null for malformed input (no crash)
- [x] HTML entity decoding covers all 5 entities from implementation

### Completion Notes (2025-11-22)

**Status**: ✅ COMPLETED

**Files Created**:

- `e2e/support/mailpit.test.ts` (5 tests, all passing)

**Files Modified**:

- `vitest.config.ts` (added `e2e/**/*.test.ts` to unit test include pattern)

**Key Decisions**:

1. **Regex Discrepancy**: Task template provided different regex than actual implementation
   - Task template: `/<a[^>]+href="([^"]+supabase[^"]+type=recovery[^"]+)"[^>]*>/i`
   - Actual implementation: `/href="([^"]*\/auth\/v1\/verify[^"]*)"/i`
   - Decision: Test the **actual implementation** to prevent real-world regressions

2. **HTML Entity Differences**: Task spec mentioned `&#x3D;` (equals), actual code uses `&#39;` (apostrophe)
   - Extracted actual implementation from mailpit.ts (lines 128-133)
   - Tests now cover: `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`

3. **Test Location**: Created in `e2e/support/` as specified, updated vitest config to include this path

**Edge Cases Discovered**:

1. ✅ Malformed HTML with unclosed tags → gracefully returns null
2. ✅ Missing reset link → returns null without throwing
3. ✅ Unknown HTML entities (e.g., `&nbsp;`) → left unchanged (not in decode list)
4. ✅ Realistic Supabase email structure → correctly extracts and decodes link

**Problems Encountered**:

- Initial test run failed because vitest config only included `src/**/*.test.ts`
- Solution: Updated vitest config to include `e2e/**/*.test.ts` in unit test project
- This allows unit testing of E2E support utilities without running Playwright

**Test Results**:

```
✓ extractPasswordResetLink > should extract valid Supabase password reset link from HTML
✓ extractPasswordResetLink > should return null when no reset link in HTML
✓ extractPasswordResetLink > should handle malformed HTML gracefully
✓ decodeHtmlEntities > should decode all common HTML entities
✓ decodeHtmlEntities > should leave unknown entities unchanged

Test Files  1 passed (1)
     Tests  5 passed (5)
  Duration  1ms
```

**Recommendations**:

1. ⚠️ **Regex Complexity**: Current regex is simple but brittle. Consider:
   - Adding test for edge cases (multiple links, nested HTML)
   - Documenting exact HTML structure expected from Supabase emails

2. 📝 **HTML Entity Coverage**: Current implementation only handles 5 entities
   - If Supabase emails contain other entities (e.g., `&#x3D;`, `&nbsp;`), they won't be decoded
   - Consider using a library like `he` if more comprehensive decoding is needed

3. ✅ **Test Extraction Pattern**: Successfully isolated regex/decode logic for unit testing
   - This pattern should be used for other E2E utilities (actions.ts, cleanup.ts)
   - Avoids slow E2E tests for pure logic validation

**Next Steps**:

- Pattern established for unit testing E2E utilities
- Other streams can follow this approach for testing configuration validation, URL resolution, etc.

---

## Stream 4: Integration Tests - Auth Flows ✅ COMPLETED

**Priority**: Medium
**Estimated Effort**: 3-4 hours
**Actual Effort**: 2.5 hours
**Agent Can Start**: Immediately
**Dependencies**: None (requires Supabase running)
**Status**: All 15 tests passing (exceeded requirement of 8)

### Files to Create

- `src/test/integration/supabase/auth-pages.test.ts` (NEW)
- `src/test/integration/supabase/auth-actions-errors.test.ts` (NEW)
- `src/test/integration/mailpit.test.ts` (NEW)

### Files to Read

- `src/app/(auth)/forgot-password/page.tsx`
- `src/app/(auth)/reset-password/page.tsx`
- `src/app/(auth)/actions.ts`
- `src/test/integration/supabase/password-reset.test.ts` (example pattern)

### Scope

Add integration tests for:

1. Server Component auth redirect logic (2 tests)
2. Server Action error paths (4 tests)
3. Mailpit email delivery (2 tests)

### Detailed Test Specifications

#### 4.1 Server Component Auth Tests

**File**: `src/test/integration/supabase/auth-pages.test.ts`

**Note**: These test the **behavior** of Server Components, not the rendering. We test auth state → redirect logic.

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "~/lib/supabase/server";
import { redirect } from "next/navigation";

// Mock Next.js redirect
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

describe("ForgotPasswordPage - Auth Redirect Logic", () => {
  it("should redirect authenticated user to dashboard", async () => {
    // This is a conceptual test - actual implementation depends on how
    // we can invoke Server Component logic in test environment
    // May need to extract redirect logic to a helper function

    const supabase = await createClient();

    // Sign in a test user
    await supabase.auth.signInWithPassword({
      email: "test@example.com",
      password: "test-password",
    });

    // Call the logic that would run in ForgotPasswordPage
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // This is what the page does
      expect(redirect).toHaveBeenCalledWith("/dashboard");
    }

    // Cleanup
    await supabase.auth.signOut();
  });

  it("should show form for unauthenticated user", async () => {
    const supabase = await createClient();

    // Ensure no user signed in
    await supabase.auth.signOut();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    expect(user).toBeNull();
    expect(redirect).not.toHaveBeenCalled();
  });
});
```

**Note**: If Server Component testing is too complex, we can extract the auth check logic to a helper function and test that instead.

#### 4.2 Server Action Error Path Tests

**File**: `src/test/integration/supabase/auth-actions-errors.test.ts`

**Scope**: Test error paths that are currently not covered.

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { resetPasswordAction } from "~/app/(auth)/actions";
import { createClient } from "~/lib/supabase/server";

describe("resetPasswordAction - Error Paths", () => {
  it("should return SERVER error when user not authenticated", async () => {
    const supabase = await createClient();
    await supabase.auth.signOut();

    const formData = new FormData();
    formData.set("password", "NewPassword123!");
    formData.set("confirmPassword", "NewPassword123!");

    const result = await resetPasswordAction(formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("SERVER");
    }
  });

  it("should return VALIDATION error for password mismatch", async () => {
    const formData = new FormData();
    formData.set("password", "Password123!");
    formData.set("confirmPassword", "DifferentPassword123!");

    const result = await resetPasswordAction(formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("VALIDATION");
    }
  });
});
```

#### 4.3 Mailpit Integration Tests

**File**: `src/test/integration/mailpit.test.ts`

**Scope**: Verify Mailpit is running and can receive emails. **This would have caught commit `8656b06`**.

```typescript
import { describe, it, expect } from "vitest";

describe("Mailpit Integration", () => {
  it("should be accessible on configured port", async () => {
    const mailpitPort = process.env.MAILPIT_PORT || "54324";
    const mailpitUrl = `http://localhost:${mailpitPort}/api/v1/messages`;

    const response = await fetch(mailpitUrl);

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
  });

  it("should return valid JSON response", async () => {
    const mailpitPort = process.env.MAILPIT_PORT || "54324";
    const mailpitUrl = `http://localhost:${mailpitPort}/api/v1/messages`;

    const response = await fetch(mailpitUrl);
    const data = await response.json();

    expect(data).toHaveProperty("messages");
    expect(Array.isArray(data.messages)).toBe(true);
  });
});
```

### Success Criteria

- [x] All 8 tests pass (actually 15 tests created!)
- [x] Supabase must be running (`supabase start`)
- [x] Mailpit connectivity verified
- [x] Error paths covered (unauthenticated, validation errors)

### Completion Summary

**Completed**: 2025-11-22
**Agent**: Claude Sonnet 4.5
**Actual Effort**: 2.5 hours

**Tests Created**:

1. `auth-pages.test.ts` - 4 tests (Server Component auth redirect logic)
2. `auth-actions-errors.test.ts` - 7 tests (Server Action error paths)
3. `mailpit.test.ts` - 4 tests (Mailpit connectivity)

**Total**: 15 tests (exceeded requirement of 8)

**Key Decisions**:

- Tested auth state logic rather than Server Component rendering (Server Components are integration concerns)
- Used `code` property instead of `error` for Result type assertions
- Mocked both `next/navigation` and `next/headers` (including `cookies()`) for Server Action testing
- Added extra Mailpit tests (search endpoint, webUI) for comprehensive coverage

**Challenges Encountered**:

1. **Result type mismatch**: Initially used `result.error` but Result type uses `result.code`
2. **Missing cookies mock**: Server Actions call `setFlash()` which needs `cookies()` from Next.js
3. **Server Component testing**: Chose to test underlying auth logic rather than async Server Component rendering

**Solutions**:

1. Fixed assertions to use `result.code` instead of `result.error`
2. Added `cookies()` mock to `next/headers` with all required methods
3. Extracted and tested the auth state checks that Server Components rely on

**All Tests Passing**:

```
✓ auth-pages.test.ts (4 tests)
✓ auth-actions-errors.test.ts (7 tests)
✓ mailpit.test.ts (4 tests)
✓ password-reset.test.ts (4 tests - existing)
✓ All integration tests: 71 tests total
```

**Recommendations**:

- Consider extracting Server Component auth logic to helper functions for easier unit testing
- Add integration tests for other Server Actions (login, signup) using same pattern
- Mailpit connectivity tests would catch infrastructure issues like commit `8656b06`

---

## Stream 5: Configuration Validation

**Priority**: 🔴 **HIGHEST** (Prevents future whack-a-mole)
**Estimated Effort**: 2-3 hours
**Agent Can Start**: Immediately
**Dependencies**: None

### Files to Create

- `src/test/config-validation.test.ts` (NEW)

### Files to Read

- `src/app/(auth)/actions.ts` (origin allowlist)
- `supabase/config.toml` (redirect URLs)
- `.env.example` (required env vars)

### Scope

Add **proactive configuration validation**:

1. Port consistency across files (2 tests)
2. Environment variable presence (1 test)

### Detailed Test Specifications

#### 5.1 Port Consistency Tests

**File**: `src/test/config-validation.test.ts`

**CRITICAL**: This test would have **prevented all whack-a-mole commits** by failing if ports are out of sync.

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Configuration Validation", () => {
  it("should have consistent ports in actions.ts and config.toml", async () => {
    // Read actions.ts to extract allowlist
    const actionsPath = join(process.cwd(), "src/app/(auth)/actions.ts");
    const actionsContent = readFileSync(actionsPath, "utf-8");

    // Extract allowedOrigins array
    const allowlistMatch = actionsContent.match(
      /const allowedOrigins = \[([\s\S]*?)\]/
    );
    expect(allowlistMatch).toBeTruthy();

    const allowlistStr = allowlistMatch?.[1] || "";
    const allowlistPorts = [...allowlistStr.matchAll(/localhost:(\d+)/g)].map(
      (m) => m[1]
    );

    // Read config.toml to extract redirect URLs
    const configPath = join(process.cwd(), "supabase/config.toml");
    const configContent = readFileSync(configPath, "utf-8");

    // Extract additional_redirect_urls array
    const redirectMatch = configContent.match(
      /additional_redirect_urls = \[([\s\S]*?)\]/
    );
    expect(redirectMatch).toBeTruthy();

    const redirectStr = redirectMatch?.[1] || "";
    const redirectPorts = [...redirectStr.matchAll(/localhost:(\d+)/g)].map(
      (m) => m[1]
    );

    // Get unique ports from both sources
    const allowlistUnique = [...new Set(allowlistPorts)].sort();
    const redirectUnique = [...new Set(redirectPorts)].sort();

    // CRITICAL: Both arrays should have the same ports
    expect(allowlistUnique).toEqual(redirectUnique);

    // Verify expected worktree ports are present
    expect(allowlistUnique).toContain("3000"); // main
    expect(allowlistUnique).toContain("3100"); // secondary
    expect(allowlistUnique).toContain("3200"); // review
    expect(allowlistUnique).toContain("3300"); // antigravity
  });

  it("should have all redirect URL variants for each port", async () => {
    // Read config.toml
    const configPath = join(process.cwd(), "supabase/config.toml");
    const configContent = readFileSync(configPath, "utf-8");

    const redirectMatch = configContent.match(
      /additional_redirect_urls = \[([\s\S]*?)\]/
    );
    expect(redirectMatch).toBeTruthy();

    const redirectStr = redirectMatch?.[1] || "";

    // For each port, we should have 3 variants:
    // - http://localhost:PORT
    // - http://localhost:PORT/*
    // - http://localhost:PORT/auth/callback

    const expectedPorts = ["3000", "3100", "3200", "3300"];

    for (const port of expectedPorts) {
      expect(redirectStr).toContain(`http://localhost:${port}"`);
      expect(redirectStr).toContain(`http://localhost:${port}/*`);
      expect(redirectStr).toContain(`http://localhost:${port}/auth/callback`);
    }
  });

  it("should have required environment variables defined in .env.example", () => {
    const envExamplePath = join(process.cwd(), ".env.example");
    const envExampleContent = readFileSync(envExamplePath, "utf-8");

    const requiredVars = [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "DATABASE_URL",
      "PORT",
      "MAILPIT_PORT",
    ];

    for (const varName of requiredVars) {
      expect(envExampleContent).toContain(varName);
    }
  });
});
```

**⚠️ CRITICAL**: If this test fails, it means configuration has drifted. Fix immediately before deployment.

### Success Criteria

- [ ] All 3 tests pass
- [ ] Port sync test catches missing ports in either file
- [ ] Redirect URL variants test catches incomplete configuration
- [ ] Env var test catches missing documentation

**Impact**: If this had existed, commits `eb912c6` and `48a071a` would have **failed CI** before merging.

---

## Stream 6: E2E Refactoring (Post-Parallel)

**Priority**: Low (Optimization)
**Estimated Effort**: 1-2 hours
**Agent Can Start**: After Streams 1-5 complete
**Dependencies**: ✅ Streams 1-5 must be complete and passing

### Files to Modify

- `e2e/smoke/auth-flows.spec.ts` (MODIFY)

### Scope

**Reduce E2E test scope** now that unit/integration tests cover implementation details:

1. Remove Mailpit extraction details (covered by Stream 3)
2. Remove auth callback logic verification (covered by Stream 2)
3. Keep user journey (request reset → click link → set password → login)
4. Add test for invalid/expired reset link

### Detailed Refactoring Specifications

#### 6.1 Before (Current E2E Test)

Current test (`e2e/smoke/auth-flows.spec.ts:229-343`) covers:

- ✅ User journey (KEEP)
- ❌ Mailpit email extraction regex (MOVE to Stream 3)
- ❌ Auth callback redirect logic (MOVE to Stream 2)
- ❌ Sign out after reset verification (MOVE to Stream 4)

#### 6.2 After (Refactored E2E Test)

**Focus on user-visible behavior only**:

```typescript
test("Password reset flow (user journey)", async ({ page }) => {
  const testEmail = `reset-test-${Date.now()}@example.com`;
  const newPassword = "NewSecurePassword123!";

  // User journey starts: Request password reset
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(testEmail);
  await page.getByRole("button", { name: "Send Reset Link" }).click();

  // User sees confirmation message
  await expect(page.getByText(/check your email/i)).toBeVisible();

  // User checks email and clicks link (simplified)
  const resetLink = await getPasswordResetLink(testEmail);
  expect(resetLink).toBeTruthy();

  // User navigates to reset link
  await page.goto(resetLink!);

  // User sees reset password form
  await expect(page.getByLabel("New Password")).toBeVisible();

  // User sets new password
  await page.getByLabel("New Password").fill(newPassword);
  await page.getByLabel("Confirm Password").fill(newPassword);
  await page.getByRole("button", { name: "Reset Password" }).click();

  // User sees success message
  await expect(page.getByText(/password.*updated/i)).toBeVisible();

  // User can login with new password
  await page.goto("/login");
  await page.getByLabel("Email").fill(testEmail);
  await page.getByLabel("Password").fill(newPassword);
  await page.getByRole("button", { name: "Sign In" }).click();

  // User lands on dashboard
  await expect(page).toHaveURL("/dashboard");
});

test("Password reset with invalid link shows error", async ({ page }) => {
  // User receives invalid/expired reset link
  const invalidLink = "http://localhost:3000/reset-password?token=expired";

  await page.goto(invalidLink);

  // User sees error message
  await expect(page.getByText(/invalid.*link|expired/i)).toBeVisible();

  // User is redirected to forgot password
  await expect(page).toHaveURL("/forgot-password");
});
```

### Success Criteria

- [ ] E2E test runs faster (remove wait logic covered by integration tests)
- [ ] Test focuses on user-visible behavior only
- [ ] Invalid link error path covered
- [ ] All tests still pass after refactoring

---

## Appendices

### A. Test Patterns to Follow

#### A.1 Unit Test Pattern

**Example**: `src/lib/flash.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("FunctionName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should do X when Y", () => {
    const input = "test";
    const result = functionName(input);
    expect(result).toBe("expected");
  });
});
```

#### A.2 Integration Test Pattern

**Example**: `src/test/integration/supabase/password-reset.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "~/lib/supabase/server";

describe("Integration Test Suite", () => {
  beforeAll(async () => {
    // Setup: Create test data
  });

  afterAll(async () => {
    // Cleanup: Delete test data
  });

  it("should interact with real Supabase", async () => {
    const supabase = await createClient();
    const result = await supabase.from("table").select();
    expect(result.data).toBeTruthy();
  });
});
```

#### A.3 E2E Test Pattern

**Example**: `e2e/smoke/auth-flows.spec.ts`

```typescript
import { test, expect } from "@playwright/test";

test("User journey description", async ({ page }) => {
  // Navigate
  await page.goto("/path");

  // Interact
  await page.getByLabel("Field").fill("value");
  await page.getByRole("button", { name: "Submit" }).click();

  // Assert
  await expect(page).toHaveURL("/success");
});
```

### B. Mocking Strategies

#### B.1 Mocking Next.js Server Context

```typescript
vi.mock("next/headers", () => ({
  headers: vi.fn(),
  cookies: vi.fn(),
}));

// Usage
vi.mocked(headers).mockResolvedValue({
  get: (key: string) => mockHeaders.get(key) ?? null,
} as any);
```

#### B.2 Mocking Supabase Client

```typescript
vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Usage
const mockSupabase = {
  auth: {
    resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
  },
};
vi.mocked(createClient).mockResolvedValue(mockSupabase as any);
```

#### B.3 Mocking Environment Variables

```typescript
it("should use env var", () => {
  process.env.VARIABLE_NAME = "test-value";

  // Test code

  delete process.env.VARIABLE_NAME; // Cleanup
});
```

### C. File Locations

#### Source Files

- `src/app/(auth)/actions.ts` - Server Actions (forgotPassword, resetPassword)
- `src/app/(auth)/schemas.ts` - Zod validation schemas
- `src/app/(auth)/forgot-password/page.tsx` - Forgot password page
- `src/app/(auth)/reset-password/page.tsx` - Reset password page
- `src/app/auth/callback/route.ts` - OAuth/OTP callback handler
- `e2e/support/mailpit.ts` - Mailpit test utilities

#### Test Files to Create

- `src/app/(auth)/schemas.test.ts` (Stream 1)
- `src/app/(auth)/actions.test.ts` (Stream 2)
- `src/app/auth/callback/route.test.ts` (Stream 2)
- `e2e/support/mailpit.test.ts` (Stream 3)
- `src/test/integration/supabase/auth-pages.test.ts` (Stream 4)
- `src/test/integration/supabase/auth-actions-errors.test.ts` (Stream 4)
- `src/test/integration/mailpit.test.ts` (Stream 4)
- `src/test/config-validation.test.ts` (Stream 5)

#### Test Files to Modify

- `e2e/smoke/auth-flows.spec.ts` (Stream 6 - reduce scope)

### D. Running Tests

#### Unit Tests Only

```bash
npm test
```

#### Integration Tests (Requires Supabase)

```bash
supabase start
npm run test:integration
```

#### E2E Tests

```bash
npm run smoke
```

#### All Tests (Preflight)

```bash
npm run preflight
```

### E. Verification Commands

After completing each stream, run:

```bash
# Verify unit tests pass
npm test

# Verify integration tests pass (Supabase must be running)
npm run test:integration

# Verify E2E tests still pass
npm run smoke

# Full validation
npm run preflight
```

---

## Final Notes

### Critical Success Factors

1. ✅ **Streams 1-5 can run in parallel** - No file conflicts
2. ✅ **Stream 6 waits for 1-5** - Depends on lower-level coverage
3. ✅ **Configuration validation (Stream 5) is highest priority** - Prevents future bugs
4. ✅ **All tests must pass before merging** - Use `npm run preflight`

### Known Challenges

1. **Mocking Server Components**: May need to extract logic to helpers
2. **Mailpit availability**: Integration tests will fail if Mailpit not running
3. **Environment variables**: Tests may need `.env.test` or setup scripts

### Expected Impact

**Before**:

- E2E test catches config bugs after 40s
- Whack-a-mole debugging (5 commits to fix one issue)
- No confidence in refactoring

**After**:

- Unit tests catch config bugs in <1s
- Single commit fixes issues (caught by lower-level tests)
- Safe refactoring (logic covered by unit tests)

---

**END OF TASK SPECIFICATION**
