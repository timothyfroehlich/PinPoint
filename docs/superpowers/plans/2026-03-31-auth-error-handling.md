# Auth Error Handling Overhaul

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fragile string-matching on Supabase auth error messages with structured `error.code` matching, surface actionable user messages for all known auth failure modes, and add client-side Turnstile token auto-refresh to prevent expired-token submissions.

**Architecture:** A shared utility (`src/lib/auth/errors.ts`) maps Supabase `AuthError.code` values to safe, user-facing messages. Each auth action calls this utility and falls back to a context-appropriate generic message. The Turnstile widget gains `autoRefresh` behavior so tokens don't expire while users fill long forms. All changes are TDD with mocks updated to include the `code` field per Supabase best practices.

**Tech Stack:** Supabase Auth JS (`@supabase/auth-js@2.100.0`), `AuthError.code` (typed `ErrorCode`), `isAuthWeakPasswordError()` type guard, `@marsidev/react-turnstile`, Next.js Server Actions, Vitest.

**Key Supabase docs reference:** The `AuthApiError` class exposes `error.code: ErrorCode | string | undefined` and `error.status: number | undefined`. Supabase's own docs say: _"Always use error.code and error.name to identify errors, not string matching on error messages."_ The `isAuthWeakPasswordError(error)` type guard provides `error.reasons: ('length' | 'characters' | 'pwned')[]`.

---

## Background: What Broke

User self-signup on production fails with "An unexpected error occurred during signup." Systematic debugging confirmed:

1. **CAPTCHA works correctly** — Turnstile widget loads, generates valid tokens, keys match between Cloudflare and Supabase.
2. **The actual failure is `weak_password` (HTTP 422)** — Supabase's "Prevent use of leaked passwords" (HaveIBeenPwned) rejects breached passwords. The app catches ALL Supabase errors with `error.message.includes("already registered")` and returns a generic message for everything else.
3. **Token expiry causes `captcha_failed`** — If users take >5 minutes filling the form, the Turnstile token expires. Supabase returns `error.code: "captcha_failed"` with message "timeout-or-duplicate". The app shows the same generic error.
4. **Login hides infrastructure failures** — All login errors (including Supabase outages) return "Invalid email or password", confusing users who have correct credentials.

---

## File Structure

| File                                          | Responsibility                                                                   | Status     |
| --------------------------------------------- | -------------------------------------------------------------------------------- | ---------- |
| `src/lib/auth/errors.ts`                      | Shared auth error mapping utility + CAPTCHA token extraction                     | **NEW**    |
| `src/lib/auth/errors.test.ts`                 | Unit tests for the shared utility                                                | **NEW**    |
| `src/app/(auth)/actions.ts`                   | All auth server actions (login, signup, forgot-password, reset-password, logout) | **MODIFY** |
| `src/app/(auth)/actions-security.test.ts`     | Security tests for auth actions (no internal error leaks)                        | **MODIFY** |
| `src/components/security/TurnstileWidget.tsx` | Turnstile CAPTCHA widget with auto-refresh                                       | **MODIFY** |

---

### Task 1: Create Shared Auth Error Utility

**Files:**

- Create: `src/lib/auth/errors.ts`
- Create: `src/lib/auth/errors.test.ts`

- [ ] **Step 1: Write failing tests for `getUserMessageForAuthError`**

