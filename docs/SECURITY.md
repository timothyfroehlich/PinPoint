# PinPoint Security Headers

**Last Updated**: November 27, 2025

## Overview

PinPoint implements a defense-in-depth security strategy using HTTP security headers to protect against common web vulnerabilities. This document describes the security headers configuration, implementation details, and modification guidelines.

## Security Headers Configuration

### Static Headers (next.config.ts)

The following headers are set statically for all routes via `next.config.ts`:

| Header                      | Value                                          | Purpose                                                          |
| --------------------------- | ---------------------------------------------- | ---------------------------------------------------------------- |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Enforces HTTPS connections for 2 years, including all subdomains |
| `X-Frame-Options`           | `DENY`                                         | Prevents clickjacking by blocking iframe embedding               |
| `X-Content-Type-Options`    | `nosniff`                                      | Prevents MIME-sniffing attacks                                   |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`              | Controls referrer information sent with requests                 |
| `Permissions-Policy`        | `camera=(), microphone=(), geolocation=()`     | Disables unnecessary browser features                            |

### Dynamic Headers (middleware.ts)

Content-Security-Policy (CSP) is set dynamically in middleware to support nonce-based script execution:

#### Content-Security-Policy Directives

| Directive                   | Value                                               | Purpose                                                                                      |
| --------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `default-src`               | `'self'`                                            | Default policy: only load resources from same origin                                         |
| `script-src`                | `'self' 'nonce-{random}' 'strict-dynamic'`          | Scripts: same origin or with valid nonce. 'strict-dynamic' allows dynamically loaded scripts |
| `style-src`                 | `'self' 'unsafe-inline'`                            | Styles: same origin or inline (for CSS-in-JS compatibility)                                  |
| `img-src`                   | `'self' data: blob:`                                | Images: same origin, data URIs, or blob URLs                                                 |
| `font-src`                  | `'self' data:`                                      | Fonts: same origin or data URIs                                                              |
| `connect-src`               | `'self' {supabase-url} {supabase-ws-url} localhost` | Network requests: same origin, Supabase, and local development                               |
| `object-src`                | `'none'`                                            | No plugins (Flash, Java, etc.)                                                               |
| `base-uri`                  | `'self'`                                            | Restricts `<base>` tag URLs                                                                  |
| `form-action`               | `'self'`                                            | Forms can only submit to same origin                                                         |
| `frame-ancestors`           | `'none'`                                            | Cannot be embedded in any frame (stricter than X-Frame-Options)                              |
| `block-all-mixed-content`   | -                                                   | Blocks HTTP content on HTTPS pages                                                           |
| `upgrade-insecure-requests` | -                                                   | Upgrades HTTP requests to HTTPS                                                              |

## Implementation Details

### Nonce-Based CSP

PinPoint uses nonce-based Content-Security-Policy instead of `'unsafe-inline'` and `'unsafe-eval'` for enhanced security:

1. **Nonce Generation**: A unique cryptographic nonce (UUID) is generated for each request in `middleware.ts`
2. **Header Injection**: The nonce is injected into the CSP header as `'nonce-{uuid}'`
3. **x-nonce Header**: The nonce is exposed via `x-nonce` response header for use in Server Components
4. **Script Execution**: Only scripts with matching nonce attributes can execute

**Example Script Tag (future implementation)**:

```tsx
// In a Server Component
export default async function Page() {
  const nonce = headers().get("x-nonce");

  return (
    <Script nonce={nonce}>console.log('This script will execute');</Script>
  );
}
```

### Supabase Integration

The CSP is configured to work with Supabase authentication and real-time features:

- **HTTPS**: `https://{project-id}.supabase.co` for API requests
- **WebSocket**: `wss://{project-id}.supabase.co` for Realtime subscriptions
- **No Wildcards**: Uses specific project URL from `NEXT_PUBLIC_SUPABASE_URL` instead of `*.supabase.co`

### Local Development

CSP allows local connections for development:

- `http://127.0.0.1:*` and `ws://127.0.0.1:*`
- `http://localhost:*` and `ws://localhost:*`

## Current Limitations

### style-src 'unsafe-inline'

The CSP currently includes `'unsafe-inline'` for `style-src` to maintain compatibility with:

- CSS-in-JS libraries (if used in future)
- Inline styles in third-party components
- Server-rendered styles from Next.js

**Future Improvement**: Once nonce support is tested with all components, migrate to nonce-based styles:

```
style-src 'self' 'nonce-{random}';
```

### script-src 'strict-dynamic'

The `'strict-dynamic'` directive allows scripts loaded by nonce'd scripts to execute without their own nonce. This is necessary for:

- Next.js dynamic imports
- Third-party scripts loaded by trusted code
- Client-side routing and code splitting

**Trade-off**: Slightly relaxes CSP but required for modern JavaScript frameworks. The initial script must still have a valid nonce.

## Modifying CSP

### Adding External Resources

If you need to add external resources (CDNs, analytics, etc.), update the appropriate directive in `middleware.ts`:

