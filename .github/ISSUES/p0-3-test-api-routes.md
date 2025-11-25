# [P0] Protect Test API Routes with Authentication

**Priority:** P0 - Critical (Staging/Preview Blocker)
**Effort:** ~30 minutes
**Parent Issue:** Security Review Main Issue

## Problem

Test API routes are exposed in non-production environments without authentication:

**Affected Routes:**
- `/api/test-data/cleanup` (POST) - Deletes issues and machines
- `/api/test-setup` (GET) - Database connectivity test

**Current Protection:**
```typescript
// Only checks NODE_ENV, no authentication
if (process.env.NODE_ENV === "production") {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

**Vulnerability:**
- In staging/preview deployments, these endpoints allow ANYONE to:
  - Delete arbitrary issues and machines (`/api/test-data/cleanup`)
  - Query database health (`/api/test-setup`)
- Preview deployments on Vercel/similar platforms may have different environment configurations

**Impact:**
- Data destruction attacks in staging
- Resource exhaustion
- Information disclosure (database errors in `/api/test-setup`)

**Reference:** Section 1.1 (Critical Issue #1) of [SECURITY_REVIEW_2025-11-25.md](https://github.com/timothyfroehlich/PinPoint/blob/claude/security-review-codebase-011jfKFnKjKcqTDdG5njh7kQ/SECURITY_REVIEW_2025-11-25.md)

## Recommended Solutions

### Option 1: Add Authentication Check (Recommended)

Add Supabase auth + environment check:

```typescript
export async function POST(request: Request): Promise<Response> {
  // Keep production check
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ADD: Authentication check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Optional: Check for admin role
  const userProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true }
  });

  if (userProfile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 });
  }

  // ... rest of logic
}
```

**Pros:**
- Uses existing auth system
- Can restrict to admin users only
- Clear audit trail (know who triggered cleanup)

**Cons:**
- Requires authentication setup in test environment

### Option 2: Environment Variable Gate

Use stricter environment variable:

```typescript
export async function POST(request: Request): Promise<Response> {
  // Only allow if explicitly enabled
  if (!process.env.ALLOW_TEST_ROUTES) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ... rest of logic
}
```

Add to `.env.local` (development only):
```bash
ALLOW_TEST_ROUTES=true
```

**Pros:**
- Very simple
- No dependencies
- Fail-safe (disabled by default)

**Cons:**
- No audit trail
- Anyone with environment access can enable

### Option 3: API Key Protection

Require secret API key:

```typescript
export async function POST(request: Request): Promise<Response> {
  const apiKey = request.headers.get("x-api-key");

  if (apiKey !== process.env.TEST_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ... rest of logic
}
```

**Pros:**
- Simple to implement
- No auth dependency

**Cons:**
- Need to manage API keys
- Keys could leak in logs/history

## Recommended Approach

**Option 1 (Add Authentication) for `/api/test-data/cleanup`**
- High-risk endpoint (deletes data) should require authentication
- Restrict to admin role only

**Option 2 (Environment Gate) for `/api/test-setup`**
- Lower-risk endpoint (just health check)
- Simple environment variable is sufficient

## Acceptance Criteria

### For `/api/test-data/cleanup`:
- [ ] Requires authenticated user
- [ ] Optionally restricts to admin role only
- [ ] Returns 401 for unauthenticated requests
- [ ] Returns 403 for non-admin users (if role check implemented)
- [ ] Still blocked in production (keep existing check)

### For `/api/test-setup`:
- [ ] Requires `ALLOW_TEST_ROUTES=true` environment variable
- [ ] Disabled by default (env var not set)
- [ ] Returns 403 when disabled

## Testing

### Test `/api/test-data/cleanup`:
1. Try POST request without authentication → expect 401
2. Authenticate as member user → expect 403 (if role check added)
3. Authenticate as admin user → expect 200
4. Set NODE_ENV=production → expect 403 (even for admin)

### Test `/api/test-setup`:
1. Without `ALLOW_TEST_ROUTES` env var → expect 403
2. With `ALLOW_TEST_ROUTES=true` → expect 200
3. Set NODE_ENV=production → expect 403

## Files to Modify

- `src/app/api/test-data/cleanup/route.ts`
- `src/app/api/test-setup/route.ts`
- `.env.example` (document ALLOW_TEST_ROUTES)

## Environment Variables

Add to `.env.example`:
```bash
# Test API Routes (development only - DO NOT enable in production)
ALLOW_TEST_ROUTES=true
```

## Labels

`security`, `priority: critical`, `good first issue`
