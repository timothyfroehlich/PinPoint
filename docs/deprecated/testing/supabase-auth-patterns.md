# Supabase Authentication Testing Patterns

This guide documents testing patterns specific to Supabase authentication, which differs significantly from NextAuth patterns.

## Mock Context Factory Pattern

### Basic Pattern

```typescript
import {
  createVitestMockContext,
  type VitestMockContext,
} from "~/test/vitestMockContext";

const createMockTRPCContext = (
  permissions: string[] = [],
): VitestMockContext & {
  membership: { roleId: string | null };
  userPermissions: string[];
} => {
  const mockContext = createVitestMockContext();

  return {
    ...mockContext,
    user: {
      id: "user-1",
      email: "test@example.com",
      user_metadata: { name: "Test User" },
      app_metadata: { organization_id: "org-1" },
    } as any,
    organization: {
      id: "org-1",
      name: "Test Organization",
      subdomain: "test-org",
    },
    membership: { roleId: "role-1" },
    userPermissions: permissions,
  };
};
```

### Key Differences from NextAuth

1. **User Structure**: Supabase uses `user_metadata` and `app_metadata` instead of flat user properties
2. **Organization ID**: Stored in `app_metadata.organization_id` rather than session
3. **Type Safety**: Use `as any` in tests to bypass strict typing when mocking

## Testing Authentication States

### 🔓 Unauthenticated User Testing

```typescript
describe("🔓 Unauthenticated Users", () => {
  it("should handle missing user gracefully", () => {
    const context = createMockTRPCContext();
    context.user = null;

    // Test public access patterns
    expect(() => requireAuth(context)).toThrow("Unauthorized");
  });
});
```

### 👤 Authenticated User Testing

```typescript
describe("👤 Member Users", () => {
  it("should access member-level features", () => {
    const context = createMockTRPCContext(["issue:view", "issue:create"]);

    // Test member permissions
    expect(context.userPermissions).toContain("issue:view");
  });
});
```

### 👑 Admin User Testing

```typescript
describe("👑 Admin Users", () => {
  it("should have elevated permissions", () => {
    const context = createMockTRPCContext([
      "issue:view",
      "issue:create",
      "issue:delete",
      "user:manage",
    ]);

    // Test admin-specific features
    expect(context.userPermissions).toContain("user:manage");
  });
});
```

## Mocking Supabase User Objects

### Complete User Mock

```typescript
function createMockSupabaseUser(overrides: any = {}) {
  return {
    id: "user-123",
    aud: "authenticated",
    role: "authenticated",
    email: "user@example.com",
    email_confirmed_at: "2024-01-01T00:00:00Z",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    user_metadata: {
      name: "Test User",
      avatar_url: null,
      ...overrides.user_metadata,
    },
    app_metadata: {
      organization_id: "org-1",
      provider: "email",
      ...overrides.app_metadata,
    },
    ...overrides,
  };
}
```

### Testing Multi-Tenant Boundaries

```typescript
describe("🏢 Multi-Tenant Security", () => {
  it("should prevent cross-organization access", () => {
    const userOrg1 = createMockSupabaseUser({
      app_metadata: { organization_id: "org-1" },
    });

    const userOrg2 = createMockSupabaseUser({
      app_metadata: { organization_id: "org-2" },
    });

    // Test organization boundary enforcement
    const resource = { organizationId: "org-1" };

    expect(canAccess(userOrg1, resource)).toBe(true);
    expect(canAccess(userOrg2, resource)).toBe(false);
  });
});
```

## Permission Mocking Strategies

### Mock Permission Checks

```typescript
import {
  getUserPermissionsForSession,
  requirePermissionForSession,
} from "~/server/auth/permissions";

vi.mock("~/server/auth/permissions", async () => {
  const actual = await vi.importActual("~/server/auth/permissions");
  return {
    ...actual,
    getUserPermissionsForSession: vi.fn(),
    requirePermissionForSession: vi.fn(),
  };
});

// In test setup
vi.mocked(getUserPermissionsForSession).mockResolvedValue([
  "issue:view",
  "issue:create",
]);

vi.mocked(requirePermissionForSession).mockImplementation(
  async (_session, permission) => {
    const permissions = ["issue:view", "issue:create"];
    if (!permissions.includes(permission)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Missing required permission: ${permission}`,
      });
    }
  },
);
```

## Database Query Pattern Mocking

### Handle Multiple Query Patterns

```typescript
// Some procedures use findUnique, others use findFirst
const mockMembership = createMockMembership();

// Mock both patterns for complete coverage
vi.mocked(mockContext.db.membership.findUnique).mockResolvedValue(
  mockMembership,
);
vi.mocked(mockContext.db.membership.findFirst).mockResolvedValue(
  mockMembership,
);
```

## Integration with tRPC Procedures

### Testing Protected Procedures

```typescript
describe("Protected tRPC Procedures", () => {
  const createCaller = createCallerFactory(appRouter);

  it("should enforce authentication", async () => {
    const context = createMockTRPCContext();
    context.user = null; // No user

    const caller = createCaller(context);

    await expect(
      caller.issue.create({
        title: "Test Issue",
        machineId: "machine-1",
      }),
    ).rejects.toThrow("UNAUTHORIZED");
  });

  it("should enforce permissions", async () => {
    const context = createMockTRPCContext(["issue:view"]); // Missing issue:create
    const caller = createCaller(context);

    await expect(
      caller.issue.create({
        title: "Test Issue",
        machineId: "machine-1",
      }),
    ).rejects.toThrow("FORBIDDEN");
  });
});
```

## Best Practices

1. **Use Emoji Prefixes**: Organize test suites by auth state (🔓, 👤, 👑, 🏢)
2. **Mock at Multiple Levels**: Mock both database queries and permission functions
3. **Test Boundaries**: Always test organization boundaries in multi-tenant scenarios
4. **Type Safety**: Use `as any` sparingly and only in test files
5. **Consistent Factories**: Create reusable mock factories for common objects

## Common Pitfalls

1. **Forgetting app_metadata**: Organization ID must be in `app_metadata`, not `user_metadata`
2. **Incomplete Mocks**: Must mock both `findUnique` and `findFirst` for membership queries
3. **Permission Arrays**: Permissions should be string arrays, not objects
4. **Missing Context Properties**: Ensure all required context properties are present

## Migration from NextAuth

When migrating tests from NextAuth to Supabase:

1. Replace `session.user` with Supabase user structure
2. Move `organizationId` to `app_metadata`
3. Update permission checks to use new permission system
4. Replace NextAuth mocks with Supabase equivalents