```typescript
// src/lib/auth/errors.test.ts
import { describe, it, expect } from "vitest";
import { getUserMessageForAuthError, extractCaptchaToken } from "./errors";
import { AuthApiError, AuthWeakPasswordError } from "@supabase/supabase-js";

describe("getUserMessageForAuthError", () => {
  it("returns breach message for weak_password with pwned reason", () => {
    const error = new AuthWeakPasswordError("Password is too weak", 422, [
      "pwned",
    ]);
    const result = getUserMessageForAuthError(error);
    expect(result).not.toBeUndefined();
    expect(result!.message).toContain("data breach");
    expect(result!.code).toBe("WEAK_PASSWORD");
  });

  it("returns strength message for weak_password with length reason", () => {
    const error = new AuthWeakPasswordError("Password is too weak", 422, [
      "length",
    ]);
    const result = getUserMessageForAuthError(error);
    expect(result).not.toBeUndefined();
    expect(result!.message).toContain("too short");
    expect(result!.code).toBe("WEAK_PASSWORD");
  });

  it("returns generic weak message for weak_password without specific reasons", () => {
    const error = new AuthApiError("Password too weak", 422, "weak_password");
    const result = getUserMessageForAuthError(error);
    expect(result).not.toBeUndefined();
    expect(result!.code).toBe("WEAK_PASSWORD");
  });

  it("returns duplicate message for user_already_exists", () => {
    const error = new AuthApiError(
      "User already exists",
      409,
      "user_already_exists"
    );
    const result = getUserMessageForAuthError(error);
    expect(result).toEqual({
      code: "EMAIL_TAKEN",
      message: "This email is already registered.",
    });
  });

  it("returns duplicate message for email_exists", () => {
    const error = new AuthApiError("Email exists", 409, "email_exists");
    const result = getUserMessageForAuthError(error);
    expect(result!.code).toBe("EMAIL_TAKEN");
  });

  it("returns captcha message for captcha_failed", () => {
    const error = new AuthApiError("captcha failed", 400, "captcha_failed");
    const result = getUserMessageForAuthError(error);
    expect(result).toEqual({
      code: "CAPTCHA",
      message: "Verification failed. Please refresh the page and try again.",
    });
  });

  it("returns rate limit message for over_request_rate_limit", () => {
    const error = new AuthApiError(
      "rate limit",
      429,
      "over_request_rate_limit"
    );
    const result = getUserMessageForAuthError(error);
    expect(result!.code).toBe("RATE_LIMIT");
  });

  it("returns email confirmation message for email_not_confirmed", () => {
    const error = new AuthApiError("not confirmed", 403, "email_not_confirmed");
    const result = getUserMessageForAuthError(error);
    expect(result!.code).toBe("EMAIL_NOT_CONFIRMED");
  });

  it("returns same password message for same_password", () => {
    const error = new AuthApiError("same password", 422, "same_password");
    const result = getUserMessageForAuthError(error);
    expect(result!.code).toBe("SAME_PASSWORD");
    expect(result!.message).toContain("different");
  });

  it("returns validation message for validation_failed", () => {
    const error = new AuthApiError("invalid", 400, "validation_failed");
    const result = getUserMessageForAuthError(error);
    expect(result!.code).toBe("VALIDATION");
  });

  it("returns email not authorized message", () => {
    const error = new AuthApiError(
      "not authorized",
      422,
      "email_address_not_authorized"
    );
    const result = getUserMessageForAuthError(error);
    expect(result!.code).toBe("SERVER");
    expect(result!.message).toContain("verification email");
  });

  it("returns signup disabled message for signup_disabled", () => {
    const error = new AuthApiError("disabled", 422, "signup_disabled");
    const result = getUserMessageForAuthError(error);
    expect(result!.code).toBe("SERVER");
    expect(result!.message).toContain("unavailable");
  });

  it("returns signup disabled message for email_provider_disabled", () => {
    const error = new AuthApiError("disabled", 422, "email_provider_disabled");
    const result = getUserMessageForAuthError(error);
    expect(result!.code).toBe("SERVER");
    expect(result!.message).toContain("unavailable");
  });

  it("returns undefined for unknown error codes", () => {
    const error = new AuthApiError(
      "something weird",
      500,
      "unexpected_failure"
    );
    const result = getUserMessageForAuthError(error);
    expect(result).toBeUndefined();
  });

  it("returns undefined when error has no code", () => {
    const error = new AuthApiError("no code", 500, undefined);
    const result = getUserMessageForAuthError(error);
    expect(result).toBeUndefined();
  });
});

describe("extractCaptchaToken", () => {
  it("returns string token from formData", () => {
    const fd = new FormData();
    fd.set("captchaToken", "abc123");
    expect(extractCaptchaToken(fd)).toBe("abc123");
  });

  it("returns undefined when captchaToken is missing", () => {
    const fd = new FormData();
    expect(extractCaptchaToken(fd)).toBeUndefined();
  });

  it("returns undefined when captchaToken is empty string", () => {
    const fd = new FormData();
    fd.set("captchaToken", "");
    expect(extractCaptchaToken(fd)).toBeUndefined();
  });

  it("returns undefined when captchaToken is a File", () => {
    const fd = new FormData();
    fd.set("captchaToken", new File([""], "file.txt"));
    expect(extractCaptchaToken(fd)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/auth/errors.test.ts`
Expected: FAIL — module `./errors` not found

- [ ] **Step 3: Implement the shared utility**

```typescript
// src/lib/auth/errors.ts
import type { AuthError } from "@supabase/supabase-js";
import { isAuthWeakPasswordError } from "@supabase/supabase-js";

/**
 * Result of mapping a Supabase AuthError to a user-facing message.
 * `code` maps to the Result error code used by our auth actions.
 * `message` is safe to display to the user (no internal details).
 */
export type AuthErrorMapping = {
  code: string;
  message: string;
};

/**
 * Maps a Supabase AuthError to a user-safe error code and message.
 *
 * Uses `error.code` per Supabase best practices — never string-matches
 * on `error.message` which is unstable across versions.
 *
 * Returns `undefined` for unrecognized error codes. Callers should
 * provide their own context-appropriate fallback message.
 *
 * @see https://supabase.com/docs/guides/auth/debugging/error-codes
 */
export function getUserMessageForAuthError(
  error: AuthError
): AuthErrorMapping | undefined {
  // Handle AuthWeakPasswordError specially for reason-specific messages
  if (isAuthWeakPasswordError(error)) {
    if (error.reasons.includes("pwned")) {
      return {
        code: "WEAK_PASSWORD",
        message:
          "This password has appeared in a data breach and cannot be used. Please choose a different password.",
      };
    }
    if (error.reasons.includes("length")) {
      return {
        code: "WEAK_PASSWORD",
        message: "Password is too short. Please use at least 8 characters.",
      };
    }
    if (error.reasons.includes("characters")) {
      return {
        code: "WEAK_PASSWORD",
        message:
          "Password needs more variety. Include uppercase, lowercase, numbers, or symbols.",
      };
    }
    return {
      code: "WEAK_PASSWORD",
      message: "Password is too weak. Please choose a stronger password.",
    };
  }

  switch (error.code) {
    // Weak password (non-AuthWeakPasswordError fallback)
    case "weak_password":
      return {
        code: "WEAK_PASSWORD",
        message: "Password is too weak. Please choose a stronger password.",
      };

    // Duplicate registration
    case "user_already_exists":
    case "email_exists":
      return {
        code: "EMAIL_TAKEN",
        message: "This email is already registered.",
      };

    // CAPTCHA failures (expired token, failed verification)
    case "captcha_failed":
      return {
        code: "CAPTCHA",
        message: "Verification failed. Please refresh the page and try again.",
      };

    // Rate limiting (Supabase-level, distinct from our app-level rate limits)
    case "over_request_rate_limit":
      return {
        code: "RATE_LIMIT",
        message: "Too many attempts. Please try again in a few minutes.",
      };

    // Email not confirmed (relevant for login)
    case "email_not_confirmed":
      return {
        code: "EMAIL_NOT_CONFIRMED",
        message:
          "Please check your email and confirm your account before signing in.",
      };

    // Same password on reset
    case "same_password":
      return {
        code: "SAME_PASSWORD",
        message: "New password must be different from your current password.",
      };

    // Validation errors
    case "validation_failed":
    case "email_address_invalid":
      return {
        code: "VALIDATION",
        message: "Please check your details and try again.",
      };

    // Email sending not authorized (default SMTP limitation)
    case "email_address_not_authorized":
      return {
        code: "SERVER",
        message:
          "Unable to send verification email to this address. Please try a different email or contact support.",
      };

    // Signup disabled
    case "signup_disabled":
    case "email_provider_disabled":
      return {
        code: "SERVER",
        message: "Account registration is currently unavailable.",
      };

    default:
      return undefined;
  }
}

/**
 * Extracts the Turnstile CAPTCHA token from FormData.
 *
 * Returns `undefined` if the token is missing, empty, or not a string
 * (e.g., if a File was submitted instead). Supabase omits the captchaToken
 * from the request when `undefined`, which is correct behavior when
 * CAPTCHA is not configured.
 */
export function extractCaptchaToken(formData: FormData): string | undefined {
  const entry = formData.get("captchaToken");
  if (typeof entry === "string" && entry.length > 0) {
    return entry;
  }
  return undefined;
}

/**
 * Creates a structured log context object for Supabase auth errors.
 * Includes error.code and error.status for efficient log searching.
 */
export function authErrorLogContext(
  error: AuthError,
  action: string
): Record<string, unknown> {
  return {
    action,
    errorCode: error.code,
    errorStatus: error.status,
    error: error.message,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/auth/errors.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/errors.ts src/lib/auth/errors.test.ts
git commit -m "feat(auth): add shared auth error mapping utility

Maps Supabase AuthError.code to user-safe messages per Supabase
best practices. Handles weak_password (with HIBP breach detection),
captcha_failed, rate limits, email conflicts, and more.

Includes extractCaptchaToken() helper to DRY up FormData extraction
across login, signup, and forgot-password actions."
```

