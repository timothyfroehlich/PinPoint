# PinPoint Frontend Rebuild Roadmap

## Overview

This document outlines the comprehensive plan for rebuilding the PinPoint frontend using modern Next.js App Router patterns while preserving the current appealing styling and focusing on core functionality first.

## Current State Analysis

### Frontend Strengths to Preserve

- **Dark Theme**: Purple/blue accent (`#667eea`) with dark navy background (`#1a1a2e`)
- **Clean Material UI v7**: Modern MUI implementation with proper Grid syntax
- **Issue Cards**: Priority-based colored borders and hover effects
- **Responsive Design**: Proper breakpoints and mobile-first approach
- **Component Structure**: Well-organized layout with `PrimaryAppBar` and card-based design

### Backend Infrastructure (Ready)

- **Complete tRPC API**: All routers implemented (user, issue, machine, organization, location)
- **Multi-tenant Architecture**: Organization-scoped queries with row-level security
- **Authentication**: NextAuth v5 with Google OAuth and development login
- **Type Safety**: End-to-end TypeScript with Prisma ORM
- **Notification System**: Backend ready for real-time updates

### Archived Frontend Analysis

The archived frontend provides excellent patterns for:

- Issue management workflows (submission, detail view, timeline)
- Real-time updates with optimistic UI
- File upload and gallery components
- Multi-tenant navigation patterns
- Role-based permission handling

## Implementation Strategy

### Core Principles

1. **Preserve Visual Identity**: Keep current theme, layout, and component styling
2. **Incremental Delivery**: Each phase delivers working functionality
3. **Quality First**: All TypeScript/ESLint validation must pass
4. **Modern Patterns**: Use Next.js App Router, MUI v7, and current React patterns
5. **Backend Integration**: Connect to existing tRPC APIs for real data

### Phase-Based Approach

## Phase 1: Authentication Foundation (3-5 days)

**Priority**: Critical - Required for all subsequent phases

### Goals

- Replace mock authentication with real NextAuth integration
- Implement proper session management and organization context
- Add authentication guards to protected routes
- Create user profile components and navigation

### Deliverables

- Real authentication flow with Google OAuth
- Session-based user context throughout app
- Protected route middleware
- User profile display in app bar
- Organization context management

### Success Criteria

- Users can sign in with Google OAuth
- Session persists across page reloads
- Dashboard shows real user data
- Navigation reflects authentication state

## Phase 2: Core Issue Management (7-10 days)

**Priority**: High - Core application functionality

### Goals

- Create comprehensive issues list with filtering/sorting
- Implement detailed issue view with timeline and comments
- Build issue creation form with machine selection
- Connect all components to tRPC APIs

### Deliverables

- `/issues` page with real data from API
- `/issues/[id]` page with full issue details
- Issue creation form with image upload
- Real-time updates and optimistic UI
- Machine selection and filtering

### Success Criteria

- Users can view, create, and manage issues
- All issue data comes from backend APIs
- UI updates reflect real-time changes
- Image uploads work correctly

## Phase 3: Dashboard Enhancement (3-5 days)

**Priority**: Medium - User experience improvement

### Goals

- Replace mock dashboard data with real queries
- Make navigation buttons functional
- Add proper loading states and error handling
- Implement breadcrumb navigation

### Deliverables

- Dashboard with real user statistics
- Functional navigation to all major sections
- Loading states and error boundaries
- Breadcrumb navigation system

### Success Criteria

- Dashboard shows real user's assigned issues
- Navigation buttons work correctly
- Loading states provide good UX
- Error handling is user-friendly

## Phase 4: User & Organization Features (5-7 days)

**Priority**: Low - Administrative features

### Goals

- Implement user profile editing
- Add organization management interface
- Create games and locations views
- Build admin functionality

### Deliverables

- User profile page with editing capabilities
- Organization settings interface
- Games/machines listing and management
- Location management interface

### Success Criteria

- Users can edit their profiles
- Admins can manage organization settings
- All CRUD operations work correctly
- Role-based permissions are enforced

