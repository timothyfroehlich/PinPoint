# Permissions and Roles System Implementation

**Status**: ✅ **Active** - Current implementation guide  
**Audience**: Developers, Security Review  
**Last Updated**: July 25, 2025

---

## Overview

PinPoint implements a comprehensive Role-Based Access Control (RBAC) system with multi-tenant scoping, hierarchical permissions, and support for both authenticated and unauthenticated users. The system provides fine-grained control over features while maintaining usability and testability.

---

## Database Schema

### Core Models

**Location**: `src/server/db/schema/organizations.ts`

#### Role Model

```prisma
model Role {
  id             String   @id @default(cuid())
  name           String   // e.g., "Admin", "Technician", "Manager"
  organizationId String
  isDefault      Boolean  @default(false)
  isSystem       Boolean  @default(false) // Admin, Unauthenticated
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  memberships  Membership[]
  permissions  Permission[] @relation("RolePermissions")

  @@unique([name, organizationId])
}
```

#### Permission Model

```prisma
model Permission {
  id          String  @id @default(cuid())
  name        String  @unique // e.g., "issue:create", "machine:delete"
  description String?

  roles Role[] @relation("RolePermissions")
}
```

#### Membership Model

```prisma
model Membership {
  id             String @id @default(cuid())
  userId         String
  organizationId String
  roleId         String

  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  role         Role         @relation(fields: [roleId], references: [id])

  @@unique([userId, organizationId])
}
```

---

## Permission System

### Permission Categories

**Location**: `src/server/auth/permissions.constants.ts`

```typescript
export const PERMISSIONS = {
  // Issues
  ISSUE_VIEW: "issue:view",
  ISSUE_CREATE: "issue:create",
  ISSUE_EDIT: "issue:edit",
  ISSUE_DELETE: "issue:delete",
  ISSUE_ASSIGN: "issue:assign",
  ISSUE_BULK_MANAGE: "issue:bulk_manage",

  // Machines
  MACHINE_VIEW: "machine:view",
  MACHINE_CREATE: "machine:create",
  MACHINE_EDIT: "machine:edit",
  MACHINE_DELETE: "machine:delete",

  // Locations
  LOCATION_VIEW: "location:view",
  LOCATION_CREATE: "location:create",
  LOCATION_EDIT: "location:edit",
  LOCATION_DELETE: "location:delete",

  // Attachments
  ATTACHMENT_VIEW: "attachment:view",
  ATTACHMENT_CREATE: "attachment:create",
  ATTACHMENT_DELETE: "attachment:delete",

  // Administration
  ORGANIZATION_MANAGE: "organization:manage",
  ROLE_MANAGE: "role:manage",
  USER_MANAGE: "user:manage",
  ADMIN_VIEW_ANALYTICS: "admin:view_analytics",
} as const;
```

### Permission Dependencies

The system automatically includes prerequisite permissions:

```typescript
export const PERMISSION_DEPENDENCIES: Record<string, string[]> = {
  [PERMISSIONS.ISSUE_EDIT]: [PERMISSIONS.ISSUE_VIEW],
  [PERMISSIONS.ISSUE_DELETE]: [PERMISSIONS.ISSUE_VIEW],
  [PERMISSIONS.ISSUE_ASSIGN]: [PERMISSIONS.ISSUE_VIEW],
  [PERMISSIONS.ISSUE_BULK_MANAGE]: [
    PERMISSIONS.ISSUE_VIEW,
    PERMISSIONS.ISSUE_EDIT,
  ],
  [PERMISSIONS.MACHINE_EDIT]: [PERMISSIONS.MACHINE_VIEW],
  [PERMISSIONS.MACHINE_DELETE]: [PERMISSIONS.MACHINE_VIEW],
  // ... additional dependencies
};
```

### System Roles

```typescript
export const SYSTEM_ROLES = {
  ADMIN: "Admin", // All permissions automatically
  UNAUTHENTICATED: "Unauthenticated", // Public permissions
} as const;
```

- **Admin**: Bypasses all permission checks (wildcard access)
- **Unauthenticated**: Configurable permissions for public users

### Role Templates

Pre-defined role configurations for new organizations:

```typescript
export const ROLE_TEMPLATES = {
  MEMBER: {
    name: "Member",
    description: "Standard organization member with basic permissions",
    permissions: [
      PERMISSIONS.ISSUE_VIEW,
      PERMISSIONS.ISSUE_CREATE,
      PERMISSIONS.ISSUE_EDIT,
      PERMISSIONS.ISSUE_DELETE,
      PERMISSIONS.ISSUE_ASSIGN,
      PERMISSIONS.MACHINE_VIEW,
      PERMISSIONS.LOCATION_VIEW,
      PERMISSIONS.ATTACHMENT_VIEW,
      PERMISSIONS.ATTACHMENT_CREATE,
    ],
  },
} as const;
```

---

## Frontend Components

### PermissionGate Component

**Location**: `src/components/permissions/PermissionGate.tsx`

Conditionally renders content based on permissions:

```typescript
interface PermissionGateProps {
  permission: string;
  hasPermission: (permission: string) => boolean;
  fallback?: ReactNode;
  children: ReactNode;
  showFallback?: boolean;
}

export function PermissionGate({
  permission,
  hasPermission,
  fallback,
  children,
  showFallback = false,
}: PermissionGateProps): ReactNode {
  const hasRequiredPermission = hasPermission(permission);

  if (hasRequiredPermission) {
    return <>{children}</>;
  }

  if (showFallback && fallback) {
    return <>{fallback}</>;
  }

  return null;
}
```

**Usage**:

```tsx
<PermissionGate
  permission="issue:edit"
  hasPermission={hasPermission}
  fallback={<Typography>You cannot edit issues</Typography>}
  showFallback
>
  <EditIssueButton />
</PermissionGate>
```

### PermissionButton Component

**Location**: `src/components/permissions/PermissionButton.tsx`

Button with automatic permission-based disabled states and tooltips:

```typescript
interface PermissionButtonProps extends Omit<ButtonProps, "disabled"> {
  permission: string;
  hasPermission: (permission: string) => boolean;
  tooltipText?: string;
  showWhenDenied?: boolean;
  disabled?: boolean;
}

export const PermissionButton = forwardRef<HTMLButtonElement, PermissionButtonProps>(
  function PermissionButton({
    permission,
    hasPermission,
    tooltipText,
    showWhenDenied = true,
    disabled: customDisabled = false,
    children,
    ...buttonProps
  }, ref) {
    const hasRequiredPermission = hasPermission(permission);
    const isDisabled = customDisabled || !hasRequiredPermission;

    if (!hasRequiredPermission && !showWhenDenied) {
      return null;
    }

    const button = (
      <Button {...buttonProps} ref={ref} disabled={isDisabled}>
        {children}
      </Button>
    );

    // Auto-tooltip for disabled permissions
    if (!hasRequiredPermission && showWhenDenied) {
      const tooltip = tooltipText ?? getDefaultTooltipText(permission);
      return (
        <Tooltip title={tooltip}>
          <span>{button}</span>
        </Tooltip>
      );
    }

    return button;
  }
);
```

**Usage**:

```tsx
<PermissionButton
  permission="issue:delete"
  hasPermission={hasPermission}
  onClick={handleDelete}
  color="error"
  startIcon={<DeleteIcon />}
  tooltipText="You don't have permission to delete issues"
>
  Delete Issue
</PermissionButton>
```

---

## Permission Hooks

### usePermissions Hook

**Location**: `src/hooks/usePermissions.ts`

Central hook for permission checking:

```typescript
export interface UsePermissionsReturn {
  hasPermission: HasPermissionFunction;
  permissions: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  isError: boolean;
  roleName?: string;
  isAdmin: boolean;
}

export function usePermissions(): UsePermissionsReturn {
  const { sessionHook, membershipQuery } = usePermissionDependencies();
  const { data: session, status } = sessionHook();
  const isAuthenticated = status === "authenticated" && !!session;

  const {
    data: membership,
    isLoading,
    isError,
  } = membershipQuery(undefined, {
    enabled: isAuthenticated,
  });

  const permissions = useMemo(() => {
    if (!membership?.permissions) return [];
    return membership.permissions;
  }, [membership?.permissions]);

  const hasPermission: HasPermissionFunction = useCallback(
    (permission: string) => {
      if (!isAuthenticated) return false;
      if (!permissions.length) return false;
      return permissions.includes(permission);
    },
    [isAuthenticated, permissions],
  );

  const isAdmin = useMemo(() => {
    return membership?.role === "Admin";
  }, [membership?.role]);

  return {
    hasPermission,
    permissions,
    isAuthenticated,
    isLoading: status === "loading" || isLoading,
    isError,
    roleName: membership?.role,
    isAdmin,
  };
}
```