---

### Task 2: Update `signupAction` to Use Error Codes

**Files:**

- Modify: `src/app/(auth)/actions.ts` (signupAction, lines ~207-386)
- Modify: `src/app/(auth)/actions-security.test.ts`

**Context for the implementing agent:** The `signupAction` function currently handles Supabase errors with fragile string matching: `error.message.includes("already registered")`. It also returns a generic "An unexpected error occurred during signup" for ALL other errors, including the `weak_password` (HIBP) error that is the primary user-facing bug. The `SignupResult` type needs a `"WEAK_PASSWORD"` code added.

- [ ] **Step 1: Update the `SignupResult` type**

In `src/app/(auth)/actions.ts`, change the `SignupResult` type to include `"WEAK_PASSWORD"` and `"CAPTCHA"`:

```typescript
export type SignupResult = Result<
  { userId: string },
  | "VALIDATION"
  | "EMAIL_TAKEN"
  | "WEAK_PASSWORD"
  | "CAPTCHA"
  | "SERVER"
  | "CONFIRMATION_REQUIRED"
  | "RATE_LIMIT"
>;
```

- [ ] **Step 2: Update signupAction imports and error handling**

Add imports at the top of `src/app/(auth)/actions.ts`:

```typescript
import {
  getUserMessageForAuthError,
  extractCaptchaToken,
  authErrorLogContext,
} from "~/lib/auth/errors";
```

Replace the CAPTCHA token extraction block (lines ~260-263) with:

```typescript
const captchaToken = extractCaptchaToken(formData);
```

Replace the error handling block after `supabase.auth.signUp()` (lines ~278-301) with:

```typescript
if (error) {
  log.warn(
    authErrorLogContext(error, "signup"),
    "Signup failed: Supabase error"
  );

  const mapped = getUserMessageForAuthError(error);
  if (mapped) {
    return err(
      mapped.code as SignupResult extends Result<unknown, infer C> ? C : never,
      mapped.message
    );
  }

  return err("SERVER", "An unexpected error occurred during signup");
}
```

**Important type note:** The `mapped.code` cast is needed because `getUserMessageForAuthError` returns a generic `string` code, but `SignupResult` expects specific string literals. The mapping utility intentionally returns codes that match the `SignupResult` union (`"WEAK_PASSWORD"`, `"EMAIL_TAKEN"`, `"CAPTCHA"`, `"RATE_LIMIT"`, `"SERVER"`, `"VALIDATION"`), so the cast is safe. If you prefer, you can use individual `if` checks instead:

```typescript
if (error) {
  log.warn(
    authErrorLogContext(error, "signup"),
    "Signup failed: Supabase error"
  );

  const mapped = getUserMessageForAuthError(error);
  if (mapped) {
    // All mapped codes are valid SignupResult codes
    return err(
      mapped.code as
        | "WEAK_PASSWORD"
        | "EMAIL_TAKEN"
        | "CAPTCHA"
        | "RATE_LIMIT"
        | "SERVER"
        | "VALIDATION",
      mapped.message
    );
  }

  return err("SERVER", "An unexpected error occurred during signup");
}
```

- [ ] **Step 3: Write new test for weak_password error in signup**

Add to `src/app/(auth)/actions-security.test.ts`, after the existing "duplicate email" test:

