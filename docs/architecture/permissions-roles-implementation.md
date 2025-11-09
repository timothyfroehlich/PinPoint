# Permissions and Roles System Implementation

**Status**: ✅ **Active** - Current implementation guide
**Audience**: Developers, Security Review
**Last Updated**: January 9, 2025

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

## Server Component Authorization

### Server Permission Utilities

**Location**: `src/lib/auth/server-permissions.ts`

Provides reusable utilities for checking permissions in React Server Components with request-level caching:

```typescript
import { cache } from "react";
import type { AuthContext } from "~/server/auth/context";
import { hasPermission, getUserPermissions } from "~/server/auth/permissions";
import { db } from "~/lib/dal/shared";

type AuthorizedContext = Extract<AuthContext, { kind: "authorized" }>;

// Check single permission
export const checkPermission = cache(async (
  authContext: AuthorizedContext,
  permission: string,
): Promise<boolean> => {
  return hasPermission(
    { roleId: authContext.membership.role.id },
    permission,
    db,
  );
});

// Get all user permissions (expanded with dependencies)
export const getAuthPermissions = cache(async (
  authContext: AuthorizedContext,
): Promise<string[]> => {
  return getUserPermissions(
    { roleId: authContext.membership.role.id },
    db,
  );
});

// Check multiple permissions efficiently
export const checkMultiplePermissions = cache(async (
  authContext: AuthorizedContext,
  permissions: string[],
): Promise<Record<string, boolean>> => {
  const userPermissions = await getUserPermissions(
    { roleId: authContext.membership.role.id },
    db,
  );

  const result: Record<string, boolean> = {};
  for (const permission of permissions) {
    result[permission] = userPermissions.includes(permission);
  }
  return result;
});
```

### Usage in Server Components

**User Management Page** (`src/app/settings/users/page.tsx`):
```typescript
import { checkPermission } from "~/lib/auth/server-permissions";
import { PERMISSIONS } from "~/server/auth/permissions.constants";

async function UsersSettingsPageContent(): Promise<React.JSX.Element> {
  const authContext = await getRequestAuthContext();
  if (authContext.kind !== "authorized") {
    throw new Error("Unauthorized access");
  }

  // Dynamic permission checking
  const canManageUsers = await checkPermission(
    authContext,
    PERMISSIONS.USER_MANAGE,
  );

  return (
    <div>
      <UserTableActions
        user={user}
        currentUserCanManage={canManageUsers}
        availableRoles={availableRoles}
      />
    </div>
  );
}
```

**Issue Creation Page** (`src/app/issues/create/page.tsx`):
```typescript
import { getAuthPermissions } from "~/lib/auth/server-permissions";

async function IssueCreatePage(): Promise<React.JSX.Element> {
  const authContext = await getRequestAuthContext();
  if (authContext.kind !== "authorized") {
    redirect("/login");
  }

  // Get all user permissions for feature gating
  const userPermissions = await getAuthPermissions(authContext);

  // Compute what features the user can access
  const gating = computeIssueCreationGating({
    permissions: userPermissions,
  });

  return (
    <IssueCreationForm
      canSetPriority={gating.canSetPriority}
      canAssign={gating.canAssign}
      canSetStatus={gating.canSetStatus}
    />
  );
}
```

### Benefits

1. **Type-Safe**: Uses discriminated union types to ensure only authorized contexts are checked
2. **Request-Level Caching**: React 19 `cache()` prevents duplicate permission queries within same request
3. **Reusable**: Consistent pattern across all Server Components
4. **Performance**: Minimal database queries with automatic deduplication

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

## Admin Actions

### Invitation Management

**Location**: `src/lib/actions/admin-actions.ts`

Provides Server Actions for admin-level user management operations.

#### Resend Invitation Action

Allows admins to resend invitation emails with regenerated tokens:

```typescript
import { resendInvitationAction } from "~/lib/actions/admin-actions";

export async function resendInvitationAction(
  _prevState: ActionResult<{ success: boolean }> | null,
  formData: FormData,
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const authContext = await getRequestAuthContext();
    if (authContext.kind !== "authorized") {
      throw new Error("Member access required");
    }

    // Validate permission
    await requirePermission(
      { role_id: authContext.membership.role.id },
      PERMISSIONS.USER_MANAGE,
      db,
    );

    // Get and validate invitation
    const invitation = await db.query.invitations.findFirst({
      where: and(
        eq(invitations.id, validatedData.invitationId),
        eq(invitations.organization_id, authContext.org.id),
      ),
    });

    if (invitation.status !== "pending") {
      return actionError("Cannot resend: invitation is " + invitation.status);
    }

    // Generate new secure token
    const { token, hash } = generateInvitationToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Extend by 7 days

    // Update invitation with new token
    await db.update(invitations)
      .set({ token: hash, expires_at: expiresAt })
      .where(eq(invitations.id, validatedData.invitationId));

    // Send new invitation email
    await sendInvitationEmail({
      to: invitation.email,
      organizationName: authContext.org.name,
      token, // Plain token for email link
      expiresAt,
    });

    return actionSuccess(
      { success: true },
      `Invitation resent to ${invitation.email}`,
    );
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}
```

#### Usage in Client Components

**User Table Actions** (`src/app/settings/users/components/UserTableActions.tsx`):

```typescript
'use client';

import { useActionState } from "react";
import { resendInvitationAction } from "~/lib/actions/admin-actions";

export function UserTableActions({ user }: { user: AdminUserResponse }) {
  const [resendState, resendAction, isResending] = useActionState(
    resendInvitationAction,
    null,
  );

  // Show resend button only for pending invitations
  if (!user.emailVerified && user.invitationId) {
    return (
      <DropdownMenuItem
        onSelect={(e) => {
          e.preventDefault();
          const formData = new FormData();
          formData.set("invitationId", user.invitationId);
          void resendAction(formData);
        }}
        disabled={isResending}
      >
        <MailIcon className="mr-2 h-4 w-4" />
        {isResending ? "Sending..." : "Resend Invitation"}
      </DropdownMenuItem>
    );
  }

  return null;
}
```

### Security Features

1. **Token Regeneration**: Creates new cryptographically-secure token on resend
2. **Permission Checking**: Requires `USER_MANAGE` permission
3. **Status Validation**: Only allows resending pending invitations
4. **Organization Scoping**: Ensures invitation belongs to user's organization
5. **Activity Logging**: Records all resend actions for audit trail

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

**Next Review**: February 9, 2025

---

## Recent Updates (January 9, 2025)

### Server Component Authorization
- Added `src/lib/auth/server-permissions.ts` utilities for Server Components
- Implemented request-level caching with React 19 `cache()` API
- Replaced hardcoded permission checks with dynamic `checkPermission()` calls
- Added `getAuthPermissions()` for feature gating in issue creation

### Admin Actions
- Implemented `resendInvitationAction` Server Action
- Added token regeneration with extended expiration (7 days)
- Integrated with React 19 `useActionState` for form handling
- Updated `admin.getUsers` to include `invitationId` field

### Integration Tests
- Added comprehensive permission checking tests (`src/server/auth/__tests__/permissions.integration.test.ts`)
- Tests cover Admin, Member, and custom roles
- Validates permission dependencies are expanded correctly
