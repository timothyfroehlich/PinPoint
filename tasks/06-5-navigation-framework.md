# Task 6.5: Navigation Framework

**Status**: ⏳ PENDING
**Branch**: `feat/navigation-framework`
**Dependencies**: Task 6 (Authentication Pages)

## Objective

Top navigation bar with user menu, logo, auth state handling, and quick links for authenticated users.

## Acceptance Criteria

- [ ] Unauthenticated users see Sign In/Sign Up buttons
- [ ] Authenticated users see quick links and user menu
- [ ] User avatar displays with initials fallback
- [ ] User menu opens and closes correctly
- [ ] All navigation links work
- [ ] Logout works from user menu
- [ ] Works on mobile (responsive, may hide some quick links)
- [ ] All tests pass

## Tasks

### Navigation Component

- [ ] Create `src/components/layout/navigation.tsx` (Server Component)
  - Fetch auth user in component
  - Conditional rendering based on auth state
  - Use Material Design 3 colors from globals.css

### Unauthenticated Navigation

- [ ] Unauthenticated state shows:
  - "PinPoint" logo/text (links to /)
  - Sign In button (links to /auth/login)
  - Sign Up button (links to /auth/signup)
  - Use `bg-surface` and `border-outline-variant`

### Authenticated Navigation

- [ ] Authenticated state shows:
  - "PinPoint" logo/text (links to /dashboard)
  - Quick Links section (center):
    - Issues button (links to /issues) - AlertTriangleIcon
    - Report Issue button (links to /issues/new) - PlusIcon
    - Machines button (links to /machines) - WrenchIcon
  - User section (right):
    - User name display
    - User avatar (use shadcn Avatar component)
    - User dropdown menu (see below)
  - Use `bg-primary-container` with `text-on-primary-container`

### User Menu Component

- [ ] Create `src/components/layout/user-menu-client.tsx` (Client Component)
  - Use shadcn DropdownMenu
  - Avatar trigger with ChevronDown icon
  - Menu items:
    - Profile (UserIcon) - links to /profile (future)
    - Settings (SettingsIcon) - links to /settings (future)
    - Separator
    - Sign Out (LogOutIcon, text-error) - form with logout Server Action

### Root Layout Integration

- [ ] Update `src/app/layout.tsx`
  - Import Navigation component
  - Place above main content
  - Pass auth context (from server)
- [ ] Install lucide-react icons if not installed
  - `npm install lucide-react`

### Pattern Documentation

- [ ] Update `docs/PATTERNS.md`
  - Navigation auth state pattern
  - Server Component + Client Component composition
  - User menu dropdown pattern

### Tests

- [ ] Integration test: Navigation renders correctly for unauthenticated user
- [ ] Integration test: Navigation renders correctly for authenticated user
- [ ] E2E test: User menu dropdown works
- [ ] E2E test: Logout from user menu works

## Key Decisions

_To be filled during task execution_

## Problems Encountered

_To be filled during task execution_

## Lessons Learned

_To be filled during task execution_

## Updates for CLAUDE.md

_To be filled after completion - what future agents need to know_