```typescript
it("signupAction should return WEAK_PASSWORD for breached password", async () => {
  const { AuthWeakPasswordError } = await import("@supabase/supabase-js");
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      signUp: vi.fn().mockResolvedValue({
        error: new AuthWeakPasswordError("Password is too weak", 422, [
          "pwned",
        ]),
        data: { user: null },
      }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
  } as any);

  const formData = new FormData();
  formData.set("email", "test@example.com");
  formData.set("password", "Password123!");
  formData.set("confirmPassword", "Password123!");
  formData.set("firstName", "John");
  formData.set("lastName", "Doe");
  formData.set("termsAccepted", "on");

  const result = await signupAction(undefined, formData);

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).toBe("WEAK_PASSWORD");
    expect(result.message).toContain("data breach");
    expect(result.message).not.toContain("Password is too weak"); // No Supabase message leak
  }
});

it("signupAction should return CAPTCHA error for captcha_failed", async () => {
  const { AuthApiError } = await import("@supabase/supabase-js");
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      signUp: vi.fn().mockResolvedValue({
        error: new AuthApiError(
          "captcha protection: request disallowed (timeout-or-duplicate)",
          400,
          "captcha_failed"
        ),
        data: { user: null },
      }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
  } as any);

  const formData = new FormData();
  formData.set("email", "test@example.com");
  formData.set("password", "StrongUniquePass99!");
  formData.set("confirmPassword", "StrongUniquePass99!");
  formData.set("firstName", "John");
  formData.set("lastName", "Doe");
  formData.set("termsAccepted", "on");

  const result = await signupAction(undefined, formData);

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).toBe("CAPTCHA");
    expect(result.message).toContain("refresh");
    expect(result.message).not.toContain("timeout-or-duplicate"); // No Supabase message leak
  }
});
```

- [ ] **Step 4: Update existing duplicate email test to use error code**

In `src/app/(auth)/actions-security.test.ts`, update the "duplicate email" test mock to include `code`:

```typescript
it("signupAction should return specific error for duplicate email", async () => {
  const { AuthApiError } = await import("@supabase/supabase-js");
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      signUp: vi.fn().mockResolvedValue({
        error: new AuthApiError(
          "User already registered",
          409,
          "user_already_exists"
        ),
        data: { user: null },
      }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
  } as any);

  const formData = new FormData();
  formData.set("email", "taken@example.com");
  formData.set("password", "Password123!");
  formData.set("confirmPassword", "Password123!");
  formData.set("firstName", "John");
  formData.set("lastName", "Doe");
  formData.set("termsAccepted", "on");

  const result = await signupAction(undefined, formData);

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).toBe("EMAIL_TAKEN");
    expect(result.message).toBe("This email is already registered.");
  }
});
```

- [ ] **Step 5: Update existing generic error test to use AuthApiError with code**

Update the "generic error" test mock:

```typescript
it("signupAction should return generic error message on server error", async () => {
  const { AuthApiError } = await import("@supabase/supabase-js");
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      signUp: vi.fn().mockResolvedValue({
        error: new AuthApiError(
          "Database connection failed: 5432",
          500,
          "unexpected_failure"
        ),
        data: { user: null },
      }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
  } as any);

  const formData = new FormData();
  formData.set("email", "test@example.com");
  formData.set("password", "Password123!");
  formData.set("confirmPassword", "Password123!");
  formData.set("firstName", "John");
  formData.set("lastName", "Doe");
  formData.set("termsAccepted", "on");

  const result = await signupAction(undefined, formData);

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).toBe("SERVER");
    expect(result.message).toBe("An unexpected error occurred during signup");
    expect(result.message).not.toContain("Database connection failed"); // No leak
  }
});
```

- [ ] **Step 6: Run tests**

Run: `pnpm vitest run src/app/\(auth\)/actions-security.test.ts src/lib/auth/errors.test.ts`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/\(auth\)/actions.ts src/app/\(auth\)/actions-security.test.ts
git commit -m "fix(auth): surface specific signup errors instead of generic message

Replace string matching on error.message with error.code per Supabase
best practices. Users now see actionable messages for:
- Breached passwords (HIBP): 'appeared in a data breach'
- Expired CAPTCHA tokens: 'refresh the page and try again'
- Duplicate emails: 'already registered'
- Rate limits, validation errors, etc.

Unknown errors still return a safe generic message.
Fixes user-facing signup failures that showed 'An unexpected error occurred'
when the actual problem was a breached password (weak_password/422)."
```

---

### Task 3: Update `loginAction` to Use Error Codes

**Files:**

- Modify: `src/app/(auth)/actions.ts` (loginAction, lines ~64-197)
- Modify: `src/app/(auth)/actions-security.test.ts`

**Security context for the implementing agent:** Login error handling is DIFFERENT from signup. For login, you must NOT reveal whether the email exists or the password is wrong — that enables account enumeration. However, you SHOULD surface non-credential errors like CAPTCHA failures, rate limits, email not confirmed, and server errors, because these are not credential-related.

The `LoginResult` type needs `"CAPTCHA"` and `"EMAIL_NOT_CONFIRMED"` codes added.

- [ ] **Step 1: Update the `LoginResult` type**

```typescript
export type LoginResult = Result<
  { userId: string },
  | "VALIDATION"
  | "AUTH"
  | "CAPTCHA"
  | "EMAIL_NOT_CONFIRMED"
  | "SERVER"
  | "RATE_LIMIT",
  { submittedEmail: string }
