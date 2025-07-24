# Task 1: Create Public API Endpoints

## Overview
Create public tRPC procedures that don't require authentication to support the unified dashboard. Public users need access to organization info and location data to browse the pinball machines.

## Priority: High
This is foundational work that other tasks depend on.

## Files to Modify

### 1. `src/server/api/routers/location.ts`
**Current State**: Only has `organizationProcedure` endpoints that require authentication
**Target State**: Add public endpoint for location browsing

### 2. `src/server/api/routers/organization.ts` 
**Current State**: Already has public `getCurrent` procedure ✅
**Action**: Verify it works correctly for public access

## Implementation Steps

### Step 1: Add Public Location Endpoint

**File**: `src/server/api/routers/location.ts`

Add this new procedure to the locationRouter:

```typescript
export const locationRouter = createTRPCRouter({
  // ... existing procedures ...

  // New public endpoint for homepage
  getPublic: publicProcedure.query(({ ctx }) => {
    if (!ctx.organization) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Organization not found",
      });
    }

    return ctx.db.location.findMany({
      where: {
        organizationId: ctx.organization.id,
        // Only show public locations (add isPublic field later if needed)
      },
      select: {
        id: true,
        name: true,
        // Don't expose sensitive data in public endpoint
        _count: {
          select: {
            machines: true,
          },
        },
        machines: {
          select: {
            id: true,
            model: {
              select: {
                name: true,
                manufacturer: true,
              },
            },
            // Count open issues for each machine
            _count: {
              select: {
                issues: {
                  where: {
                    status: {
                      category: {
                        not: "RESOLVED"
                      }
                    }
                  }
                }
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });
  }),

  // ... rest of existing procedures
});
```

**Key Design Decisions**:
- Uses `publicProcedure` (no authentication required)
- Still respects organization context from subdomain
- Only exposes public-safe data (no sensitive information)
- Includes machine counts and basic issue counts for public display
- Orders locations alphabetically for consistent display

### Step 2: Verify Organization Public Access

**File**: `src/server/api/routers/organization.ts`

The `getCurrent` procedure already uses `publicProcedure` correctly:

```typescript
getCurrent: publicProcedure.query(({ ctx }) => {
  // Return the organization from context (resolved based on subdomain)
  return ctx.organization;
}),
```

This should work correctly for public access. Test to ensure it returns organization data without authentication.

### Step 3: Update API Router

**File**: `src/server/api/root.ts`

Ensure the location router is properly exported (should already be done):

```typescript
export const appRouter = createTRPCRouter({
  // ... other routers ...
  location: locationRouter,
  organization: organizationRouter,
  // ... rest of routers
});
```

## Testing the Implementation

### Manual Testing

1. **Start the dev server**: `npm run dev:full`
2. **Test organization endpoint**:
   ```bash
   curl http://apc.localhost:3000/api/trpc/organization.getCurrent
   ```
3. **Test new location endpoint**:
   ```bash
   curl http://apc.localhost:3000/api/trpc/location.getPublic
   ```

### Integration Testing

Create a simple test to verify the endpoints work:

```typescript
// In a test file or browser console
import { api } from "~/trpc/react";

// Test public organization access
const { data: org } = api.organization.getCurrent.useQuery();
console.log("Organization:", org);

// Test public location access  
const { data: locations } = api.location.getPublic.useQuery();
console.log("Public locations:", locations);
```

## Security Considerations

### Data Exposure Review
- ✅ **Location names**: Safe to expose publicly
- ✅ **Machine names/manufacturers**: Safe to expose publicly  
- ✅ **Machine counts**: Safe to expose publicly
- ✅ **Open issue counts**: Safe to expose publicly (shows machine status)
- ❌ **User information**: Not exposed in public endpoint
- ❌ **Internal issue details**: Not exposed in public endpoint
- ❌ **Organization admin data**: Not exposed in public endpoint

### Public Procedure Security
- Uses `publicProcedure` which bypasses authentication
- Still requires valid organization context (from subdomain)
- Returns 404 if organization not found
- Only exposes data explicitly selected in query

## Documentation References

- **tRPC Procedures**: `src/server/api/trpc.base.ts:194` (publicProcedure definition)
- **Existing Patterns**: `src/server/api/routers/location.ts:27` (getAll procedure pattern)
- **Organization Context**: `src/server/api/trpc.base.ts:100` (createTRPCContext)
- **Security Guidelines**: `@docs/security/api-security.md`
- **API Architecture**: `@docs/architecture/api-routes.md`

## Error Handling

The public endpoints should handle these scenarios gracefully:

1. **No Organization Found**: Return 404 with clear message
2. **Database Connection Issues**: Return 500 with generic message
3. **Invalid Subdomain**: Handled by middleware (redirects to default)

## Next Steps

After implementing this task:
1. Test both endpoints work without authentication
2. Verify organization context is correctly resolved
3. Confirm data returned is appropriate for public consumption
4. Move to Task 2: Transform Homepage to use these endpoints

## Rollback Plan

If issues arise:
1. Comment out the new `getPublic` procedure
2. Use existing authenticated endpoints as fallback
3. Implement proper error boundaries in frontend components

This approach ensures the API layer is solid before building the frontend components that depend on it.