**Usage**:

```tsx
function IssueActions() {
  const { hasPermission, isLoading, roleName } = usePermissions();

  if (isLoading) return <CircularProgress />;

  return (
    <Box>
      <Typography>Role: {roleName}</Typography>
      {hasPermission("issue:edit") && <Button>Edit Issue</Button>}
      {hasPermission("issue:delete") && (
        <Button color="error">Delete Issue</Button>
      )}
    </Box>
  );
}
```

### useRequiredPermission Hook

Hook that redirects users without required permissions:

```typescript
export function useRequiredPermission(
  permission: string,
  redirectTo = "/",
): { isLoading: boolean } {
  const router = useRouter();
  const { hasPermission, isAuthenticated, isLoading } = usePermissions();

  useMemo(() => {
    if (!isLoading && isAuthenticated && !hasPermission(permission)) {
      router.push(redirectTo);
    }
  }, [
    isLoading,
    isAuthenticated,
    hasPermission,
    permission,
    redirectTo,
    router,
  ]);

  return { isLoading };
}
```

**Usage**:

```tsx
function AdminPanel() {
  const { isLoading } = useRequiredPermission(
    "admin:view_analytics",
    "/dashboard",
  );

  if (isLoading) return <div>Checking permissions...</div>;

  return (
    <div>
      <h1>Admin Analytics</h1>
      {/* Admin-only content */}
    </div>
  );
}
```

---

## Backend Authorization

### PermissionService

**Location**: `src/server/services/permissionService.ts`

Core service for permission checking with multi-tenant support:

```typescript
export class PermissionService {
  constructor(private prisma: ExtendedPrismaClient) {}

  async hasPermission(
    session: Session | null,
    permission: string,
    organizationId?: string,
  ): Promise<boolean> {
    // Handle unauthenticated users
    if (!session?.user) {
      return this.checkUnauthenticatedPermission(permission, organizationId);
    }

    const finalOrgId =
      organizationId ??
      (session.user as { organizationId?: string }).organizationId;

    if (!finalOrgId) {
      throw new Error("Organization ID is required");
    }

    const membership = await this.getUserMembership(
      session.user.id,
      finalOrgId,
    );

    if (!membership?.role) {
      return false;
    }

    // Admin role has all permissions
    if (membership.role.name === SYSTEM_ROLES.ADMIN) {
      return true;
    }

    // Check if role has the specific permission
    return this.roleHasPermission(membership.role, permission);
  }

  async requirePermission(
    session: Session | null,
    permission: string,
    organizationId?: string,
  ): Promise<void> {
    const hasAccess = await this.hasPermission(
      session,
      permission,
      organizationId,
    );

    if (!hasAccess) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Missing required permission: ${permission}`,
      });
    }
  }

  expandPermissionsWithDependencies(permissions: string[]): string[] {
    const expandedPermissions = new Set(permissions);

    permissions.forEach((permission) => {
      const dependencies = PERMISSION_DEPENDENCIES[permission];
      if (dependencies) {
        dependencies.forEach((dep) => expandedPermissions.add(dep));
      }
    });

    return Array.from(expandedPermissions);
  }
}
```

### tRPC Permission Procedures

**Location**: `src/server/api/trpc.permission.ts`

Pre-built procedures for common permissions:

```typescript
export const issueViewProcedure = organizationProcedure.use(async (opts) => {
  await requirePermissionForSession(
    opts.ctx.session,
    "issue:view",
    opts.ctx.db,
    opts.ctx.organization.id,
  );
  return opts.next();
});

export const issueCreateProcedure = organizationProcedure.use(async (opts) => {
  await requirePermissionForSession(
    opts.ctx.session,
    "issue:create",
    opts.ctx.db,
    opts.ctx.organization.id,
  );
  return opts.next();
});

