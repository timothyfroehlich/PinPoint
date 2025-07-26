# User Profile Page Implementation Task

## Overview

Implement a comprehensive user profile page for PinPoint by adapting and modernizing the existing archived frontend components to work with the current Next.js App Router architecture.

## Context & Research Findings

### ✅ Strong Foundation Already Exists

- **Complete Implementation**: Archived profile page at `src/_archived_frontend/profile/page.tsx`
- **Backend APIs Ready**: All necessary tRPC endpoints implemented in `src/server/api/routers/user.ts`
- **Supporting Components**: `ProfilePictureUpload`, `UserAvatar`, image processing utilities
- **Current Architecture**: Next.js App Router, MUI v7, TypeScript strictest mode, tRPC multi-tenant

### Key APIs Available

- `api.user.getProfile.useQuery()` - User data with statistics, memberships, owned machines
- `api.user.updateProfile.useMutation()` - Update name and bio
- `api.user.uploadProfilePicture.useMutation()` - Image upload with processing

## Implementation Plan

### Phase 1: Route & Layout Setup

**Files to Create:**

- `src/app/profile/page.tsx` - Main profile page route
- `src/app/profile/layout.tsx` - Profile-specific layout (if needed)

**Requirements:**

- Use `AuthenticatedLayout` wrapper
- Follow App Router patterns
- Ensure proper TypeScript strictest compliance

### Phase 2: Component Migration & Modernization

**Component Migrations:**

1. **UserAvatar Component**
   - **Source**: `src/_archived_frontend/_components/user-avatar.tsx`
   - **Target**: `src/components/ui/UserAvatar.tsx`
   - **Updates**: Fix import paths, ensure current architecture compatibility

2. **ProfilePictureUpload Component**
   - **Source**: `src/_archived_frontend/_components/profile-picture-upload.tsx`
   - **Target**: `src/components/profile/ProfilePictureUpload.tsx`
   - **Updates**: Fix import paths, ensure proper integration

**Key Modernization Requirements:**

- Update MUI Grid from deprecated `Grid item xs={12}` to `Grid size={{ xs: 12, md: 4 }}`
- Fix all import paths from archived structure to current architecture
- Ensure TypeScript strictest mode compliance (no `any` types, proper null checks)
- Follow current component organization patterns

### Phase 3: Navigation Integration

**File to Modify:**

- `src/app/dashboard/_components/PrimaryAppBar.tsx`

**Implementation:**

- Add "Profile" menu item to user dropdown menu (currently only has "Logout")
- Use Next.js `useRouter()` for navigation to `/profile`
- Maintain existing responsive design patterns

**Navigation Flow:**

1. User clicks avatar in app bar
2. Dropdown shows: "Profile" and "Logout" options
3. "Profile" navigates to `/profile` page

### Phase 4: Profile Page Implementation

**Main Profile Page Features:**

1. **Profile Header Section**
   - Large avatar with edit functionality
   - User name, email, bio display
   - Join date with calendar icon
   - Edit Profile and Change Picture buttons

2. **Statistics Card**
   - Games owned count with icon
   - Issues reported count with icon
   - Comments posted count with icon

3. **Organizations Section**
   - List of user memberships
   - Role badges (Admin = primary color, others = default)
   - Handle empty state appropriately

4. **Owned Games Section**
   - Detailed machine information
   - Model name, manufacturer, release year
   - Location and room details
   - Handle empty state appropriately

5. **Edit Dialogs**
   - Profile editing modal (name, bio with character limit)
   - Picture upload modal with drag & drop
   - Proper loading states and error handling

**Technical Implementation Details:**

- Use `api.user.getProfile.useQuery()` for data fetching
- Handle loading states with `CircularProgress`
- Show error states with `Alert` components
- Implement optimistic UI updates where appropriate
- Use proper form validation and error handling

### Phase 5: Testing & Validation

**Required Checks:**

- Run `npm run quick` for development validation
- Run `npm run validate` for pre-commit checks
- Test responsive design across screen sizes
- Verify all navigation flows work correctly
- Test image upload functionality
- Validate profile editing workflows

