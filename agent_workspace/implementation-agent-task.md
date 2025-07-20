# Task: Implementation Agent - Roles and Permissions System

## Mission Statement
Implement the roles and permissions system to make all tests pass. Build a flexible RBAC system with system roles, template roles, and permission dependencies for beta release.

## Context
- Tests written by test agent are currently failing
- Implementing design from `/docs/design-docs/roles-permissions-design.md`
- Beta focus: System roles + Member template
- Must maintain database integrity (always one admin)
- Permission dependencies auto-include prerequisites
- Use service factory pattern

## Implementation Steps

### 1. Review Failing Tests
- Run `npm run test` to understand requirements
- Map test requirements to implementation tasks
- Identify schema changes needed

### 2. Database Schema Updates

#### Update Prisma Schema
Add to `prisma/schema.prisma`:
```prisma
model Role {
  id              String    @id @default(cuid())
  name            String
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  isSystem        Boolean   @default(false)  // true for Admin/Unauthenticated
  isDefault       Boolean   @default(false)  // true for auto-assigned role
  permissions     Json      // Array of permission strings
  members         Member[]
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@unique([organizationId, name])
  @@index([organizationId])
}

// Update Member model
model Member {
  // ... existing fields ...
  roleId          String?
  role            Role?     @relation(fields: [roleId], references: [id])
  
  @@index([roleId])
}
```

Run migrations:
```bash
npm run db:push
```

### 3. Permission Constants
Create `src/server/auth/permissions.constants.ts`:
```typescript
export const PERMISSIONS = {
  // Issues
  ISSUE_VIEW: 'issue:view',
  ISSUE_CREATE: 'issue:create',
  ISSUE_EDIT: 'issue:edit',
  ISSUE_DELETE: 'issue:delete',
  ISSUE_ASSIGN: 'issue:assign',
  ISSUE_BULK_MANAGE: 'issue:bulk_manage',
  
  // Machines
  MACHINE_VIEW: 'machine:view',
  MACHINE_CREATE: 'machine:create',
  MACHINE_EDIT: 'machine:edit',
  MACHINE_DELETE: 'machine:delete',
  
  // Locations
  LOCATION_VIEW: 'location:view',
  LOCATION_CREATE: 'location:create',
  LOCATION_EDIT: 'location:edit',
  LOCATION_DELETE: 'location:delete',
  
  // Attachments
  ATTACHMENT_VIEW: 'attachment:view',
  ATTACHMENT_CREATE: 'attachment:create',
  ATTACHMENT_DELETE: 'attachment:delete',
  
  // Admin
  ADMIN_MANAGE_USERS: 'admin:manage_users',
  ADMIN_MANAGE_ROLES: 'admin:manage_roles',
  ADMIN_VIEW_ANALYTICS: 'admin:view_analytics',
} as const;

export const PERMISSION_DEPENDENCIES: Record<string, string[]> = {
  [PERMISSIONS.ISSUE_EDIT]: [PERMISSIONS.ISSUE_VIEW],
  [PERMISSIONS.ISSUE_DELETE]: [PERMISSIONS.ISSUE_VIEW],
  [PERMISSIONS.ISSUE_ASSIGN]: [PERMISSIONS.ISSUE_VIEW],
  [PERMISSIONS.MACHINE_EDIT]: [PERMISSIONS.MACHINE_VIEW],
  [PERMISSIONS.MACHINE_DELETE]: [PERMISSIONS.MACHINE_VIEW],
  [PERMISSIONS.LOCATION_EDIT]: [PERMISSIONS.LOCATION_VIEW],
  [PERMISSIONS.LOCATION_DELETE]: [PERMISSIONS.LOCATION_VIEW],
  [PERMISSIONS.ATTACHMENT_DELETE]: [PERMISSIONS.ATTACHMENT_VIEW],
};

export const SYSTEM_ROLES = {
  ADMIN: 'Admin',
  UNAUTHENTICATED: 'Unauthenticated',
} as const;

export const ROLE_TEMPLATES = {
  MEMBER: {
    name: 'Member',
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
  // V1.0 templates (commented for now)
  // PLAYER: { ... },
  // TECHNICIAN: { ... },
};
```