export const machineEditProcedure = organizationProcedure.use(async (opts) => {
  await requirePermissionForSession(
    opts.ctx.session,
    "machine:edit",
    opts.ctx.db,
    opts.ctx.organization.id,
  );
  return opts.next();
});
```

**Usage in Routers**:

```typescript
export const issueRouter = createTRPCRouter({
  create: issueCreateProcedure
    .input(CreateIssueSchema)
    .mutation(async ({ ctx, input }) => {
      // Permission already validated by procedure
      return ctx.db.issue.create({
        data: {
          ...input,
          organizationId: ctx.organization.id,
          createdById: ctx.session.user.id,
        },
      });
    }),

  delete: issueViewProcedure // Can reuse for deletion
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Additional permission check if needed
      await ctx.services
        .createPermissionService()
        .requirePermission(ctx.session, "issue:delete", ctx.organization.id);

      return ctx.db.issue.delete({
        where: {
          id: input.id,
          organizationId: ctx.organization.id, // Multi-tenant safety
        },
      });
    }),
});
```

---

## Multi-Tenant Architecture

### Organization Context Resolution

The system automatically resolves organization context through a priority order:

1. **User Session**: If authenticated, uses `session.user.organizationId`
2. **Subdomain Header**: Falls back to `x-subdomain` header
3. **Environment Default**: Uses `env.DEFAULT_ORG_SUBDOMAIN`

### Procedure Hierarchy

**Location**: `src/server/api/trpc.base.ts`

Three levels of procedure protection:

```typescript
// 1. Public - No authentication required
export const publicProcedure = t.procedure;

// 2. Protected - Requires authentication
export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});

// 3. Organization - Requires organization membership
export const organizationProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    if (!ctx.organization) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Organization not found",
      });
    }

    const membership = await ctx.db.membership.findFirst({
      where: {
        organizationId: ctx.organization.id,
        userId: ctx.session.user.id,
      },
      include: {
        role: { include: { permissions: true } },
      },
    });

    if (!membership) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You don't have permission to access this organization",
      });
    }

    // Get expanded permissions (includes dependencies)
    const userPermissions = await getUserPermissionsForSession(
      ctx.session,
      ctx.db,
      ctx.organization.id,
    );

    return next({
      ctx: {
        ...ctx,
        organization: ctx.organization,
        membership,
        userPermissions,
      },
    });
  },
);
```

### Organization Scoping

All organization-scoped queries include automatic filtering:

```typescript
// Example from machine router
export const machineRouter = createTRPCRouter({
  getAll: organizationProcedure.query(({ ctx }) => {
    return ctx.db.machine.findMany({
      where: {
        organizationId: ctx.organization.id, // Auto-scoped
      },
      include: {
        model: true,
        location: true,
      },
    });
  }),

  create: machineCreateProcedure
    .input(CreateMachineSchema)
    .mutation(({ ctx, input }) => {
      return ctx.db.machine.create({
        data: {
          ...input,
          organizationId: ctx.organization.id, // Auto-scoped
        },
      });
    }),
});
```

---

## Unauthenticated User Support

### Default Public Permissions

**Location**: `src/server/auth/permissions.constants.ts`

```typescript
export const UNAUTHENTICATED_PERMISSIONS = [
  PERMISSIONS.ISSUE_VIEW,
  PERMISSIONS.ISSUE_CREATE,
  PERMISSIONS.MACHINE_VIEW,
  PERMISSIONS.LOCATION_VIEW,
  PERMISSIONS.ATTACHMENT_VIEW,
  PERMISSIONS.ATTACHMENT_CREATE,
];
```

### Public Issue Reporting

Organizations can enable public issue reporting by configuring the "Unauthenticated" system role:

```typescript
// Example unauthenticated procedure usage
export const issueRouter = createTRPCRouter({
  create: publicProcedure // Note: public, not protected
    .input(CreateIssueSchema)
    .mutation(async ({ ctx, input }) => {
      // Check if organization allows unauthenticated issue creation
      const permissionService = ctx.services.createPermissionService();
      await permissionService.requirePermission(
        ctx.session, // May be null for unauthenticated users
        PERMISSIONS.ISSUE_CREATE,
        ctx.organization?.id,
      );

      // Create issue with anonymous user if not authenticated
      const createdById =
        ctx.session?.user?.id ??
        (await getAnonymousUserId(ctx.organization.id));

      return ctx.db.issue.create({
        data: {
          ...input,
          createdById,
          organizationId: ctx.organization.id,
        },
      });
    }),
});
```

---

## Testing Support

### Dependency Injection for Testing

**Location**: `src/contexts/PermissionDepsContext.tsx`

Allows mocking of permission dependencies in tests:

```typescript
export interface PermissionDependencies {
  sessionHook: typeof useSession;
  membershipQuery: typeof api.user.getCurrentMembership.useQuery;
}