>;
```

- [ ] **Step 2: Update loginAction to use shared utilities**

Replace the CAPTCHA token extraction (lines ~133-136) with:

```typescript
const captchaToken = extractCaptchaToken(formData);
```

Replace the error handling block after `signInWithPassword` (lines ~150-159) with:

```typescript
// Defensive check - Supabase types guarantee user exists if no error,
// but we check both for safety
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Supabase types guarantee user exists if no error, but defensive check remains
if (error || !data.user) {
  if (error) {
    log.warn(
      authErrorLogContext(error, "login"),
      "Login authentication failed"
    );

    // Surface non-credential errors with specific messages.
    // Credential errors (invalid_credentials, unknown codes) stay generic
    // to prevent account enumeration.
    const mapped = getUserMessageForAuthError(error);
    if (mapped) {
      switch (mapped.code) {
        case "CAPTCHA":
          return err("CAPTCHA", mapped.message, { submittedEmail });
        case "EMAIL_NOT_CONFIRMED":
          return err("EMAIL_NOT_CONFIRMED", mapped.message, { submittedEmail });
        case "RATE_LIMIT":
          return err("RATE_LIMIT", mapped.message, { submittedEmail });
        // All other mapped codes (EMAIL_TAKEN, WEAK_PASSWORD, etc.)
        // fall through to generic "Invalid email or password" for security
      }
    }

    // Server errors (status >= 500) get a distinct message
    // so users know it's not their credentials
    if (error.status !== undefined && error.status >= 500) {
      return err("SERVER", "Something went wrong. Please try again later.", {
        submittedEmail,
      });
    }
  } else {
    log.warn(
      { action: "login" },
      "Login failed: no user returned without error"
    );
  }

  return err("AUTH", "Invalid email or password", {
    submittedEmail,
  });
}
```

- [ ] **Step 3: Write tests for login-specific error handling**

Add to `src/app/(auth)/actions-security.test.ts`:

```typescript
it("loginAction should return CAPTCHA error for captcha_failed", async () => {
  const { AuthApiError } = await import("@supabase/supabase-js");
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({
        error: new AuthApiError(
          "captcha protection: request disallowed",
          400,
          "captcha_failed"
        ),
        data: { user: null },
      }),
    },
  } as any);

  const formData = new FormData();
  formData.set("email", "test@example.com");
  formData.set("password", "Password123!");

  const result = await loginAction(undefined, formData);

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).toBe("CAPTCHA");
    expect(result.message).toContain("refresh");
  }
});

it("loginAction should return EMAIL_NOT_CONFIRMED for unconfirmed email", async () => {
  const { AuthApiError } = await import("@supabase/supabase-js");
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({
        error: new AuthApiError(
          "Email not confirmed",
          403,
          "email_not_confirmed"
        ),
        data: { user: null },
      }),
    },
  } as any);

  const formData = new FormData();
  formData.set("email", "test@example.com");
  formData.set("password", "Password123!");

  const result = await loginAction(undefined, formData);

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).toBe("EMAIL_NOT_CONFIRMED");
    expect(result.message).toContain("confirm your account");
  }
});

it("loginAction should return SERVER for 500-level errors instead of 'Invalid email or password'", async () => {
  const { AuthApiError } = await import("@supabase/supabase-js");
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({
        error: new AuthApiError(
          "Internal Server Error: Connection reset by peer",
          500,
          "unexpected_failure"
        ),
        data: { user: null },
      }),
    },
  } as any);

  const formData = new FormData();
  formData.set("email", "test@example.com");
  formData.set("password", "Password123!");

  const result = await loginAction(undefined, formData);

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).toBe("SERVER");
    expect(result.message).toBe(
      "Something went wrong. Please try again later."
    );
    expect(result.message).not.toContain("Connection reset"); // No leak
  }
});

it("loginAction should still return generic 'Invalid email or password' for credential errors", async () => {
  const { AuthApiError } = await import("@supabase/supabase-js");
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({
        error: new AuthApiError(
          "Invalid login credentials",
          400,
          "invalid_credentials"
        ),
        data: { user: null },
      }),
    },
  } as any);

  const formData = new FormData();
  formData.set("email", "test@example.com");
  formData.set("password", "WrongPassword!");

  const result = await loginAction(undefined, formData);

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).toBe("AUTH");
    expect(result.message).toBe("Invalid email or password");
  }
});
```

- [ ] **Step 4: Update existing login generic error test**

Update the existing test mock to use `AuthApiError`:

```typescript
it("loginAction should return generic error message on server error", async () => {
  const { AuthApiError } = await import("@supabase/supabase-js");
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({
        error: new AuthApiError(
          "Internal Server Error: Connection reset by peer",
          500,
          "unexpected_failure"
        ),
        data: { user: null },
      }),
    },
  } as any);

  const formData = new FormData();
  formData.set("email", "test@example.com");
  formData.set("password", "Password123!");

  const result = await loginAction(undefined, formData);

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).toBe("SERVER");
    expect(result.message).not.toContain("Connection reset"); // No leak
  }
});
```

**Note:** This replaces the existing login test that expected `code: "AUTH"` for server errors. The new behavior correctly returns `"SERVER"` for 500s.

- [ ] **Step 5: Run tests**

Run: `pnpm vitest run src/app/\(auth\)/actions-security.test.ts`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/\(auth\)/actions.ts src/app/\(auth\)/actions-security.test.ts
git commit -m "fix(auth): distinguish login infrastructure errors from credential failures

Login now returns SERVER for 500-level Supabase errors instead of
'Invalid email or password', so users know it's not their credentials.
Also surfaces CAPTCHA and EMAIL_NOT_CONFIRMED errors specifically.
Credential errors (invalid_credentials, unknown codes) still return
the generic message to prevent account enumeration."
```

---

### Task 4: Update `forgotPasswordAction` and `resetPasswordAction`

**Files:**

- Modify: `src/app/(auth)/actions.ts` (forgotPasswordAction lines ~441-519, resetPasswordAction lines ~532-613)
- Modify: `src/app/(auth)/actions-security.test.ts`

**Context:** `forgotPasswordAction` should remain mostly silent (return success for most errors to prevent email enumeration). The one exception: CAPTCHA failures should surface, since they're not email-related. `resetPasswordAction` needs `weak_password` and `same_password` handling.

- [ ] **Step 1: Update `ForgotPasswordResult` and `ResetPasswordResult` types**

