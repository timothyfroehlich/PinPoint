# API Security Guidelines

**Last Updated**: 2025-07-22  
**Status**: Current  
**Purpose**: Document security best practices for PinPoint's tRPC-first architecture

## Overview

This document outlines security guidelines, patterns, and best practices for PinPoint's API layer. It covers both tRPC procedures and the limited HTTP API routes, with a focus on authentication, authorization, and data protection.

## Core Security Principles

### 1. Default Deny

- All endpoints require explicit authentication unless marked as public
- All data access requires explicit permission checks
- Unknown requests are rejected, not forwarded

### 2. Defense in Depth

- Multiple layers of security checks
- Database-level row security via Prisma extensions
- Application-level permission checks
- Network-level CSRF protection

### 3. Least Privilege

- Users only get permissions they need
- Services run with minimal required access
- Development tools disabled in production

## tRPC Security

### Procedure Security Levels

#### 1. Public Procedures

```typescript
// Use sparingly - only for truly public data
export const publicRouter = createTRPCRouter({
  getPublicStats: publicProcedure.query(async () => {
    // No auth required, but still validate inputs
    return { totalOrganizations: 42 };
  }),
});
```

**Guidelines**:

- Minimize public procedures
- Never expose sensitive data
- Rate limit public endpoints
- Log access for monitoring

#### 2. Protected Procedures

```typescript
// Requires authentication but not organization membership
export const userRouter = createTRPCRouter({
  updateProfile: protectedProcedure
    .input(updateProfileSchema)
    .mutation(async ({ ctx, input }) => {
      // ctx.session guaranteed to exist
      return updateUser(ctx.session.user.id, input);
    }),
});
```

**Guidelines**:

- Verify user owns the resource
- Check cross-tenant access
- Validate all inputs with Zod
- Audit sensitive operations

#### 3. Organization Procedures

```typescript
// Requires authentication + organization membership + permissions
export const issueRouter = createTRPCRouter({
  create: organizationProcedure
    .requiresPermission("issue:create_full")
    .input(createIssueSchema)
    .mutation(async ({ ctx, input }) => {
      // ctx.organization and permissions verified
      return createIssue(ctx.organization.id, input);
    }),
});
```

**Guidelines**:

- Always use for tenant data
- Specify required permissions
- Let middleware handle auth
- Trust the context

### Input Validation

**Always validate with Zod schemas**:

```typescript
const createIssueSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  machineId: z.string().uuid(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
});
```

**Best Practices**:

- Define strict schemas
- Set reasonable limits
- Validate UUIDs and enums
- Sanitize HTML content
- Reject unknown fields

### Error Handling

**Don't expose internal details**:

```typescript
// ❌ Bad - Exposes internal structure
throw new Error(`Database error: ${err.message}`);

// ✅ Good - Generic user-facing error
throw new TRPCError({
  code: "INTERNAL_SERVER_ERROR",
  message: "Failed to create issue",
});
```

**Error Codes**:

- `UNAUTHORIZED` - Not authenticated
- `FORBIDDEN` - Not authorized
- `NOT_FOUND` - Resource doesn't exist
- `BAD_REQUEST` - Invalid input
- `INTERNAL_SERVER_ERROR` - Server error

## Permission System

### Permission Naming Convention

Format: `resource:action`

Examples:

- `issue:view` - View issues
- `issue:create_full` - Create issues
- `issue:edit` - Edit issues
- `issue:delete` - Delete issues
- `machine:manage` - All machine operations
- `organization:admin` - Organization settings

### Permission Checks

#### Application Level

```typescript
// Automatic check via middleware
.requiresPermission("issue:edit")

// Manual check in procedure
if (!ctx.permissions.includes("issue:edit")) {
  throw new TRPCError({ code: "FORBIDDEN" });
}
```

#### UI Level

```tsx
// Use PermissionGate component
<PermissionGate permission="issue:delete">
  <DeleteButton />
</PermissionGate>

// Use PermissionButton
<PermissionButton
  permission="issue:edit"
  onClick={handleEdit}
>
  Edit Issue
</PermissionButton>
```

### Multi-Tenancy Security

**Row-Level Security via Prisma**:

```typescript
// Automatic filtering by organizationId
const issues = await ctx.db.issue.findMany();
// Only returns issues for ctx.organization.id
```

**Cross-Tenant Protection**:

1. Prisma extension adds organizationId filter
2. Middleware validates organization context
3. Procedures check resource ownership
4. UI hides cross-tenant links

## HTTP API Security

### Authentication Routes

- Handled by NextAuth.js
- CSRF protection built-in
- Session cookies httpOnly + secure
- OAuth state validation

### Health Check

```typescript
// Minimal information exposure
return Response.json({
  status: "healthy",
  timestamp: new Date().toISOString(),
  // No version info, no system details
});
```

### QR Code Redirects

```typescript
// Validate before redirect
const issue = await getIssueByQrCode(params.qrCodeId);
if (!issue) {
  return new Response("Not Found", { status: 404 });
}

// Only redirect to known domains
const url = constructIssueUrl(issue);
if (!isAllowedDomain(url)) {
  return new Response("Invalid redirect", { status: 400 });
}
```

### Development Endpoints

```typescript
// Always check environment
if (process.env.NODE_ENV === "production") {
  return new Response("Not Found", { status: 404 });
}
```

## Common Security Patterns

### 1. Resource Ownership Validation

```typescript
// Always verify user can access resource
const issue = await ctx.db.issue.findFirst({
  where: {
    id: input.issueId,
    organizationId: ctx.organization.id, // Automatic via Prisma
  },
});

if (!issue) {
  throw new TRPCError({ code: "NOT_FOUND" });
}
```

### 2. Bulk Operation Limits

