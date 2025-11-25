# [P1] Add Signup Rate Limiting

**Priority:** P1 - High
**Effort:** 1-2 hours
**Parent Issue:** Security Review Main Issue

## Problem

The signup endpoint has **NO rate limiting**, allowing unlimited account creation.

**Attack Scenario:**
1. Attacker writes script to create thousands of spam accounts
2. Database fills with fake user profiles
3. Email quota exhausted (if email verification enabled)
4. Supabase auth quota exhausted
5. Legitimate users affected by performance degradation

**Current Code:**
```typescript
// src/app/(auth)/actions.ts:95
export async function signupAction(formData: FormData): Promise<SignupResult> {
  // ❌ NO rate limiting - unlimited signups
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  // ...
}
```

**Impact:**
- Database pollution with spam accounts
- Resource exhaustion
- Email quota abuse
- Supabase auth quota exhaustion

**Reference:** Section 7.2 of [SECURITY_REVIEW_2025-11-25.md](https://github.com/timothyfroehlich/PinPoint/blob/claude/security-review-codebase-011jfKFnKjKcqTDdG5njh7kQ/SECURITY_REVIEW_2025-11-25.md)

## Recommended Solution

IP-based rate limiting with stricter limits than login:

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";

const signupRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(3, "1 h"), // 3 signups per IP per hour
});

export async function signupAction(formData: FormData): Promise<SignupResult> {
  // Get IP address
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for") ?? "unknown";

  // Check rate limit
  const { success, remaining, reset } = await signupRatelimit.limit(ip);

  if (!success) {
    const resetTime = new Date(reset).toLocaleTimeString();
    return err(
      "VALIDATION",
      `Too many signup attempts. Please try again after ${resetTime}.`,
      {}
    );
  }

  // ... existing signup logic
}
```

**Rate Limit Rationale:**
- **3 signups per hour per IP** is generous for legitimate users
- Legitimate use case: User makes typo in email, corrects it (2 signups)
- Blocks automated bot attacks effectively

## Additional Security Enhancements

### 1. Email Domain Validation (Recommended)

Block disposable/temporary email domains:

```typescript
const disposableDomains = [
  'tempmail.com',
  'guerrillamail.com',
  '10minutemail.com',
  // ... add more
];

const emailDomain = email.split('@')[1];
if (disposableDomains.includes(emailDomain)) {
  return err("VALIDATION", "Please use a permanent email address.", { email });
}
```

Or use a library:
```bash
npm install disposable-email-domains
```

```typescript
import disposableDomains from 'disposable-email-domains';

const emailDomain = email.split('@')[1];
if (disposableDomains.includes(emailDomain)) {
  return err("VALIDATION", "Disposable email addresses are not allowed.", { email });
}
```

### 2. Honeypot Field

Add hidden field that bots fill but humans don't:

```typescript
// In signup form:
<input type="text" name="website" style={{ display: 'none' }} autoComplete="off" />

// In Server Action:
const honeypot = formData.get("website");
if (honeypot) {
  // Bot detected, silently reject with fake success
  redirect("/signup/success");
}
```

### 3. CAPTCHA After Failures

Show CAPTCHA if signup attempt fails once:

```typescript
// After first failed signup, require CAPTCHA
const hasFailedBefore = cookies.get('signup_failed');

if (hasFailedBefore) {
  const captchaToken = formData.get("captcha-token");
  const isValid = await verifyCaptcha(captchaToken);

  if (!isValid) {
    return err("VALIDATION", "Please complete the CAPTCHA verification.", {});
  }
}
```

## Acceptance Criteria

- [ ] Rate limiting implemented on `signupAction`
- [ ] Rate limit set to 3 signups per IP per hour
- [ ] User-friendly error message when rate limit exceeded
- [ ] Error message shows when they can retry
- [ ] Honeypot field added to signup form (optional but recommended)
- [ ] Rate limiting tested with automated signups
- [ ] Legitimate users not affected

## Testing

1. **Test Rate Limiting:**
   - Create 4 accounts from same IP rapidly → expect 4th to be blocked
   - Wait 1 hour → expect signup to work again
   - Try from different IP → expect separate rate limit

2. **Test Honeypot (if implemented):**
   - Fill honeypot field → expect silent rejection
   - Don't fill honeypot → expect normal signup flow

3. **Test Legitimate User:**
   - Successful signup on first try → should work
   - Typo in email, retry with correct email → should work (under limit)

## Files to Modify

- `src/app/(auth)/actions.ts` (add rate limiting to `signupAction`)
- `src/app/(auth)/signup/page.tsx` (add honeypot field if implementing)
- `.env.example` (Upstash env vars already documented from login rate limiting)

## Environment Variables

Reuse same Upstash Redis instance from login rate limiting:
```bash
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

## Labels

`security`, `priority: high`, `enhancement`
