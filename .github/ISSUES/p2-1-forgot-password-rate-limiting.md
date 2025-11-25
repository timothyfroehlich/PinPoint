# [P2] Add Forgot Password Rate Limiting

**Priority:** P2 - Medium
**Effort:** 1 hour
**Parent Issue:** Security Review Main Issue

## Problem

The forgot password endpoint has **NO rate limiting**, allowing unlimited password reset emails.

**Attack Scenarios:**

1. **Email Bombing:**
   - Attacker repeatedly triggers password reset for victim's email
   - Victim's inbox flooded with password reset emails
   - Harassment attack

2. **Email Quota Exhaustion:**
   - Attacker triggers password resets for many emails
   - Email service quota exhausted
   - Legitimate password resets fail

3. **Resource Exhaustion:**
   - Thousands of password reset requests
   - Database and email service overload

**Current Code:**
```typescript
// src/app/(auth)/actions.ts:356
export async function forgotPasswordAction(
  formData: FormData
): Promise<ForgotPasswordResult> {
  // ❌ NO rate limiting - unlimited password reset requests
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
  });
  // ...
}
```

**Reference:** Section 7.2 of [SECURITY_REVIEW_2025-11-25.md](https://github.com/timothyfroehlich/PinPoint/blob/claude/security-review-codebase-011jfKFnKjKcqTDdG5njh7kQ/SECURITY_REVIEW_2025-11-25.md)

## Recommended Solution

Email-based rate limiting (NOT IP-based):

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const forgotPasswordRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.fixedWindow(3, "1 h"), // 3 requests per email per hour
});

export async function forgotPasswordAction(
  formData: FormData
): Promise<ForgotPasswordResult> {
  // Validate email format
  const validation = forgotPasswordSchema.safeParse(rawData);
  if (!validation.success) {
    // ... existing error handling
  }

  const { email } = validation.data;

  // Check rate limit by email (not IP)
  const { success, reset } = await forgotPasswordRatelimit.limit(`forgot:${email}`);

  if (!success) {
    const resetTime = new Date(reset).toLocaleTimeString();
    log.warn({ email, action: "forgot-password" }, "Rate limit exceeded");

    // IMPORTANT: Always return success to prevent email enumeration
    return ok(undefined);
  }

  // ... existing password reset logic
}
```

**Why Email-Based (Not IP-Based)?**
- Protects specific user's inbox from bombing
- Prevents email enumeration through rate limit differences
- More precise protection

**Why Return Success When Rate Limited?**
- Prevents email enumeration attack
- Attacker can't tell if email exists by hitting rate limit
- Consistent with existing email enumeration protection

## Alternative: Progressive Delays

Instead of hard rate limit, add increasing delays:

```typescript
const requestCount = await getPasswordResetCount(email);

if (requestCount > 0) {
  // Exponential backoff: 5s, 10s, 20s, 40s, etc.
  const delay = Math.min(5000 * Math.pow(2, requestCount - 1), 60000);
  await new Promise(resolve => setTimeout(resolve, delay));
}

// Continue with password reset...
```

**Pros:**
- Softer user experience (no hard block)
- Still slows down attacks significantly

**Cons:**
- Doesn't completely prevent email bombing
- More complex logic

## Acceptance Criteria

- [ ] Rate limiting implemented on `forgotPasswordAction`
- [ ] Rate limit set to 3 requests per email per hour
- [ ] Always returns success (no email enumeration)
- [ ] Rate limit logged but not exposed to user
- [ ] Legitimate users can still reset password
- [ ] Testing confirms email enumeration protection maintained

## Testing

1. **Test Rate Limiting:**
   - Request password reset 4 times for same email → all show success
   - Check logs → verify 4th request was rate limited
   - Check email inbox → verify only 3 emails received
   - Wait 1 hour → verify reset works again

2. **Test Email Enumeration Protection:**
   - Request reset for non-existent email → shows success
   - Request reset for existing email → shows success
   - Responses should be identical (timing and message)

3. **Test Legitimate User:**
   - First password reset → should work
   - Second reset (typo in email) → should work
   - Third reset → should work
   - Fourth within hour → rate limited but user doesn't know (shows success)

## Files to Modify

- `src/app/(auth)/actions.ts` (add rate limiting to `forgotPasswordAction`)
- `.env.example` (Upstash env vars already documented)

## Environment Variables

Reuse same Upstash Redis instance:
```bash
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

## Security Considerations

**CRITICAL: Maintain Email Enumeration Protection**

Current code prevents email enumeration by always returning success:
```typescript
// Always show success message even if email doesn't exist
// This prevents email enumeration attacks
return ok(undefined);
```

This behavior MUST be maintained even with rate limiting. The rate limit should be:
- Applied before sending email
- Logged server-side only
- Never revealed to user
- Same success response whether rate limited or not

## Labels

`security`, `priority: medium`, `enhancement`