### 4. Role Service Implementation
Create `src/server/services/roleService.ts`:
```typescript
import { PrismaClient, Role } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { 
  PERMISSIONS, 
  PERMISSION_DEPENDENCIES, 
  SYSTEM_ROLES,
  ROLE_TEMPLATES 
} from '../auth/permissions.constants';

export class RoleService {
  constructor(
    private prisma: PrismaClient,
    private organizationId: string
  ) {}

  async createSystemRoles(): Promise<void> {
    // Create Admin role (immutable, all permissions)
    await this.prisma.role.create({
      data: {
        name: SYSTEM_ROLES.ADMIN,
        organizationId: this.organizationId,
        isSystem: true,
        isDefault: false,
        permissions: Object.values(PERMISSIONS), // All permissions
      },
    });

    // Create Unauthenticated role (customizable permissions)
    await this.prisma.role.create({
      data: {
        name: SYSTEM_ROLES.UNAUTHENTICATED,
        organizationId: this.organizationId,
        isSystem: true,
        isDefault: false,
        permissions: [
          PERMISSIONS.ISSUE_VIEW,
          PERMISSIONS.ISSUE_CREATE,
          PERMISSIONS.ATTACHMENT_CREATE,
        ],
      },
    });
  }

  async createTemplateRole(template: keyof typeof ROLE_TEMPLATES): Promise<Role> {
    const roleTemplate = ROLE_TEMPLATES[template];
    
    return this.prisma.role.create({
      data: {
        name: roleTemplate.name,
        organizationId: this.organizationId,
        isSystem: false,
        isDefault: true, // Auto-assign to new users
        permissions: this.addPermissionDependencies(roleTemplate.permissions),
      },
    });
  }

  async updateRole(roleId: string, updates: Partial<Role>): Promise<Role> {
    // Check if role is system role
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new TRPCError({ code: 'NOT_FOUND' });
    }

    if (role.isSystem) {
      if (role.name === SYSTEM_ROLES.ADMIN) {
        throw new TRPCError({ 
          code: 'FORBIDDEN',
          message: 'Admin role cannot be modified',
        });
      }
      // Only allow permission updates for Unauthenticated
      if (updates.name || updates.isDefault !== undefined) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'System roles cannot be renamed or have defaults changed',
        });
      }
    }

    // Add permission dependencies if updating permissions
    if (updates.permissions && Array.isArray(updates.permissions)) {
      updates.permissions = this.addPermissionDependencies(updates.permissions);
    }

    return this.prisma.role.update({
      where: { id: roleId },
      data: updates,
    });
  }

  async deleteRole(roleId: string): Promise<void> {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: { members: true },
    });

    if (!role) {
      throw new TRPCError({ code: 'NOT_FOUND' });
    }

    if (role.isSystem) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'System roles cannot be deleted',
      });
    }

    // Find default role for reassignment
    const defaultRole = await this.prisma.role.findFirst({
      where: {
        organizationId: this.organizationId,
        isDefault: true,
        id: { not: roleId },
      },
    });

    if (!defaultRole) {
      throw new TRPCError({
        code: 'FAILED_PRECONDITION',
        message: 'No default role available for user reassignment',
      });
    }

    // Reassign all members to default role
    await this.prisma.member.updateMany({
      where: { roleId },
      data: { roleId: defaultRole.id },
    });

    // Delete the role
    await this.prisma.role.delete({
      where: { id: roleId },
    });
  }

  private addPermissionDependencies(permissions: string[]): string[] {
    const allPermissions = new Set(permissions);

    // Add all dependencies
    permissions.forEach(permission => {
      const deps = PERMISSION_DEPENDENCIES[permission];
      if (deps) {
        deps.forEach(dep => allPermissions.add(dep));
      }
    });

    return Array.from(allPermissions);
  }

  async ensureAtLeastOneAdmin(): Promise<void> {
    const adminRole = await this.prisma.role.findFirst({
      where: {
        organizationId: this.organizationId,
        name: SYSTEM_ROLES.ADMIN,
      },
      include: { members: true },
    });

    if (!adminRole || adminRole.members.length === 0) {
      throw new TRPCError({
        code: 'FAILED_PRECONDITION',
        message: 'Organization must have at least one admin',
      });
    }
  }
}
```