```typescript
export type ForgotPasswordResult = Result<
  void,
  "VALIDATION" | "CAPTCHA" | "SERVER"
>;

export type ResetPasswordResult = Result<
  void,
  "VALIDATION" | "WEAK_PASSWORD" | "SAME_PASSWORD" | "SERVER"
>;
```

- [ ] **Step 2: Update `forgotPasswordAction` to use shared utilities**

Replace the CAPTCHA token extraction (lines ~484-486) with:

```typescript
const captchaToken = extractCaptchaToken(formData);
```

Replace the error handling after `resetPasswordForEmail` (lines ~499-504) with:

```typescript
if (error) {
  log.warn(
    authErrorLogContext(error, "forgot-password"),
    "Password reset email failed"
  );

  // Surface CAPTCHA errors — they're not email-related
  if (error.code === "captcha_failed") {
    const mapped = getUserMessageForAuthError(error);
    if (mapped) {
      return err("CAPTCHA", mapped.message);
    }
  }

  // All other errors: return success to prevent email enumeration
  // The error is logged but not revealed to the user
  return ok(undefined);
}
```

**Security note:** Previously this returned `err("SERVER", "Failed to send password reset email")` on error, which could enable timing-based email enumeration (error responses are faster than actually sending an email). Now it returns `ok(undefined)` for all non-CAPTCHA errors, consistent with the rate-limit handling above it.

- [ ] **Step 3: Update `resetPasswordAction` to use shared utilities**

Replace the error handling after `updateUser` (lines ~572-579) with:

```typescript
if (error) {
  log.warn(
    authErrorLogContext(error, "reset-password"),
    "Password update failed"
  );

  const mapped = getUserMessageForAuthError(error);
  if (mapped) {
    return err(
      mapped.code as
        | "WEAK_PASSWORD"
        | "SAME_PASSWORD"
        | "SERVER"
        | "VALIDATION",
      mapped.message
    );
  }

  return err("SERVER", "Failed to update password");
}
```

- [ ] **Step 4: Write tests**

Add to `src/app/(auth)/actions-security.test.ts`:

```typescript
it("forgotPasswordAction should surface CAPTCHA errors", async () => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  const { AuthApiError } = await import("@supabase/supabase-js");
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      resetPasswordForEmail: vi.fn().mockResolvedValue({
        error: new AuthApiError("captcha failed", 400, "captcha_failed"),
      }),
    },
  } as any);

  const formData = new FormData();
  formData.set("email", "test@example.com");

  const result = await forgotPasswordAction(undefined, formData);

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).toBe("CAPTCHA");
  }
});

it("forgotPasswordAction should return success for non-CAPTCHA errors (prevent enumeration)", async () => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  const { AuthApiError } = await import("@supabase/supabase-js");
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      resetPasswordForEmail: vi.fn().mockResolvedValue({
        error: new AuthApiError(
          "SMTP connection timeout",
          500,
          "unexpected_failure"
        ),
      }),
    },
  } as any);

  const formData = new FormData();
  formData.set("email", "test@example.com");

  const result = await forgotPasswordAction(undefined, formData);

  // Should return success to prevent email enumeration
  expect(result.ok).toBe(true);
});

it("resetPasswordAction should return WEAK_PASSWORD for breached password", async () => {
  const { AuthWeakPasswordError } = await import("@supabase/supabase-js");
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: { id: "user-123" } } }),
      updateUser: vi.fn().mockResolvedValue({
        error: new AuthWeakPasswordError("Password is too weak", 422, [
          "pwned",
        ]),
      }),
      signOut: vi.fn(),
    },
  } as any);

  const formData = new FormData();
  formData.set("password", "Password123!");
  formData.set("confirmPassword", "Password123!");

  const result = await resetPasswordAction(undefined, formData);

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).toBe("WEAK_PASSWORD");
    expect(result.message).toContain("data breach");
  }
});

it("resetPasswordAction should return SAME_PASSWORD for same_password error", async () => {
  const { AuthApiError } = await import("@supabase/supabase-js");
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: { id: "user-123" } } }),
      updateUser: vi.fn().mockResolvedValue({
        error: new AuthApiError("Same password", 422, "same_password"),
      }),
      signOut: vi.fn(),
    },
  } as any);

  const formData = new FormData();
  formData.set("password", "OldPassword123!");
  formData.set("confirmPassword", "OldPassword123!");

  const result = await resetPasswordAction(undefined, formData);

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).toBe("SAME_PASSWORD");
    expect(result.message).toContain("different");
  }
});
```

- [ ] **Step 5: Update existing forgotPassword and resetPassword test mocks**

Update the existing `forgotPasswordAction` generic error test:

```typescript
it("forgotPasswordAction should not leak server error details", async () => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  const { AuthApiError } = await import("@supabase/supabase-js");
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      resetPasswordForEmail: vi.fn().mockResolvedValue({
        error: new AuthApiError(
          "SMTP connection timeout",
          500,
          "unexpected_failure"
        ),
      }),
    },
  } as any);

  const formData = new FormData();
  formData.set("email", "test@example.com");

  const result = await forgotPasswordAction(undefined, formData);

  // Now returns success (not error) to prevent email enumeration
  expect(result.ok).toBe(true);
});
```

Update the existing `resetPasswordAction` generic error test:

```typescript
it("resetPasswordAction should return generic error message on server error", async () => {
  const { AuthApiError } = await import("@supabase/supabase-js");
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: { id: "user-123" } } }),
      updateUser: vi.fn().mockResolvedValue({
        error: new AuthApiError(
          "Constraint violation: password_history",
          500,
          "unexpected_failure"
        ),
      }),
      signOut: vi.fn(),
    },
  } as any);

  const formData = new FormData();
  formData.set("password", "NewPassword123!");
  formData.set("confirmPassword", "NewPassword123!");

  const result = await resetPasswordAction(undefined, formData);

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).toBe("SERVER");
    expect(result.message).toBe("Failed to update password");
    expect(result.message).not.toContain("Constraint violation"); // No leak
  }
});
```