## Technical Specifications

### TypeScript Requirements

- **Zero tolerance**: All TypeScript errors must be fixed (strictest mode)
- **No `any` types**: Use proper typing throughout
- **Null safety**: Use optional chaining and proper null checks
- **Array safety**: Check bounds before array access

### MUI v7 Patterns

```tsx
// ✅ Correct MUI v7 Grid usage
<Grid container spacing={3}>
  <Grid size={{ xs: 12, md: 4 }}>
    {/* Content */}
  </Grid>
</Grid>

// ❌ Deprecated Grid usage
<Grid container spacing={3}>
  <Grid item xs={12} md={4}>
    {/* Content */}
  </Grid>
</Grid>
```

### Import Path Updates

```tsx
// ✅ Current architecture imports
import { UserAvatar } from "~/components/ui/UserAvatar";
import { ProfilePictureUpload } from "~/components/profile/ProfilePictureUpload";
import { api } from "~/trpc/react";

// ❌ Archived imports (needs updating)
import { UserAvatar } from "~/app/_components/user-avatar";
import { ProfilePictureUpload } from "~/app/_components/profile-picture-upload";
```

### Code Quality Standards

- **ESLint**: All rules must pass, no `eslint-disable` comments
- **Prettier**: Auto-formatted code throughout
- **Component patterns**: Follow existing patterns in current codebase
- **Error handling**: Proper error boundaries and user feedback

## Success Criteria

### ✅ Navigation

- Profile link appears in user dropdown menu
- Navigation to `/profile` works correctly
- Breadcrumb or back navigation (if applicable)

### ✅ Profile Viewing

- User can view their complete profile information
- Statistics display correctly
- Organizations and roles show properly
- Owned games list with full details

### ✅ Profile Editing

- Edit profile modal opens and functions correctly
- Name and bio updates work with proper validation
- Character limits enforced (bio: 500 chars)
- Success/error feedback provided

### ✅ Image Upload

- Profile picture upload modal opens correctly
- Drag & drop functionality works
- Image processing and preview work properly
- Upload success/error handling implemented

### ✅ Responsive Design

- Layout works on mobile, tablet, and desktop
- Components adapt properly to different screen sizes
- Touch interactions work on mobile devices

### ✅ Code Quality

- All validation commands pass (`npm run quick`, `npm run validate`)
- TypeScript strictest mode compliance
- No ESLint errors or warnings
- Clean, readable, well-organized code

## Reference Files

### Key Source Files (Archived)

- `src/_archived_frontend/profile/page.tsx` - Main profile page implementation
- `src/_archived_frontend/_components/user-avatar.tsx` - Avatar component
- `src/_archived_frontend/_components/profile-picture-upload.tsx` - Upload component

### API Endpoints (Already Implemented)

- `src/server/api/routers/user.ts` - User-related tRPC procedures

### Current Architecture Examples

- `src/app/dashboard/page.tsx` - App Router page pattern
- `src/app/dashboard/_components/PrimaryAppBar.tsx` - Navigation component
- `src/components/permissions/` - Component organization pattern

### Documentation References

- `CLAUDE.md` - Project standards and commands
- `docs/architecture/current-state.md` - System architecture overview
- `docs/developer-guides/typescript-strictest-production.md` - TypeScript patterns

## Development Workflow

1. **Start**: Run `npm run validate` to ensure clean baseline
2. **Development**: Use `npm run quick` after significant changes
3. **Testing**: Validate functionality manually and with validation commands
4. **Pre-commit**: Run `npm run validate` before any commits (MANDATORY)
5. **Completion**: All success criteria met and validation passes

## Notes

- **Leverage Existing Work**: The archived implementation is comprehensive and well-designed
- **Focus on Adaptation**: Primary work is updating paths, imports, and MUI syntax
- **Architecture Compliance**: Follow current patterns and TypeScript standards
- **User Experience**: Maintain responsive design and proper error handling
- **Code Quality**: Zero tolerance for TypeScript errors or ESLint violations

This task leverages substantial existing work while ensuring it integrates seamlessly with the current PinPoint architecture and coding standards.