### 5. Permission Service Updates
Update `src/server/auth/permissions.ts`:
```typescript
import { Session } from 'next-auth';
import { prisma } from '../db';
import { PERMISSIONS, SYSTEM_ROLES } from './permissions.constants';

export async function hasPermission(
  session: Session | null,
  permission: string,
  organizationId?: string
): Promise<boolean> {
  // Unauthenticated users
  if (!session?.user) {
    const unauthRole = await prisma.role.findFirst({
      where: {
        organizationId: organizationId || session?.user.organizationId,
        name: SYSTEM_ROLES.UNAUTHENTICATED,
      },
    });
    
    const permissions = (unauthRole?.permissions as string[]) || [];
    return permissions.includes(permission);
  }

  // Get user's member record with role
  const member = await prisma.member.findUnique({
    where: {
      userId_organizationId: {
        userId: session.user.id,
        organizationId: organizationId || session.user.organizationId,
      },
    },
    include: { role: true },
  });

  if (!member?.role) {
    return false;
  }

  // Admin role always has all permissions
  if (member.role.name === SYSTEM_ROLES.ADMIN) {
    return true;
  }

  // Check specific permission
  const permissions = (member.role.permissions as string[]) || [];
  return permissions.includes(permission);
}

export async function requirePermission(
  session: Session | null,
  permission: string,
  organizationId?: string
): Promise<void> {
  const hasAccess = await hasPermission(session, permission, organizationId);
  if (!hasAccess) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Missing required permission: ${permission}`,
    });
  }
}
```

### 6. Organization Service Updates
Update organization creation in `src/server/services/organizationService.ts`:
```typescript
async createOrganization(input: CreateOrganizationInput, userId: string) {
  return await this.prisma.$transaction(async (tx) => {
    // Create organization
    const organization = await tx.organization.create({
      data: {
        name: input.name,
        // ... other fields
      },
    });

    // Create role service for this org
    const roleService = new RoleService(tx, organization.id);
    
    // Create system roles
    await roleService.createSystemRoles();
    
    // Create default Member role
    const memberRole = await roleService.createTemplateRole('MEMBER');
    
    // Get admin role
    const adminRole = await tx.role.findFirst({
      where: {
        organizationId: organization.id,
        name: SYSTEM_ROLES.ADMIN,
      },
    });

    // Create member record for creator as admin
    await tx.member.create({
      data: {
        userId,
        organizationId: organization.id,
        roleId: adminRole!.id,
      },
    });

    return organization;
  });
}
```

### 7. Update Seed Data
Update `prisma/seed.ts` to use new role system:
```typescript
// Remove old permission-based seeding
// Add role-based member creation

const memberRole = await prisma.role.findFirst({
  where: {
    organizationId: org.id,
    isDefault: true,
  },
});

// Create members with roles
await prisma.member.create({
  data: {
    userId: user.id,
    organizationId: org.id,
    roleId: memberRole!.id,
  },
});
```

### 8. API Router Implementation
Create `src/server/api/routers/role.ts`:
```typescript
export const roleRouter = createTRPCRouter({
  list: protectedProcedure
    .query(async ({ ctx }) => {
      await requirePermission(ctx.session, PERMISSIONS.ADMIN_MANAGE_ROLES);
      
      return ctx.prisma.role.findMany({
        where: { organizationId: ctx.session.user.organizationId },
        include: {
          _count: {
            select: { members: true },
          },
        },
        orderBy: [
          { isSystem: 'desc' },
          { name: 'asc' },
        ],
      });
    }),

  update: protectedProcedure
    .input(z.object({
      roleId: z.string(),
      updates: z.object({
        name: z.string().optional(),
        permissions: z.array(z.string()).optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.session, PERMISSIONS.ADMIN_MANAGE_ROLES);
      
      const roleService = ctx.services.createRoleService();
      return roleService.updateRole(input.roleId, input.updates);
    }),

  delete: protectedProcedure
    .input(z.object({ roleId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.session, PERMISSIONS.ADMIN_MANAGE_ROLES);
      
      const roleService = ctx.services.createRoleService();
      await roleService.deleteRole(input.roleId);
    }),
});
```

### 9. Complete Playwright Tests
Update the scaffolded E2E tests:
1. Add authentication helpers
2. Add data-testid attributes to UI components
3. Remove test.skip() and test.fixme() flags
4. Implement permission management UI components

### 10. Service Factory Updates
Add to `src/server/services/serviceFactory.ts`:
```typescript
createRoleService(): RoleService {
  return new RoleService(this.prisma, this.organizationId);
}
```

## Quality Requirements
- All tests must pass
- Maintain data integrity (always one admin)
- Permission dependencies work correctly
- Clean transaction handling
- Proper error messages
- Type safety throughout

## Success Criteria
- [ ] All unit tests passing
- [ ] Database schema updated
- [ ] System roles created on org creation
- [ ] Template roles working
- [ ] Permission checks integrated
- [ ] Role management API complete
- [ ] Seed data updated
- [ ] Playwright tests completed
- [ ] Pre-commit hooks pass

## Completion Instructions
When your task is complete:
1. Run `npm run validate` - must pass
2. Run `npm run test` - all tests pass
3. Run `npm run db:reset` - seed data works
4. Test organization creation flow manually
5. Commit: `git commit -m "feat: implement RBAC system with system and template roles"`
6. Push: `git push`
7. Create PR: `gh pr create --title "feat: implement roles and permissions system" --body "Implements flexible RBAC with system roles and templates"`
8. Wait for CI to pass
9. Notify the orchestrator - DO NOT clean up the worktree yourself