**Example: Adding Google Fonts**

```typescript
const cspHeader = `
  ...
  font-src 'self' data: https://fonts.gstatic.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  ...
`;
```

**Example: Adding Vercel Analytics**

```typescript
const cspHeader = `
  ...
  script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://va.vercel-scripts.com;
  connect-src 'self' ${supabaseUrl} ${supabaseWsUrl} https://va.vercel-scripts.com;
  ...
`;
```

### Testing CSP Changes

1. **Check Browser Console**: CSP violations appear as console errors
2. **Review Network Tab**: Blocked requests show "blocked:csp" status
3. **Test User Flows**: Verify auth, forms, and dynamic features work
4. **Use CSP Evaluator**: https://csp-evaluator.withgoogle.com/

### Manual Testing on Staging/Production

**Prerequisites:**

- Deployment to staging environment (e.g., Vercel preview)
- Browser DevTools (Chrome, Firefox, or Safari)

**Test Procedure:**

1. **Open DevTools** → Navigate to **Network** tab
2. **Load the application** → Navigate to any page
3. **Inspect Response Headers**:
   - Click on the document request (first item in Network tab)
   - Go to **Headers** tab
   - Scroll to **Response Headers** section

**Verify Headers Present:**

```
✅ strict-transport-security: max-age=63072000; includeSubDomains; preload
✅ x-frame-options: DENY
✅ x-content-type-options: nosniff
✅ referrer-policy: strict-origin-when-cross-origin
✅ permissions-policy: camera=(), microphone=(), geolocation=()
✅ content-security-policy: default-src 'self'; script-src 'self' 'nonce-...' 'strict-dynamic'; ...
✅ x-nonce: <uuid>
```

**Verify CSP Directives:**

Check that `content-security-policy` contains:

- `default-src 'self'`
- `script-src 'self' 'nonce-<random-uuid>' 'strict-dynamic'`
- `style-src 'self' 'unsafe-inline'`
- `img-src 'self' data: blob:`
- `connect-src 'self' https://<project>.supabase.co wss://<project>.supabase.co`
- `object-src 'none'`
- `frame-ancestors 'none'`

**Verify Nonce:**

1. **Copy nonce value** from `x-nonce` header (e.g., `a1b2c3d4-e5f6-...`)
2. **Open Console** tab
3. **Run test script**:

   ```javascript
   // This should FAIL (no nonce)
   const scriptFail = document.createElement("script");
   scriptFail.textContent = 'console.log("BLOCKED");';
   document.body.appendChild(scriptFail);

   // Check console for CSP violation error
   ```

4. **Expected Result**: Console shows CSP violation error

**Verify User Flows Work:**

- ✅ Authentication (login/logout)
- ✅ Form submissions
- ✅ Navigation between pages
- ✅ Supabase realtime connections (if implemented)

**Common Issues:**

| Symptom                   | Likely Cause           | Fix                               |
| ------------------------- | ---------------------- | --------------------------------- |
| CSP header missing        | Middleware not running | Check middleware matcher config   |
| Nonce header missing      | Middleware error       | Check server logs                 |
| White screen              | CSP blocking scripts   | Check console for violations      |
| Supabase connection fails | Wrong connect-src URL  | Verify `NEXT_PUBLIC_SUPABASE_URL` |

### CSP Reporting (Future)

To monitor CSP violations in production, add a `report-uri` or `report-to` directive:

```typescript
const cspHeader = `
  ...
  report-uri /api/csp-report;
`;
```

Then implement the endpoint to log violations.

## Security Best Practices

1. **Never use 'unsafe-eval'**: Allows arbitrary code execution
2. **Minimize 'unsafe-inline'**: Use nonces or hashes instead
3. **Avoid wildcards**: Be specific with allowed origins
4. **Test thoroughly**: CSP can break legitimate functionality
5. **Monitor violations**: Set up CSP reporting in production
6. **Keep updated**: Review and tighten CSP as codebase evolves

## Threat Model

### Protected Against

- **XSS (Cross-Site Scripting)**: Nonce-based CSP prevents unauthorized script execution
- **Clickjacking**: X-Frame-Options and frame-ancestors prevent iframe embedding
- **MIME Sniffing**: X-Content-Type-Options prevents content type confusion
- **Protocol Downgrade**: HSTS enforces HTTPS
- **Mixed Content**: CSP blocks HTTP resources on HTTPS pages

### Not Protected Against

- **CSRF**: Requires additional token-based protection (not yet implemented)
- **SQL Injection**: Prevented by Drizzle ORM parameterization (separate concern)
- **Rate Limiting**: Not yet implemented
- **DDoS**: Requires infrastructure-level protection

## References

- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [MDN Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Next.js Security Headers](https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy)
- [web.dev CSP Guide](https://web.dev/articles/csp)

## Related Documentation

- `middleware.ts` - CSP implementation
- `next.config.ts` - Static security headers
- `docs/NON_NEGOTIABLES.md` - Security requirements
- `docs/TECH_SPEC.md` - Architecture security considerations