## Technical Architecture

### Component Architecture

```
src/app/
├── (auth)/              # Authentication pages
│   ├── signin/
│   └── signup/
├── dashboard/           # Main dashboard
├── issues/             # Issue management
│   ├── [id]/           # Issue detail
│   └── new/            # Create issue
├── machines/           # Machine management
├── locations/          # Location management
├── profile/            # User profile
└── admin/              # Admin interfaces
```

### Key Technologies

- **Next.js 14**: App Router with server components
- **Material UI v7**: Latest version with updated patterns
- **tRPC**: Type-safe API communication
- **NextAuth.js**: Authentication and session management
- **Prisma**: Database ORM with multi-tenancy
- **TypeScript**: Strict typing throughout

### Data Flow

1. **Authentication**: NextAuth session → tRPC context
2. **Organization Context**: Subdomain → organization lookup
3. **API Calls**: tRPC queries/mutations with automatic org scoping
4. **UI Updates**: Optimistic updates with query invalidation
5. **Real-time**: WebSocket integration for live updates (future)

## Quality Standards

### Code Quality

- **0 TypeScript errors**: All types properly defined
- **0 ESLint errors**: Consistent code style
- **Test Coverage**: Unit tests for all components
- **Accessibility**: WCAG 2.1 compliance
- **Performance**: Lighthouse scores >90

### User Experience

- **Responsive Design**: Mobile-first approach
- **Loading States**: Skeleton screens and progress indicators
- **Error Handling**: User-friendly error messages
- **Offline Support**: Service worker for basic functionality

## Migration Strategy

### From Archived Frontend

1. **Extract Components**: Reuse issue management components
2. **Adapt Styling**: Update to current theme while preserving functionality
3. **Update APIs**: Connect to new tRPC endpoints
4. **Modernize Patterns**: Use App Router and latest React patterns

### Testing Strategy

1. **Unit Tests**: All components and hooks
2. **Integration Tests**: API connections and data flow
3. **E2E Tests**: Critical user journeys
4. **Accessibility Tests**: Screen reader compatibility

## Success Metrics

### Phase 1 Success

- [ ] Real authentication working
- [ ] User sessions persist
- [ ] Organization context established
- [ ] Protected routes enforced

### Phase 2 Success

- [ ] Issues list showing real data
- [ ] Issue creation and editing working
- [ ] Image uploads functional
- [ ] Real-time updates implemented

### Phase 3 Success

- [ ] Dashboard showing real statistics
- [ ] Navigation fully functional
- [ ] Loading states implemented
- [ ] Error handling comprehensive

### Phase 4 Success

- [ ] User profile editing complete
- [ ] Organization management functional
- [ ] Admin interfaces operational
- [ ] Role-based permissions enforced

## Risk Mitigation

### Technical Risks

- **API Changes**: Close coordination with backend team
- **Performance**: Implement proper caching and optimization
- **Browser Support**: Test on all major browsers
- **Mobile Experience**: Responsive design validation

### Timeline Risks

- **Dependency Delays**: Backend API completion
- **Scope Creep**: Strict phase boundaries
- **Quality Issues**: Mandatory pre-commit validation

## Future Enhancements

### Post-Launch Improvements

- **Real-time Collaboration**: WebSocket integration
- **Advanced Filtering**: Complex query builder
- **Bulk Operations**: Multi-select actions
- **Mobile App**: React Native implementation

### V2.0 Features

- **Inventory Management**: Parts and supplies tracking
- **Analytics Dashboard**: Business intelligence
- **API Webhooks**: Third-party integrations
- **Multi-language Support**: Internationalization

## Conclusion

This roadmap provides a clear path from the current state to a fully functional, modern frontend that preserves the appealing visual design while delivering comprehensive issue management functionality. The phase-based approach ensures incremental delivery of value while maintaining high quality standards.

Each phase builds upon the previous one, creating a solid foundation for future enhancements while meeting the immediate needs of arcade operators managing their pinball machines.
