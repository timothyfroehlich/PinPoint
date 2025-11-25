# [P1] Add Login Rate Limiting / Brute Force Protection

**Priority:** P1 - High
**Effort:** 2-3 hours
**Parent Issue:** Security Review Main Issue

## Problem

The login endpoint has **NO rate limiting or brute force protection**.

**Attack Scenario:**
1. Attacker obtains list of email addresses (e.g., from data breach)
2. Attacker writes script to try common passwords against each email
3. Script tries thousands of password combinations per minute
4. Eventually finds weak passwords and compromises accounts

**Current Code:**
```typescript
// src/app/(auth)/actions.ts:43
export async function loginAction(formData: FormData): Promise<LoginResult> {
  // ❌ NO rate limiting - unlimited login attempts
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  // ...
}
```

**Impact:**
- Account compromise through brute force attacks
- Credential stuffing attacks
- Resource exhaustion (database connections)
- Supabase auth quota exhaustion

**Reference:** Section 7.1 of [SECURITY_REVIEW_2025-11-25.md](https://github.com/timothyfroehlich/PinPoint/blob/claude/security-review-codebase-011jfKFnKjKcqTDdG5njh7kQ/SECURITY_REVIEW_2025-11-25.md)

## Recommended Solutions

### Option 1: IP-Based Rate Limiting (Recommended for MVP)

Throttle login attempts per IP address:

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";

const loginRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "15 m"), // 5 attempts per 15 minutes
});

export async function loginAction(formData: FormData): Promise<LoginResult> {
  // Get IP address
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for") ?? "unknown";

  // Check rate limit
  const { success, remaining } = await loginRatelimit.limit(ip);

  if (!success) {
    return err(
      "AUTH",
      `Too many login attempts. Please try again in 15 minutes. (${remaining} attempts remaining)`
    );
  }

  // ... existing login logic
}
```

**Pros:**
- Simple to implement
- Immediate protection
- Works with existing error handling

**Cons:**
- Shared IP addresses (corporate NAT) could affect multiple users
- Can be bypassed with VPN/proxy rotation (but raises barrier)

### Option 2: Account-Based Rate Limiting

Throttle attempts per email address:

```typescript
const loginRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.fixedWindow(5, "15 m"), // 5 attempts per email per 15 min
});

export async function loginAction(formData: FormData): Promise<LoginResult> {
  const email = String(formData.get("email")).toLowerCase();

  // Check rate limit by email
  const { success } = await loginRatelimit.limit(`login:${email}`);

  if (!success) {
    return err("AUTH", "Too many login attempts for this account. Please try again in 15 minutes.");
  }

  // ... existing login logic
}
```

**Pros:**
- More precise (targets specific accounts)
- Doesn't affect shared IPs
- Can detect targeted attacks on specific accounts

**Cons:**
- Attacker can probe if email exists (email enumeration)
- Doesn't protect against distributed attacks on different accounts

### Option 3: Combined Approach (Best Security)

Use BOTH IP-based AND account-based rate limiting:

```typescript
export async function loginAction(formData: FormData): Promise<LoginResult> {
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for") ?? "unknown";
  const email = String(formData.get("email")).toLowerCase();

  // Check IP rate limit (10 attempts per IP per 15 min)
  const ipLimit = await ipRatelimit.limit(ip);
  if (!ipLimit.success) {
    return err("AUTH", "Too many login attempts. Please try again later.");
  }

  // Check account rate limit (5 attempts per email per 15 min)
  const accountLimit = await accountRatelimit.limit(`login:${email}`);
  if (!accountLimit.success) {
    return err("AUTH", "Too many login attempts for this account. Please try again in 15 minutes.");
  }

  // ... existing login logic
}
```

**Pros:**
- Defense-in-depth
- Protects against both distributed and targeted attacks
- Industry best practice

**Cons:**
- Slightly more complex
- Requires two Redis calls (but still fast)

### Option 4: Account Lockout (Traditional Approach)

Lock account after N failed attempts (stored in database):

```typescript
// After failed login:
await db.insert(loginAttempts).values({
  email,
  attemptedAt: new Date(),
  success: false,
});

// Count recent failures
const recentFailures = await db.query.loginAttempts.count({
  where: and(
    eq(loginAttempts.email, email),
    eq(loginAttempts.success, false),
    gte(loginAttempts.attemptedAt, new Date(Date.now() - 15 * 60 * 1000))
  )
});

if (recentFailures >= 5) {
  return err("AUTH", "Account locked due to too many failed login attempts. Please reset your password.");
}
```

**Pros:**
- No external dependencies
- Persistent across server restarts
- Clear audit trail

**Cons:**
- Requires database schema changes
- Slower than Redis
- Account lockout can be weaponized (lock out legitimate users)

## Recommended Approach

**Option 3 (Combined IP + Account Rate Limiting)** for production security

**OR**

**Option 1 (IP-Based Only)** for MVP if time is limited

## Additional Security Enhancements

### 1. Progressive Delays (Recommended)

Add increasing delay after failed attempts:

```typescript
const failureCount = await getFailureCount(email);

if (failureCount > 0) {
  // Exponential backoff: 1s, 2s, 4s, 8s, etc.
  const delay = Math.min(Math.pow(2, failureCount) * 1000, 30000);
  await new Promise(resolve => setTimeout(resolve, delay));
}
```

### 2. CAPTCHA After Failures

Show CAPTCHA after 3 failed attempts:

```typescript
const failureCount = await getFailureCount(email);

if (failureCount >= 3) {
  const captchaToken = formData.get("captcha-token");
  const isValid = await verifyCaptcha(captchaToken);

  if (!isValid) {
    return err("AUTH", "Please complete the CAPTCHA verification.");
  }
}
```

### 3. Notification on Lockout

Email user when their account is being attacked:

```typescript
if (failureCount === 5) {
  await sendEmail({
    to: email,
    subject: "Security Alert: Multiple Failed Login Attempts",
    body: "We detected multiple failed login attempts on your account...",
  });
}
```

## Acceptance Criteria

- [ ] Rate limiting implemented on `loginAction`
- [ ] Rate limit set to reasonable value (5-10 attempts per 15 minutes)
- [ ] User-friendly error message when rate limit exceeded
- [ ] Error message includes time until retry allowed
- [ ] Rate limiting tested with automated login attempts
- [ ] Legitimate users not affected by rate limiting
- [ ] Environment variables documented

## Testing

1. **Test IP Rate Limiting:**
   - Make 6 login attempts from same IP → expect 6th to be blocked
   - Wait 15 minutes → expect login to work again
   - Try from different IP → expect separate rate limit

2. **Test Account Rate Limiting:**
   - Make 6 attempts with same email → expect 6th to be blocked
   - Try different email from same IP → expect separate rate limit

3. **Test Legitimate User:**
   - Successful login on first try → should work
   - Failed login then success → should work
   - Multiple failures then correct password → should work (if under limit)

## Files to Modify

- `src/app/(auth)/actions.ts` (add rate limiting to `loginAction`)
- `.env.example` (document Upstash env vars)
- `package.json` (add @upstash/ratelimit and @upstash/redis if needed)

## Environment Variables

```bash
# Upstash Redis for Rate Limiting
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

## Labels

`security`, `priority: high`, `enhancement`