```typescript
const deleteIssues = organizationProcedure
  .input(
    z.object({
      issueIds: z.array(z.string()).max(100), // Limit bulk operations
    }),
  )
  .mutation(async ({ ctx, input }) => {
    // Process in batches
  });
```

### 3. Sensitive Data Filtering

```typescript
// Never return sensitive fields
const users = await ctx.db.user.findMany({
  select: {
    id: true,
    name: true,
    email: true,
    // password: false - Never select
    // apiKey: false - Never select
  },
});
```

### 4. Audit Logging

```typescript
// Log sensitive operations
await ctx.db.auditLog.create({
  data: {
    userId: ctx.session.user.id,
    action: "DELETE_ISSUE",
    resourceId: issue.id,
    organizationId: ctx.organization.id,
    metadata: { reason: input.reason },
  },
});
```

## Security Testing

### Unit Tests

```typescript
test("requires authentication", async () => {
  const caller = appRouter.createCaller({
    session: null, // No session
  });

  await expect(caller.issue.create(input)).rejects.toThrow("UNAUTHORIZED");
});

test("requires permission", async () => {
  const caller = appRouter.createCaller(
    createMockContext({ permissions: [] }), // No permissions
  );

  await expect(caller.issue.delete({ id: "123" })).rejects.toThrow("FORBIDDEN");
});
```

### E2E Tests

```typescript
test("cannot access other organization data", async ({ page }) => {
  // Login as org1 user
  await loginAsUser(page, "org1-user@example.com");

  // Try to access org2 issue
  await page.goto("/organizations/org2/issues/123");

  // Should redirect or show error
  await expect(page).toHaveURL("/unauthorized");
});
```

## Security Checklist

### For New Procedures

- [ ] Use appropriate procedure type (public/protected/organization)
- [ ] Add permission requirements
- [ ] Validate all inputs with Zod
- [ ] Check resource ownership
- [ ] Handle errors without exposing internals
- [ ] Add rate limiting if needed
- [ ] Log sensitive operations

### For New Features

- [ ] Document security model
- [ ] Add permission constants
- [ ] Create permission tests
- [ ] Update role defaults
- [ ] Add audit logging
- [ ] Review with security mindset

### For Production

- [ ] Disable development endpoints
- [ ] Enable HTTPS everywhere
- [ ] Set secure cookie flags
- [ ] Configure CORS properly
- [ ] Add rate limiting
- [ ] Set up monitoring
- [ ] Plan security updates

## Incident Response

### If Security Issue Found

1. **Assess severity** - Data exposure? Active exploit?
2. **Patch immediately** - Deploy fix ASAP
3. **Audit logs** - Check for exploitation
4. **Notify users** - If data was exposed
5. **Post-mortem** - Document and learn

### Common Vulnerabilities

#### 1. Missing Permission Checks

**Symptom**: User can perform unauthorized actions  
**Fix**: Add `.requiresPermission()` to procedure  
**Prevention**: Always use organizationProcedure for tenant data

#### 2. SQL Injection

**Symptom**: Raw SQL with user input  
**Fix**: Use Prisma's query builder  
**Prevention**: Never use raw SQL with user data

#### 3. Cross-Tenant Access

**Symptom**: User sees other org's data  
**Fix**: Check Prisma extension is active  
**Prevention**: Always test multi-tenant isolation

#### 4. Exposed Errors

**Symptom**: Stack traces in production  
**Fix**: Use generic error messages  
**Prevention**: Configure error handling

## Public Endpoint Security

Public endpoints, while not requiring authentication, still have critical security considerations:

- **Organization Context**: Public endpoints must still be scoped to the correct organization, usually via subdomain resolution. This prevents data leakage between tenants.
- **Data Exposure**: Use Prisma's `select` statement to explicitly define the public data that can be exposed. Never return the entire object.
- **Security-First Design Validation**: Public endpoints require comprehensive testing to validate security boundaries, including:
  - No authentication required.
  - Organization context is preserved.
  - Data exposure is limited to only safe public data.
  - Graceful error handling for missing organizations or database errors.

### Example: Safe Public Endpoint

```typescript
// ✅ Correct - Organization-scoped public endpoint
export const getPublicOrganization = publicProcedure.query(({ ctx }) => {
  if (!ctx.organization) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Organization not found",
    });
  }

  // Only expose safe public data
  return {
    id: ctx.organization.id,
    name: ctx.organization.name,
    description: ctx.organization.description,
    // Do NOT expose: phone, address, internal settings
  };
});

// ✅ Correct - Public location data with explicit selection
export const getPublicLocations = publicProcedure.query(({ ctx }) => {
  if (!ctx.organization) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Organization not found",
    });
  }

  return ctx.db.location.findMany({
    where: { organizationId: ctx.organization.id },
    select: {
      id: true,
      name: true,
      _count: { select: { machines: true } },
      // Do NOT expose: phone, street, city, state, zip
    },
  });
});
```

### Common Public Endpoint Pitfalls

```typescript
// ❌ Dangerous - Exposes all organization data
export const getOrganization = publicProcedure.query(({ ctx }) => {
  return ctx.organization; // Contains phone, address, internal settings!
});

// ❌ Dangerous - No organization scoping
export const getStats = publicProcedure.query(({ ctx }) => {
  return ctx.db.issue.count(); // Returns count across ALL organizations!
});

// ❌ Dangerous - Missing error handling
export const getPublicData = publicProcedure.query(({ ctx }) => {
  return ctx.db.location.findMany({
    where: { organizationId: ctx.organization.id }, // Crashes if org is null
  });
});
```

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [tRPC Security](https://trpc.io/docs/server/error-handling)
- [NextAuth.js Security](https://next-auth.js.org/getting-started/security)
- [Prisma Security](https://www.prisma.io/docs/guides/security)
