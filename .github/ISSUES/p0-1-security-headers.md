# [P0] Add Security Headers (CSP, HSTS, X-Frame-Options)

**Priority:** P0 - Critical (Production Blocker)
**Effort:** ~30 minutes
**Parent Issue:** Security Review Main Issue

## Problem

The application is missing critical security headers that provide defense-in-depth protection against common web attacks:

- ❌ No Content-Security-Policy (CSP)
- ❌ No Strict-Transport-Security (HSTS)
- ❌ No X-Frame-Options (clickjacking protection)
- ❌ No X-Content-Type-Options (MIME-sniffing protection)
- ❌ No Referrer-Policy
- ❌ No Permissions-Policy

**Impact:**
- No defense-in-depth against XSS attacks
- No clickjacking protection
- No HTTPS enforcement
- No MIME-sniffing protection

**Reference:** Section 3.2 of [SECURITY_REVIEW_2025-11-25.md](https://github.com/timothyfroehlich/PinPoint/blob/claude/security-review-codebase-011jfKFnKjKcqTDdG5njh7kQ/SECURITY_REVIEW_2025-11-25.md)

## Solution

Add security headers to `next.config.ts`:

```typescript
const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://*.supabase.co;",
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};
```

## Acceptance Criteria

- [ ] Security headers added to `next.config.ts`
- [ ] CSP header allows Supabase connections
- [ ] HSTS header enforces HTTPS with long max-age
- [ ] X-Frame-Options prevents clickjacking
- [ ] Headers verified in production/staging deployment
- [ ] No console errors related to CSP violations

## Testing

1. Deploy to staging
2. Open browser DevTools → Network tab
3. Check response headers for security headers
4. Verify no CSP violations in console
5. Test all functionality still works (especially Supabase auth)

## Files to Modify

- `next.config.ts` (add headers() function)

## Labels

`security`, `priority: critical`, `good first issue`
