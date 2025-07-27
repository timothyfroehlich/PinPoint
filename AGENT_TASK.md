# Task: machine-page-implementation

## 🎯 Objective

Implement a comprehensive machine listing page (`/machines`) that allows users to view, manage, and interact with pinball machines within their organization following existing design patterns and leveraging complete backend API infrastructure.

## 📋 Requirements Overview

### Core Functionality

- **Machine List Display**: Card-based grid layout showing all organization machines
- **Permission-Based Actions**: Role-based create/edit/delete capabilities
- **Location Management**: Display machine locations with proper icons
- **Owner Assignment**: Show machine owners with avatars
- **Responsive Design**: Works across all screen sizes

### Target Implementation

- **Primary Route**: `/machines` (machine list page)
- **Components**: MachineList, MachineCard components

## 🏗️ Technical Architecture

### Backend APIs Available

**Primary API**: `api.machine.core.getAll`

- **File**: `src/server/api/routers/machine.core.ts:85-103`
- **Returns**: All machines for organization with full relations
- **Includes**: model, location, owner (with avatar data)

**Additional APIs Ready**:

- `api.machine.core.create` - Create new machine
- `api.machine.core.update` - Update machine properties
- `api.machine.core.delete` - Delete machine (admin only)

### Frontend Patterns to Follow

- **Reference**: `src/app/dashboard/_components/DetailedIssueCard.tsx`
- **Card Structure**: MUI Card with left border for visual hierarchy
- **Typography**: Consistent with existing components
- **Color Scheme**: Use existing theme colors (`#667eea`, etc.)

### Permission Matrix

```typescript
interface MachinePermissions {
  "machines:view": ["admin", "technician", "member"]; // View all machines
  "machines:create": ["admin", "technician"]; // Add new machines
  "machines:edit": ["admin", "technician"]; // Edit machine details
  "machines:delete": ["admin"]; // Delete machines
}
```

## 🎨 Design Specifications

### Visual Design Pattern

**Follow Current Dashboard Patterns**:

- **Card Structure**: MUI Card with left border for visual hierarchy
- **Typography**: Consistent with existing components
- **Color Scheme**: Use existing theme colors (`#667eea`, etc.)

### Layout Structure

```
📱 Machine List Page Layout:
┌─────────────────────────────────────┐
│ [Header] Machines        [+ Add]    │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ │
│ │Machine 1│ │Machine 2│ │Machine 3│ │
│ │Model    │ │Model    │ │Model    │ │
│ │Location │ │Location │ │Location │ │
│ │Owner    │ │Owner    │ │Owner    │ │
│ └─────────┘ └─────────┘ └─────────┘ │
└─────────────────────────────────────┘
```

### Component Architecture

```typescript
// Machine list component with tRPC data fetching
interface MachineWithRelations {
  id: string;
  name: string;
  model: { name: string };
  location: { id: string; name: string };
  owner?: { id: string; name: string; image: string };
}
```

## 📚 Reference Documentation

### Backend API Analysis

- **Machine Router**: `src/server/api/routers/machine.ts` - Main router setup
- **Core Machine API**: `src/server/api/routers/machine.core.ts` - All CRUD operations
- **Permission System**: `src/server/api/trpc.permission.ts` - Permission procedures

### Frontend Pattern References

- **Dashboard Components**: `src/app/dashboard/_components/` - Current UI patterns
- **Issue Card Design**: `src/app/dashboard/_components/DetailedIssueCard.tsx` - Card layout reference
- **AppBar Pattern**: `src/app/dashboard/_components/PrimaryAppBar.tsx` - Navigation structure
- **Permission Components**: `src/components/permissions/` - Permission-based UI

### Architecture Documentation

- **Current State**: `docs/architecture/current-state.md` - System overview
- **Permission System**: `docs/architecture/permissions-roles-implementation.md` - RBAC details

## 🔨 Implementation Steps

### Step 1: Create Base Page Structure

