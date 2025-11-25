# [P0] Implement Rate Limiting on Public Issue Form

**Priority:** P0 - Critical (Production Blocker)
**Effort:** 2-4 hours
**Parent Issue:** Security Review Main Issue

## Problem

The public issue submission form at `/report` has **NO rate limiting**, allowing unlimited anonymous submissions.

**Explicitly noted in code:**
```typescript
// src/app/report/actions.ts:24
// NOTE: Consider adding rate limiting if the form is abused.
```

**Attack Scenario:**
1. Attacker discovers public report form at `/report`
2. Attacker writes script to submit thousands of spam issues
3. Database fills with junk data
4. Legitimate users can't find real issues
5. System performance degrades

**Impact:**
- Database flooding via automated submissions
- Spam issues polluting the issue tracker
- Resource exhaustion (database connections, storage)
- Denial of service through legitimate feature abuse

**Reference:** Section 7.1 (Critical Issue #3) of [SECURITY_REVIEW_2025-11-25.md](https://github.com/timothyfroehlich/PinPoint/blob/claude/security-review-codebase-011jfKFnKjKcqTDdG5njh7kQ/SECURITY_REVIEW_2025-11-25.md)

## Recommended Solutions

### Option 1: IP-Based Rate Limiting (Recommended)

Use Upstash Redis + Ratelimit library:

```typescript
// Install: npm install @upstash/ratelimit @upstash/redis

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "15 m"), // 5 submissions per 15 minutes
});

export async function submitPublicIssueAction(formData: FormData): Promise<void> {
  // Get IP address
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for") ?? "unknown";

  // Check rate limit
  const { success } = await ratelimit.limit(ip);

  if (!success) {
    redirectWithError("Too many submissions. Please try again in 15 minutes.");
  }

  // ... rest of validation and submission logic
}
```

**Pros:**
- Simple to implement
- Low latency
- Works well for public forms
- Upstash has generous free tier

**Cons:**
- Requires Upstash account
- Can be bypassed with VPN/proxy rotation (but raises barrier)

### Option 2: CAPTCHA Protection

Use Cloudflare Turnstile (privacy-focused, free):

```typescript
// Add to form:
<Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />

// Verify in Server Action:
const token = formData.get("cf-turnstile-response");
const isValid = await verifyCaptcha(token);

if (!isValid) {
  redirectWithError("CAPTCHA verification failed. Please try again.");
}
```

**Pros:**
- Blocks bots effectively
- Privacy-focused
- Free tier available

**Cons:**
- Requires user interaction
- Additional service dependency

### Option 3: Honeypot Field (Lightweight)

Add hidden field that bots fill but humans don't:

```typescript
// Add to form:
<input type="text" name="website" style={{ display: 'none' }} />

// Check in Server Action:
const honeypot = formData.get("website");

if (honeypot) {
  // Bot detected, silently reject
  redirect("/report/success"); // Fake success to confuse bots
}
```

**Pros:**
- No external dependencies
- Zero user friction
- Very simple

**Cons:**
- Only catches dumb bots
- Can be bypassed by smart bots

## Recommended Approach

**Implement Option 1 (IP-based rate limiting) + Option 3 (Honeypot)**

This provides:
1. Strong protection against automated attacks
2. Zero user friction (rate limit is generous)
3. Defense-in-depth with honeypot as backup

## Acceptance Criteria

- [ ] Rate limiting implemented on `submitPublicIssueAction`
- [ ] Rate limit set to reasonable value (e.g., 5 submissions per 15 minutes per IP)
- [ ] User-friendly error message when rate limit exceeded
- [ ] Honeypot field added to form (optional but recommended)
- [ ] Rate limiting tested with automated requests
- [ ] Environment variables documented in `.env.example`

## Testing

1. Submit form 6 times rapidly from same IP
2. Verify 6th submission is blocked with clear error message
3. Wait 15 minutes, verify submission works again
4. Test from different IP, verify separate rate limit
5. Fill honeypot field, verify submission is silently rejected

## Files to Modify

- `src/app/report/actions.ts` (add rate limiting)
- `src/app/report/page.tsx` (add honeypot field if using Option 3)
- `.env.example` (document Upstash env vars if using Option 1)
- `package.json` (add dependencies if needed)

## Environment Variables

If using Upstash:
```bash
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

## Labels

`security`, `priority: critical`, `enhancement`
