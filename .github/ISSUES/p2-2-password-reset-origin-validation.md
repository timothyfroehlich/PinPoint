# [P2] Strengthen Password Reset Origin Validation

**Priority:** P2 - Medium
**Effort:** 30 minutes
**Parent Issue:** Security Review Main Issue

## Problem

Password reset origin validation uses a **fallback chain** that could be manipulated via headers.

**Current Code:**
```typescript
// src/app/(auth)/actions.ts:357-370
const headersList = await headers();
const protocol =
  headersList.get("x-forwarded-proto") ??
  headersList.get("origin")?.split("://")[0] ??
  "http";
const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
const fallback =
  headersList.get("referer")?.split("/").slice(0, 3).join("/") ??
  `http://localhost:${process.env["PORT"] ?? "3000"}`;
const siteUrl = process.env["NEXT_PUBLIC_SITE_URL"];
const origin =
  (typeof siteUrl === "string" && siteUrl.length > 0
    ? siteUrl
    : undefined) ?? (host ? `${protocol}://${host}` : fallback);
```

**Vulnerability:**
If `NEXT_PUBLIC_SITE_URL` is not set, the code falls back to headers that an attacker could manipulate:
- `x-forwarded-proto`
- `x-forwarded-host`
- `host`
- `referer`

**Host Header Injection Risk:**
1. Attacker sends password reset request with manipulated headers
2. If `NEXT_PUBLIC_SITE_URL` not set, fallback uses attacker's headers
3. Password reset email contains link to attacker-controlled domain
4. User clicks link, sends reset token to attacker

**Reference:** Section 1.2 (Medium Issue #1) of [SECURITY_REVIEW_2025-11-25.md](https://github.com/timothyfroehlich/PinPoint/blob/claude/security-review-codebase-011jfKFnKjKcqTDdG5njh7kQ/SECURITY_REVIEW_2025-11-25.md)

**Positive:** Allowlist validation is present (lines 372-387), which mitigates the risk. However, the fallback chain is still unnecessarily complex.

## Recommended Solution

**Fail closed** instead of using fallback:

```typescript
export async function forgotPasswordAction(
  formData: FormData
): Promise<ForgotPasswordResult> {
  // ... validation ...

  // CHANGED: Fail closed if NEXT_PUBLIC_SITE_URL not configured
  const siteUrl = process.env["NEXT_PUBLIC_SITE_URL"];

  if (!siteUrl) {
    log.error(
      { action: "forgot-password" },
      "NEXT_PUBLIC_SITE_URL not configured - cannot send password reset email"
    );
    return err("SERVER", "Configuration error. Please contact support.");
  }

  const origin = siteUrl; // No fallback, fail if not configured

  // Validate origin against allowlist (keep existing validation)
  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3100",
    "http://localhost:3200",
    "http://localhost:3300",
    siteUrl,
  ].filter((url): url is string => typeof url === "string" && url.length > 0);

  if (!allowedOrigins.some((allowed) => origin.startsWith(allowed))) {
    log.warn(
      { origin, action: "forgot-password" },
      "Invalid origin detected for password reset"
    );
    return err("SERVER", "Invalid origin for password reset");
  }

  // ... rest of password reset logic
}
```

**Benefits:**
- No fallback to potentially manipulated headers
- Clear error if misconfigured (fail fast)
- Simpler code (less complex logic)
- Explicit dependency on `NEXT_PUBLIC_SITE_URL`

## Alternative: Enhanced Validation

If fallback is needed for development, validate it strictly:

```typescript
const headersList = await headers();
const siteUrl = process.env["NEXT_PUBLIC_SITE_URL"];

let origin: string;

if (siteUrl) {
  // Production: use configured site URL
  origin = siteUrl;
} else {
  // Development: use localhost only (no header fallback)
  const port = process.env["PORT"] ?? "3000";
  origin = `http://localhost:${port}`;

  log.warn(
    { action: "forgot-password" },
    "NEXT_PUBLIC_SITE_URL not set, using localhost fallback (development only)"
  );
}
```

**Benefits:**
- Works in development without configuration
- No header manipulation risk
- Clear separation of production vs development behavior

## Acceptance Criteria

- [ ] Password reset origin validation simplified
- [ ] No fallback to `x-forwarded-host`, `host`, or `referer` headers
- [ ] `NEXT_PUBLIC_SITE_URL` required in production
- [ ] Clear error if `NEXT_PUBLIC_SITE_URL` not set
- [ ] Allowlist validation retained
- [ ] Testing confirms password reset works in all environments
- [ ] Documentation updated in `.env.example`

## Testing

1. **Test with NEXT_PUBLIC_SITE_URL set:**
   - Request password reset → should work
   - Verify email contains correct origin URL

2. **Test without NEXT_PUBLIC_SITE_URL (production):**
   - Request password reset → should fail with clear error
   - No email sent

3. **Test with manipulated headers:**
   - Send request with `Host: evil.com`
   - Verify password reset fails validation
   - No email sent to attacker domain

4. **Test development mode:**
   - Without NEXT_PUBLIC_SITE_URL in dev → should use localhost fallback
   - Verify email contains `http://localhost:3000` URL

## Files to Modify

- `src/app/(auth)/actions.ts` (simplify origin validation in `forgotPasswordAction`)
- `.env.example` (clarify that NEXT_PUBLIC_SITE_URL is required in production)

## Documentation Update

Update `.env.example`:
```bash
# Site URL (REQUIRED in production for password reset emails)
NEXT_PUBLIC_SITE_URL=https://pinpoint.yourdomain.com
```

## Deployment Checklist

Add to deployment docs:
- [ ] Verify `NEXT_PUBLIC_SITE_URL` is set in production environment
- [ ] Verify `NEXT_PUBLIC_SITE_URL` matches actual production domain
- [ ] Test password reset email in production to confirm correct URL

## Labels

`security`, `priority: medium`, `refactoring`