**File**: `src/app/machines/page.tsx`
**Requirements**:

- Implement container layout with proper spacing
- Add page header with title and conditional "Add Machine" button
- Include permission-based action visibility using `usePermissions()` hook

### Step 2: Implement Machine List Component

**File**: `src/app/machines/components/MachineList.tsx`
**Requirements**:

- Fetch machines using `api.machine.core.getAll`
- Display loading and error states
- Implement responsive grid layout using MUI Grid v7 syntax
- Handle empty state gracefully

### Step 3: Create Machine Card Component

**File**: `src/app/machines/components/MachineCard.tsx`
**Requirements**:

- Follow DetailedIssueCard pattern for consistency
- Display machine name, model, location, and owner
- Use proper TypeScript types from tRPC router outputs
- Add visual indicators and hover effects

## 🧪 Testing Requirements

### Component Testing

- Machine list renders correctly with mock data
- Permission-based features show/hide appropriately
- Error states display correctly

### Integration Testing

- tRPC integration functions correctly
- Permission system enforces rules correctly

## ✅ Success Criteria

### Functional Requirements

- [ ] Users can view all machines in their organization
- [ ] Permission-based actions work correctly (create/edit/delete visibility)
- [ ] Machine information displays clearly (name, model, location, owner)
- [ ] Responsive design works across all screen sizes

### Technical Requirements

- [ ] Zero TypeScript errors (strictest mode compliance)
- [ ] All ESLint rules pass: `npm run validate`
- [ ] All tests pass: `npm run test`
- [ ] Follows existing code patterns and conventions

### User Experience Requirements

- [ ] Consistent with existing PinPoint design patterns
- [ ] Proper error handling and loading states
- [ ] Mobile-responsive interface

## 🔗 API Integration Details

### Primary Data Fetching

```typescript
// Main machine list query
const { data: machines, isLoading, error } = api.machine.core.getAll.useQuery();

// Expected data structure from API
type MachineWithRelations = RouterOutputs["machine"]["core"]["getAll"][number];
```

## 🎨 Design System Integration

### Color Palette

- **Primary Action**: `#667eea` (existing button color)
- **Border Accents**: Follow priority color patterns from DetailedIssueCard

### Typography Patterns

```typescript
// Follow existing patterns from DetailedIssueCard
<Typography variant="h6" fontWeight="medium">Machine Name</Typography>
<Typography variant="body2" color="text.secondary">Model • Location</Typography>
```

### Icon Usage

- **Add**: `<Add />` for creation actions
- **Location**: `<PlaceIcon />` for location indicators
- **Person**: `<Person />` for owner information

## 🚀 Development Environment

### Worktree Information

- **Path**: `/home/froeht/Code/PinPoint-worktrees/machine-page-implementation`
- **Branch**: `task/machine-page-implementation`
- **Database**: Shared local PostgreSQL database (`postgresql://postgres:r9D6fQc2lbEiS_hI@localhost:5432/pinpoint`)
- **Dev Server**: Port 59111

### Available Commands

```bash
npm run dev          # Start development server
npm run validate     # Run all quality checks
npm run typecheck    # TypeScript validation
npm run test        # Run test suite
```

## 📖 Additional Context

### Business Logic Notes

- **Machine Names**: Can be custom or default to model name
- **Organization Scoping**: All APIs are automatically scoped to user's organization
- **Owner Assignment**: Optional feature for tracking machine ownership

### Future Considerations

- **Machine Detail Pages**: `/machines/[id]` will be implemented later
- **Advanced Filtering**: Basic functionality first, enhancement later

---

## 📝 Implementation Notes

This task builds upon the complete backend infrastructure that's already implemented. The focus is on creating a polished, permission-aware frontend that integrates seamlessly with existing PinPoint patterns.

**Priority**: Implement basic functionality first (view/list), then add creation/editing features. Ensure each step follows the established design patterns and passes all quality checks before proceeding.