- [ ] **Step 6: Run all auth tests**

Run: `pnpm vitest run src/app/\(auth\)/actions-security.test.ts src/lib/auth/errors.test.ts`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/\(auth\)/actions.ts src/app/\(auth\)/actions-security.test.ts
git commit -m "fix(auth): improve forgot-password and reset-password error handling

forgotPasswordAction now returns success for non-CAPTCHA errors
(previously returned an error that could enable email enumeration).
resetPasswordAction surfaces weak_password and same_password errors.
Both use shared auth error utilities."
```

---

### Task 5: Add Turnstile Token Auto-Refresh

**Files:**

- Modify: `src/components/security/TurnstileWidget.tsx`

**Context:** The `@marsidev/react-turnstile` `Turnstile` component accepts a `ref` that exposes a `reset()` method. When the token expires, we should automatically re-trigger verification so the user never submits with a stale token. The current `onExpire` handler clears the token to `""` but doesn't re-trigger. Note: `refreshExpired="auto"` is a Turnstile option that handles this natively.

- [ ] **Step 1: Update TurnstileWidget to use `refreshExpired: "auto"`**

The Cloudflare Turnstile `options` prop accepts `refreshExpired: "auto"` which automatically re-verifies when the token expires. This is the simplest fix — no ref/reset needed.

In `src/components/security/TurnstileWidget.tsx`, update the options:

```typescript
    <Turnstile
      siteKey={siteKey}
      onSuccess={handleVerify}
      onExpire={handleExpire}
      onError={handleExpire}
      options={{ size: "flexible", appearance: "interaction-only", refreshExpired: "auto" }}
      className={className}
    />
```

That's it. The `onExpire` callback still fires (clearing the token state), and then Turnstile automatically re-verifies and calls `onSuccess` with a fresh token. No user interaction required.

- [ ] **Step 2: Run check to verify nothing broke**

Run: `pnpm run check`
Expected: PASS (this is a props-only change with no type changes)

- [ ] **Step 3: Commit**

```bash
git add src/components/security/TurnstileWidget.tsx
git commit -m "fix(auth): auto-refresh Turnstile token on expiry

Add refreshExpired: 'auto' to Turnstile options. Previously, if a
user took >5 minutes filling the signup form, the token expired and
submission failed with 'captcha_failed'. Now the widget automatically
re-verifies in the background, generating a fresh token."
```

---

### Task 6: Run Full Preflight and Clean Up Test Account

- [ ] **Step 1: Run preflight**

Run: `pnpm run preflight`
Expected: ALL PASS (types, lint, format, unit tests, build, integration tests)

If any tests fail, fix them before proceeding. Common issues:

- The `actions-security.test.ts` tests that were updated may need the `vi.mock("~/lib/auth/errors"...)` to be removed — since the real module should be used (not mocked) so the mapping is tested end-to-end.
- TypeScript may complain about the `mapped.code as ...` cast — if so, use an explicit switch or if-chain on `mapped.code` values instead.

- [ ] **Step 2: Delete test account from production Supabase**

The debugging session created `test-unique-pass@example.com` in production. Delete it via the Supabase dashboard (Authentication → Users → find and delete) or via SQL:

```sql
-- Run via Supabase SQL Editor on production
DELETE FROM auth.users WHERE email = 'test-unique-pass@example.com';
```

- [ ] **Step 3: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore: preflight fixes"
```

- [ ] **Step 4: Push branch**

```bash
git push -u origin worktree/user-creation-failure
```

---

## Adversarial Review Amendments

Two adversarial review agents (security + correctness) reviewed this plan. The following amendments are **mandatory** — they override the code shown in the tasks above. Implementing agents must apply these changes when reaching the relevant task step.

### Amendment A: Remove `email_not_confirmed` from Login (Security — HIGH)

**Overrides:** Task 3, Step 2

Surfacing `EMAIL_NOT_CONFIRMED` on the login path enables account enumeration — an attacker can distinguish "account exists but unconfirmed" from "wrong credentials." This contradicts the plan's stated goal.