export function PermissionDepsProvider({
  children,
  sessionHook,
  membershipQuery,
}: {
  children: ReactNode;
  sessionHook: typeof useSession;
  membershipQuery: typeof api.user.getCurrentMembership.useQuery;
}): ReactElement {
  const dependencies: PermissionDependencies = {
    sessionHook,
    membershipQuery,
  };

  return (
    <PermissionDepsContext.Provider value={dependencies}>
      {children}
    </PermissionDepsContext.Provider>
  );
}
```

### Testing Pattern Example

```tsx
describe("IssueActions Component", () => {
  it("should show edit button for users with edit permission", () => {
    const mockSession = { user: { id: "user-1" } };
    const mockMembership = {
      role: "Member",
      permissions: ["issue:view", "issue:edit"],
    };

    render(
      <PermissionDepsProvider
        sessionHook={() => ({ data: mockSession, status: "authenticated" })}
        membershipQuery={() => ({ data: mockMembership, isLoading: false })}
      >
        <IssueActions />
      </PermissionDepsProvider>,
    );

    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
  });

  it("should disable edit button for users without edit permission", () => {
    const mockMembership = {
      role: "Viewer",
      permissions: ["issue:view"], // No edit permission
    };

    render(
      <PermissionDepsProvider
        sessionHook={() => ({ data: mockSession, status: "authenticated" })}
        membershipQuery={() => ({ data: mockMembership, isLoading: false })}
      >
        <IssueActions />
      </PermissionDepsProvider>,
    );

    const editButton = screen.getByRole("button", { name: /edit/i });
    expect(editButton).toBeDisabled();
  });
});
```

---

## Security Considerations

### Defense in Depth

1. **Frontend**: Components hide/disable features without permissions
2. **API**: tRPC procedures validate permissions server-side
3. **Database**: Organization scoping prevents cross-tenant access
4. **Service Layer**: Business logic validates permissions independently

### Permission Bypass Prevention

- **Admin role checking**: Only checks role name, not permissions list
- **Organization scoping**: All queries include organization filter
- **Session validation**: All protected procedures validate authentication
- **Permission dependencies**: Automatically included to prevent privilege escalation

### Audit Trail

The system logs permission-related actions:

```typescript
// Example audit logging
await ctx.services.createAuditService().logAction({
  userId: ctx.session.user.id,
  organizationId: ctx.organization.id,
  action: "issue:delete",
  resourceId: input.id,
  timestamp: new Date(),
});
```

---

## Best Practices

### Frontend Development

✅ **Do**:

- Use `PermissionGate` for conditional rendering
- Use `PermissionButton` for action buttons
- Check permissions in hooks, not components
- Provide meaningful fallback content

❌ **Don't**:

- Rely only on frontend permission checks
- Skip permission checks in event handlers
- Use permissions for navigation decisions alone
- Assume permission checks are sufficient for security

### Backend Development

✅ **Do**:

- Use permission procedures for common patterns
- Validate permissions at the procedure level
- Include organization scoping in all queries
- Use the service layer for complex permission logic

❌ **Don't**:

- Skip permission checks in mutations
- Trust frontend permission states
- Mix permission logic with business logic
- Forget to check permissions in nested operations

### Testing

✅ **Do**:

- Test both authorized and unauthorized states
- Mock permission dependencies explicitly
- Test permission component rendering
- Verify service-level permission checks

❌ **Don't**:

- Skip testing unauthorized access attempts
- Mock permissions at the wrong level
- Test only the happy path
- Ignore edge cases like role changes

---

## Related Documentation

- **[Dependency Injection Architecture](./dependency-injection.md)** - Service layer and testing patterns
- **[Multi-Config Strategy](../configuration/multi-config-strategy.md)** - TypeScript and testing configuration
- **[Testing Architecture Patterns](../testing/architecture-patterns.md)** - Permission testing strategies

**Next Review**: August 25, 2025
