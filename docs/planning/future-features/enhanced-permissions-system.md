# Enhanced Permissions System (DRAFT)

**Status**: Draft Proposal  
**Last Updated**: 2025-01-16  
**Author**: Tim Froehlich

> **Note**: This is a draft proposal for a future enhancement to PinPoint's permission system. Implementation details may change based on technical constraints and user feedback.

## Overview

This proposal outlines an enhanced permission system that provides granular control over user actions while supporting both authenticated and unauthenticated users. The system simplifies permission management by establishing implicit ownership rights while requiring explicit permissions only for elevated actions.

## Core Design Principles

1. **Implicit Ownership Rights**: Users can always edit/delete their own content without explicit permissions
2. **Explicit Permissions for Elevated Actions**: Permissions only control actions on other users' content or system features
3. **Simplified Mental Model**: Reduces permission checks for common operations

## Permission Structure

### Implicit Rights (No Permission Required)

- Edit/delete your own comments
- Edit/delete your own attachments
- Edit title of issues you created

### Explicit Permissions

```typescript
// Issue permissions

"issue:edit"; // Edit ANY issue (all fields except comments)
"issue:delete"; // Delete ANY issue
"issue:confirm"; // Toggle issue confirmation status

// Comment permissions (for OTHER users' comments only)
"comment:edit"; // Edit other users' comments
"comment:delete"; // Delete other users' comments (except first)

// Attachment permissions
"attachment:create"; // Upload attachments
"attachment:delete"; // Delete other users' attachments

// System permissions
"organization:manage"; // Organization settings
"role:manage"; // Create/edit/delete roles
"user:manage"; // User management
```

## Default Roles

| Permission          | Unauthenticated | User | Technician | Admin |
| ------------------- | --------------- | ---- | ---------- | ----- |
| **Issues**          |

| issue:edit          | ✗               | ✗    | ✓          | ✓     |
| issue:delete        | ✗               | ✗    | ✗          | ✓     |
| issue:confirm       | ✗               | ✗    | ✓          | ✓     |
| **Comments**        |
| comment:edit        | ✗               | ✗    | ✗          | ✓     |
| comment:delete      | ✗               | ✗    | ✗          | ✓     |
| **Attachments**     |
| attachment:create   | ✗               | ✓    | ✓          | ✓     |
| attachment:delete   | ✗               | ✗    | ✗          | ✓     |
| **System**          |
| organization:manage | ✗               | ✗    | ✗          | ✓     |
| role:manage         | ✗               | ✗    | ✗          | ✓     |
| user:manage         | ✗               | ✗    | ✗          | ✓     |

### Role Descriptions

- **Unauthenticated**: Anonymous users who can report basic issues
- **User**: Authenticated users (players) who can report issues and add attachments
- **Technician**: Trusted users who can manage issues and access full creation forms
- **Admin**: Full system access including role and user management

## System Roles

Two special system roles exist:

1. **system:unauthenticated**
   - Permissions configurable by org admins
   - Cannot be deleted
   - Default: Basic issue creation and commenting

2. **system:org-admin**
   - Has all permissions (wildcard)
   - Cannot be edited or deleted
   - Automatically assigned to organization creators

## Issue Confirmation Workflow

### Database Schema Addition

```prisma
model Issue {
  // ... existing fields ...

  isConfirmed   Boolean   @default(false)
  confirmedAt   DateTime?
  confirmedById String?
  confirmedBy   User?     @relation("ConfirmedIssues", fields: [confirmedById], references: [id])
}
```

### Confirmation Logic

- Issues via **basic form**: Always create as `isConfirmed = false`
- Issues via **full form**: Default to `isConfirmed = true` (but editable)
- Users with `issue:confirm` permission can toggle status
- Visual indicators for unconfirmed issues (badges, different styling)

## Special Rules

1. **First Comment Protection**: The first comment (issue description) cannot be deleted by anyone
2. **Self-Edit Limitations**: When editing own issues, users can only change the title
3. **Form-Based Confirmation**: Form type determines default confirmation status

## Permission Checking Examples

```typescript
// Can user edit this issue?
function canEditIssue(user: User | null, issue: Issue): boolean {
  if (!user) return false;

  // Own issue? Can edit title only (implicit right)
  if (issue.creatorId === user.id) return true;

  // Has edit permission? Can edit everything
  return hasPermission(user, "issue:edit");
}

// Can user delete this comment?
function canDeleteComment(user: User | null, comment: Comment): boolean {
  // First comment is protected
  if (comment.index === 0) return false;

  if (!user) return false;

  // Own comment? Implicit right
  if (comment.authorId === user.id) return true;

  // Otherwise need explicit permission
  return hasPermission(user, "comment:delete");
}
```

## Admin Interface Requirements

### Role Management Page

1. **Role List**
   - Show all roles with member counts
   - Indicate system roles
   - Edit/Delete actions where allowed

2. **Permission Editor**
   - Checkbox grid organized by resource type
   - Clear permission descriptions
   - Save/Cancel functionality

3. **Unauthenticated Configuration**
   - Special section for anonymous permissions
   - Security warnings
   - Common presets

## Implementation Considerations

### Security

- Rate limiting essential for unauthenticated actions
- Consider CAPTCHA for anonymous issue creation
- Audit trail for permission changes

### Migration

- Convert existing Admin/Player roles
- Set existing issues as confirmed
- Feature flag for gradual rollout

### Future Enhancements

- Permission groups/bundles
- Location-specific permissions
- Time-limited permission grants
- API tokens with custom permissions