**Fix:** In the login error handler (Task 3, Step 2), do NOT surface `email_not_confirmed`. Remove the `EMAIL_NOT_CONFIRMED` case from the login switch and remove it from `LoginResult`. The `email_not_confirmed` mapping should remain in the shared utility (it's useful for other contexts) but login must not use it.

Updated `LoginResult` type:

```typescript
export type LoginResult = Result<
  { userId: string },
  "VALIDATION" | "AUTH" | "CAPTCHA" | "SERVER" | "RATE_LIMIT",
  { submittedEmail: string }
>;
```

Updated login switch (remove the `EMAIL_NOT_CONFIRMED` case entirely):

```typescript
if (mapped) {
  switch (mapped.code) {
    case "CAPTCHA":
      return err("CAPTCHA", mapped.message, { submittedEmail });
    case "RATE_LIMIT":
      return err("RATE_LIMIT", mapped.message, { submittedEmail });
    // All other mapped codes fall through to generic message
  }
}
```

Also remove the `loginAction should return EMAIL_NOT_CONFIRMED` test from Task 3, Step 3.

### Amendment B: Use Explicit Allowlist Instead of `as` Cast (Security — MEDIUM)

**Overrides:** Task 2 Step 2, Task 3 Step 2, Task 4 Step 3

The `mapped.code as <union>` cast is type-unsafe — if the mapping utility returns a code not in the Result union (e.g., `"SAME_PASSWORD"` hitting signup), TypeScript is silenced. Use a runtime allowlist guard instead.

**Fix:** In each action, validate `mapped.code` against the expected set before returning:

For `signupAction`:

```typescript
if (error) {
  log.warn(
    authErrorLogContext(error, "signup"),
    "Signup failed: Supabase error"
  );

  const mapped = getUserMessageForAuthError(error);
  if (mapped) {
    const signupCodes = new Set<string>([
      "WEAK_PASSWORD",
      "EMAIL_TAKEN",
      "CAPTCHA",
      "RATE_LIMIT",
      "SERVER",
      "VALIDATION",
    ]);
    if (signupCodes.has(mapped.code)) {
      return err(
        mapped.code as
          | "WEAK_PASSWORD"
          | "EMAIL_TAKEN"
          | "CAPTCHA"
          | "RATE_LIMIT"
          | "SERVER"
          | "VALIDATION",
        mapped.message
      );
    }
  }

  return err("SERVER", "An unexpected error occurred during signup");
}
```

Apply the same pattern to `loginAction` (with `loginCodes: "CAPTCHA" | "RATE_LIMIT"`) and `resetPasswordAction` (with `resetCodes: "WEAK_PASSWORD" | "SAME_PASSWORD" | "SERVER" | "VALIDATION"`).

### Amendment C: Handle `AuthRetryableFetchError` in Login (Correctness — MEDIUM)

**Overrides:** Task 3, Step 2

`AuthUnknownError` and `AuthRetryableFetchError` don't set `error.status`, so the `error.status >= 500` check misses network-level failures (Supabase unreachable). Users with correct credentials see "Invalid email or password" during outages.

**Fix:** Add an `isAuthRetryableFetchError` check before the status check in loginAction:

```typescript
import { isAuthRetryableFetchError } from "@supabase/supabase-js";

// Network-level failures (Supabase unreachable) — not a credential error
if (isAuthRetryableFetchError(error)) {
  return err("SERVER", "Something went wrong. Please try again later.", {
    submittedEmail,
  });
}

// Server errors (status >= 500) — not a credential error
if (error.status !== undefined && error.status >= 500) {
  return err("SERVER", "Something went wrong. Please try again later.", {
    submittedEmail,
  });
}
```

Also add a test:

```typescript
it("loginAction should return SERVER for network failures (AuthRetryableFetchError)", async () => {
  const { AuthRetryableFetchError } = await import("@supabase/supabase-js");
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({
        error: new AuthRetryableFetchError("Network error", 0),
        data: { user: null },
      }),
    },
  } as any);

  const formData = new FormData();
  formData.set("email", "test@example.com");
  formData.set("password", "Password123!");

  const result = await loginAction(undefined, formData);

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).toBe("SERVER");
    expect(result.message).toContain("Something went wrong");
  }
});
```

### Amendment D: Disable Submit While Token Is Empty (Security — LOW)

**Overrides:** Task 5

During the Turnstile auto-refresh window (between `onExpire` clearing the token and `onSuccess` providing a new one), the submit button should be disabled. This is NOT a TurnstileWidget change — it's a form-level concern.

**Fix:** In each form that uses TurnstileWidget (`signup-form.tsx`, `login-form.tsx`, `forgot-password-form.tsx`), the submit button should already be gated on `isPending` from `useActionState`. Since the token state is local to the form, the form can additionally disable submit when `turnstileToken === ""`. The simplest approach:

```tsx
<button
  type="submit"
  disabled={isPending || (hasTurnstile && !turnstileToken)}
>
```

Where `hasTurnstile` is `!!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY`.

**Note:** This is a LOW priority enhancement. The auto-refresh window is 1-3 seconds and the CAPTCHA error message ("Verification failed. Please refresh the page") handles this case adequately. Implement if time allows.

### Amendment E: Add `createClient()` Rejection Test (Correctness — MEDIUM)

**Overrides:** Task 6 (add before preflight)

No test currently covers the code path where `createClient()` throws (e.g., missing env vars). Add one:

```typescript
it("signupAction should return SERVER when createClient() throws", async () => {
  vi.mocked(createClient).mockRejectedValue(new Error("Missing SUPABASE_URL"));

  const formData = new FormData();
  formData.set("email", "test@example.com");
  formData.set("password", "StrongUniquePass99!");
  formData.set("confirmPassword", "StrongUniquePass99!");
  formData.set("firstName", "John");
  formData.set("lastName", "Doe");
  formData.set("termsAccepted", "on");

  const result = await signupAction(undefined, formData);

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).toBe("SERVER");
    expect(result.message).not.toContain("SUPABASE_URL"); // No leak
  }
});
```

### Accepted Risks (No Action Needed)

| Finding                                                         | Severity | Why Accepted                                                                                                                                |
| --------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `EMAIL_TAKEN` on signup confirms account existence              | MEDIUM   | Standard UX pattern, mitigated by rate limiting. Would require "check your email for all outcomes" UX to fix, which hurts legitimate users. |
| SERVER vs AUTH response difference on login                     | MEDIUM   | UX benefit (users know it's not their credentials during outages) outweighs the fingerprinting risk for a community pinball app.            |
| Forgot-password timing side-channel                             | LOW      | Would require artificial delays to fix. Response-body enumeration is already closed.                                                        |
| SMTP failures silently return success in forgot-password        | MEDIUM   | Intentional anti-enumeration. Users who don't receive an email will retry or contact support.                                               |
| No rate limiting on reset-password                              | LOW      | Requires valid session via reset link. Token creation is already rate-limited.                                                              |
| Missing error codes (`user_banned`, `flow_state_expired`, etc.) | LOW      | All fall through to safe generic messages. Not relevant to email/password auth.                                                             |
