# Roles and Permissions Design

**Implementation Status**: ✅ **COMPLETED** in PR #130 (July 2025)  
**Current State**: See `docs/architecture/permissions-roles-implementation.md` for detailed implementation

## Overview

PinPoint uses a flexible Role-Based Access Control (RBAC) system that balances security, flexibility, and usability. The system distinguishes between system roles (hardcoded) and template-based roles (customizable per organization).

## Core Principles

1. **Admin Safety**: Always maintain at least one admin user per organization
2. **Permission Dependencies**: Higher permissions automatically include prerequisites
3. **Template-Based**: Organizations start with sensible defaults but can customize
4. **Progressive Enhancement**: Beta ships with essential roles, V1.0 adds flexibility

## Role Structure

### System Roles (Immutable)

#### 1. Unauthenticated User

- **Purpose**: Define what the public can see and do
- **Customizable**: Yes (admins can set permissions)
- **Cannot**: Be renamed or deleted
- **Default Permissions**:
  - `issue:view` - See public issues
  - `issue:create` - Report new issues
  - `attachment:create` - Upload photos with issues

#### 2. Admin

- **Purpose**: Full organization control
- **Customizable**: No (always has ALL permissions)
- **Cannot**: Be renamed, deleted, or have permissions modified
- **Enforcement**: At least one user must always have admin role

### Template-Based Roles

#### Beta Release (Single Template)

**Member** (Default for all new users)

- **Purpose**: Active organization members who manage issues
- **Default Permissions**:
  - All issue operations (`issue:*`)
  - View machines and locations
  - Create attachments
  - Basic profile management
- **Customizable**: Can be renamed, deleted, or modified after creation

#### V1.0 Release (Multiple Templates)

**Player** (Default for new users in V1.0)

- **Purpose**: Minimal permissions for casual users
- **Default Permissions**:
  - `issue:create`
  - `attachment:create`
  - View public data

**Member**

- **Purpose**: Regular members with moderate permissions
- **Default Permissions**: (Same as beta Member role)

**Technician**

- **Purpose**: Maintenance staff with extensive permissions
- **Default Permissions**:
  - All issue operations
  - Machine management
  - Location viewing
  - No admin functions

## Permission Dependencies

When granting permissions, the system automatically includes prerequisites:

```
issue:edit → issue:view
issue:delete → issue:view
issue:assign → issue:view
machine:edit → machine:view
machine:delete → machine:view
location:edit → location:view
location:delete → location:view
attachment:delete → attachment:view
```

## Implementation Plan

### Beta Release

1. Seed database with Unauthenticated and Admin system roles
2. Create Member template on organization creation
3. Auto-assign Member role to new users
4. No UI for permission management (use defaults)

### V1.0 Release

1. Add Player and Technician templates
2. Migrate existing Member roles (keep as-is)
3. Change default role for new users to Player
4. Implement permission management UI
5. Add "Create from template" functionality

## Database Schema Considerations

### Role Model

```typescript
{
  id: string
  name: string
  organizationId: string | null  // null for system roles
  isSystem: boolean              // true for Admin/Unauthenticated
  isDefault: boolean             // true for auto-assigned role
  permissions: Permission[]
}
```

### Organization Creation Flow

1. Create organization
2. Create system roles (Unauthenticated, Admin)
3. Create Member role from template (Beta) or Player role (V1.0)
4. Assign Admin role to creating user

## Security Considerations

1. **Admin Protection**: Prevent last admin removal through DB constraints
2. **Permission Validation**: Validate permission changes don't break core functionality
3. **Cascade Handling**: Deleting roles reassigns users to default role
4. **Audit Trail**: Log permission changes (V1.0+)

## API Design

### Key Procedures

- `organization.create` - Handles role template instantiation
- `role.update` - Modifies non-system roles
- `role.delete` - Removes non-system roles (with reassignment)
- `user.assignRole` - Changes user's role with admin validation

## Migration Strategy

### Beta → V1.0

1. Add new role templates to seed data
2. Update organization creation to offer template choice
3. Existing organizations keep current structure
4. Provide UI to create new roles from templates

## Future Considerations

See `/docs/planning/future-features/future-ideas.md` for:

- Location-scoped permissions
- Machine owner special permissions
- Advanced permission patterns
