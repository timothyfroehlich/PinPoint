# API Routes Documentation

**Last Updated**: 2025-07-22  
**Status**: Current  
**Purpose**: Document legitimate API routes and explain the tRPC-first strategy

## Overview

PinPoint follows a **tRPC-first API strategy**. We use tRPC for all application endpoints except where technical constraints require traditional HTTP APIs. This document catalogs the legitimate API routes, explains why each exists, and provides security guidelines.

## Why tRPC-First?

1. **Type Safety**: End-to-end TypeScript type safety from backend to frontend
2. **Permission Integration**: Seamless integration with our permission system
3. **Developer Experience**: Auto-completion, type checking, and refactoring support
4. **Security**: Built-in CSRF protection and automatic input validation

## Legitimate API Routes

### 1. Authentication Handler
**Path**: `/api/auth/[...nextauth]`  
**Methods**: GET, POST  
**Purpose**: NextAuth.js requirement for OAuth and credential providers  
**Security**: Handled by NextAuth.js internally

```typescript
// src/app/api/auth/[...nextauth]/route.ts
export { GET, POST } from "~/server/auth";
```

**Why Not tRPC?**: NextAuth.js requires specific HTTP endpoints for OAuth callbacks and provider integration.

### 2. tRPC Handler
**Path**: `/api/trpc/[trpc]`  
**Methods**: GET, POST  
**Purpose**: The tRPC HTTP handler itself  
**Security**: Built-in CSRF protection, all procedures require authentication/authorization

```typescript
// src/app/api/trpc/[trpc]/route.ts
export { handler as GET, handler as POST };
```

**Why Not tRPC?**: This IS the tRPC endpoint - it handles all tRPC requests.

### 3. Health Check
**Path**: `/api/health`  
**Methods**: GET  
**Purpose**: Monitoring and deployment health checks  
**Security**: Public endpoint, returns minimal information

```typescript
// src/app/api/health/route.ts
export async function GET() {
  // Check database connectivity
  // Return health status
  return Response.json({ 
    status: "healthy",
    timestamp: new Date().toISOString()
  });
}
```

**Why Not tRPC?**: Monitoring tools expect standard HTTP endpoints with simple JSON responses.

### 4. QR Code Redirect
**Path**: `/api/qr/[qrCodeId]`  
**Methods**: GET  
**Purpose**: Handle QR code scans with HTTP redirects  
**Security**: Public endpoint, validates QR code exists before redirect

```typescript
// src/app/api/qr/[qrCodeId]/route.ts
export async function GET(req, { params }) {
  const issue = await getIssueByQrCode(params.qrCodeId);
  if (!issue) return new Response("Not Found", { status: 404 });
  
  // Redirect to issue detail page
  return Response.redirect(constructIssueUrl(issue));
}
```

**Why Not tRPC?**: QR code scanners need simple HTTP URLs that return redirects.

### 5. Development User Utility
**Path**: `/api/dev/users`  
**Methods**: GET  
**Purpose**: Development-only endpoint for user management  
**Security**: Only enabled in development environment

```typescript
// src/app/api/dev/users/route.ts
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not Found", { status: 404 });
  }
  
  // Return development user data
  const users = await getUsersForDevelopment();
  return Response.json(users);
}
```

**Why Not tRPC?**: Simple development utility that needs to work before authentication.

## Removed API Routes

The following API routes have been removed in favor of tRPC procedures:

- `/api/upload/*` → Use `upload.createPresignedUrl` tRPC procedure
- `/api/users/*` → Use `user.*` tRPC procedures  
- `/api/organizations/*` → Use `organization.*` tRPC procedures
- `/api/issues/*` → Use `issue.*` tRPC procedures
- `/api/games/*` → Use `game.*` tRPC procedures

## Security Guidelines

### For Legitimate API Routes

1. **Environment Checks**: Development-only endpoints must check `NODE_ENV`
2. **Input Validation**: Validate all inputs, even for simple endpoints
3. **Error Handling**: Don't expose internal errors or stack traces
4. **Rate Limiting**: Consider rate limiting for public endpoints
5. **Logging**: Log access to API routes for security monitoring

### For New Features

**Default to tRPC** unless you have one of these specific requirements:

1. **External Service Webhooks**: Need to receive POST data from external services
2. **File Downloads**: Need to stream binary data with specific headers
3. **OAuth Callbacks**: Required by authentication providers
4. **Legacy Integration**: Third-party tools that can't use tRPC

## Adding New API Routes

Before adding a new API route, ask:

1. Can this be a tRPC procedure instead?
2. Does it require specific HTTP semantics (redirects, headers)?
3. Will it be called by external services?
4. Does it need to work without authentication?

If you answered "no" to all except #1, use tRPC instead.

## Testing API Routes

### Unit Tests
```typescript
// src/app/api/health/__tests__/route.test.ts
import { GET } from "../route";

test("health check returns 200", async () => {
  const response = await GET();
  expect(response.status).toBe(200);
});
```

### Integration Tests
```typescript
// Use MSW for external service mocking
// Use supertest for HTTP testing
```

## Migration Path

For legacy code using API routes, follow the migration guide at [/docs/migration/api-to-trpc.md](../migration/api-to-trpc.md).

## References

- [tRPC Documentation](https://trpc.io)
- [NextAuth.js Route Handlers](https://next-auth.js.org/configuration/initialization#route-handlers)
- [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)