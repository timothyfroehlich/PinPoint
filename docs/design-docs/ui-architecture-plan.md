# **PinPoint UI/UX Architecture Plan (Updated for Frontend Rebuild)**

This document outlines the necessary pages and high-level components for the PinPoint application, updated to reflect the modern Next.js App Router implementation approach and phase-based development strategy.

## **Implementation Status**

The PinPoint frontend is being rebuilt in phases to deliver core functionality incrementally while maintaining the appealing visual design established in the current dashboard implementation.

### **Phase-Based Implementation**

- **Phase 1**: Authentication Foundation (3-5 days)
- **Phase 2**: Core Issue Management (7-10 days)
- **Phase 3**: Dashboard Enhancement (3-5 days)
- **Phase 4**: User & Organization Features (5-7 days)

See detailed phase documentation:

- [Frontend Rebuild Roadmap](./frontend-rebuild-roadmap.md)
- [Phase 1: Authentication Foundation](./frontend-phase-1-authentication.md)
- [Phase 2: Core Issue Management](./frontend-phase-2-issue-management.md)
- [Phase 3: Dashboard Enhancement](./frontend-phase-3-dashboard-enhancement.md)
- [Phase 4: User & Organization Features](./frontend-phase-4-user-organization.md)

## **Current Implementation Approach**

### **Modern Next.js App Router Structure**

The frontend uses Next.js 14 App Router with the following structure:

```
src/app/
├── (auth)/              # Authentication pages (Phase 1)
├── dashboard/           # Main dashboard (Phase 3)
├── issues/             # Issue management (Phase 2)
├── machines/           # Machine management (Phase 4)
├── locations/          # Location management (Phase 4)
├── profile/            # User profile (Phase 4)
└── admin/              # Admin interfaces (Phase 4)
```

### **Component Architecture**

- **Material UI v7**: Modern component library with updated Grid syntax
- **tRPC Integration**: Type-safe API communication throughout
- **Role-based Access**: Permission-based component rendering
- **Optimistic Updates**: Real-time UI updates with fallback handling

## **0\. Global Components (Updated Implementation)**

### **PrimaryAppBar Component**

- **Purpose:** A persistent header present on all pages with modern authentication integration.
- **Current Implementation:** Already styled with dark theme (`#1a1a2e`) and purple accents (`#667eea`)
- **Key Components:**
  - Organization Logo (navigates to dashboard)
  - **Authentication Integration (Phase 1):**
    - **Logged Out State:** "Sign In" button with NextAuth.js integration
    - **Logged In State:** User avatar and name with dropdown menu
    - **Dropdown Actions:** Profile, Settings, Logout
  - **Navigation Links:** Dashboard, Issues, Machines, Locations (role-based visibility)

### **Authentication System (Phase 1)**

- **NextAuth.js Integration:** Complete OAuth and magic link authentication
- **Session Management:** Persistent sessions with organization context
- **Multi-tenant Support:** Subdomain-based organization routing
- **Key Features:**
  - Google OAuth integration
  - Magic link authentication
  - Development impersonation
  - Session persistence across page reloads

## **1\. Core Application Pages (Phase-Based Implementation)**

### **Dashboard Page (Phase 3)**

- **Route:** `/dashboard`
- **Purpose:** Main landing page for authenticated users with real-time statistics
- **Current Status:** Visual design complete, mock data needs replacement
- **Phase 3 Implementation:**
  - Replace mock data with tRPC API calls
  - Add real-time updates for issue statistics
  - Implement functional navigation to all major sections
  - Add loading states and error handling
- **Key Components:**
  - Issue statistics cards with real data
  - Assigned issues list with priority indicators
  - Recent activity feed
  - Quick action buttons (Create Issue, View All Issues)

### **Issues Management (Phase 2)**

- **Routes:** `/issues`, `/issues/[id]`, `/issues/new`
- **Purpose:** Complete issue management workflow
- **Implementation Strategy:** Leverage archived frontend patterns
- **Key Pages:**
  - **Issues List:** Filtering, sorting, pagination with current card styling
  - **Issue Detail:** Timeline, comments, image gallery, real-time updates
  - **Issue Creation:** Machine selection, image upload, form validation

### **/locations/{locationId} (Public Location Page)**

- **Purpose:** A public-facing view of all the machines at a specific location.
- **Key Components:**
  - **Header:** Location Name and Address.
  - **Game Filters:**
    - A free-text search bar to instantly filter the list of games by name.
  - **"Report an Issue" Button:** A prominent call-to-action that opens a modal.
  - **Game Grid:** A responsive grid of cards for each machine, updated by the filters.
  - **View All Issues Link:** A link to /locations/{locationId}/issues.

### **/machines/{machineId} (Public Machine Page)**

- **Purpose:** A public, read-only detail page for a specific machine.
- **Key Components:**
  - Machine Identification, Current Status Indicator, Simplified Issue List.
  - **Primary Action:** A "Report an Issue on this Machine" button linking to /machines/{machineId}/report-issue.
  - **View Full History Link:** A link to /machines/{machineId}/issues.

### **/locations/{locationId}/issues & /machines/{machineId}/issues**

- **Purpose:** To display the main issues list, pre-filtered for a specific location or machine.

### **/machines/{machineId}/report-issue (Dedicated Issue Reporting Page)**

- **Purpose:** A dedicated, shareable page for reporting an issue on a specific machine.

## **2\. Administrative Features (Phase 4)**

### **User Profile Management**

- **Route:** `/profile`
- **Purpose:** Complete user profile management with modern interface
- **Phase 4 Implementation:**
  - Profile editing with real-time validation
  - Avatar upload with image compression
  - Notification preferences management
  - Owned machines display with issue notifications
- **Key Features:**
  - Material UI form components
  - React Hook Form integration
  - File upload progress indicators
  - Real-time preference updates

### **Organization Administration**

- **Route:** `/admin/organization`
- **Purpose:** Complete organization management for administrators
- **Access Control:** Admin role required
- **Key Features:**
  - Organization logo upload
  - Member management interface
  - Role assignment system
  - Organization statistics dashboard
  - Bulk user operations

### **Machine Management**

- **Routes:** `/machines`, `/machines/[id]`, `/machines/new`
- **Purpose:** Complete machine lifecycle management
- **OPDB Integration:** Real-time search and data sync
- **Key Features:**
  - Machine listing with advanced filtering
  - OPDB search with autocomplete
  - Machine detail view with issue history
  - Ownership assignment
  - Location management integration

### **Location Management**

- **Routes:** `/locations`, `/locations/[id]`
- **Purpose:** Physical location management
- **Multi-tenant Support:** Organization-scoped locations
- **Key Features:**
  - Location listing and detail views
  - Machine assignment to locations
  - Location statistics and analytics
  - Address and contact management

## **3\. Technical Implementation Details**

### **Design System Preservation**

- **Visual Identity:** Dark theme (`#1a1a2e`) with purple accents (`#667eea`) maintained throughout all phases
- **Component Consistency:** All new components follow established patterns from current dashboard
- **Material UI v7:** Modern component library with updated Grid syntax and theming
- **Responsive Design:** Mobile-first approach with proper breakpoints

### **Performance Optimization**

- **Data Loading:** Parallel API calls, intelligent caching, pagination
- **Real-time Updates:** Optimistic UI with fallback handling
- **Image Handling:** Client-side compression, lazy loading, CDN delivery
- **Bundle Optimization:** Code splitting and tree shaking

### **Quality Standards**

- **Zero TypeScript Errors:** Strict typing enforced throughout
- **ESLint Compliance:** Consistent code style and best practices
- **Accessibility:** WCAG 2.1 compliance with screen reader support
- **Test Coverage:** Unit, integration, and E2E tests for all phases
- **Performance:** Lighthouse scores >90 for all pages

## **4\. Future Enhancements (Post-Phase 4)**

### **Real-time Collaboration**

- **WebSocket Integration:** Live updates for issue changes and comments
- **Presence Indicators:** Show who's currently viewing/editing issues
- **Live Activity Feed:** Real-time notifications for all user actions
- **Conflict Resolution:** Handle concurrent edits gracefully

### **Advanced Features**

- **Kanban Board:** Drag-and-drop issue management interface
- **Advanced Analytics:** Issue trends, performance metrics, reporting
- **Bulk Operations:** Multi-select actions for efficient management
- **API Webhooks:** Third-party system integration capabilities

### **Public-Facing Features**

- **QR Code System:** Machine-specific QR codes for easy issue reporting
- **Public Issue Reporting:** Anonymous issue submission with email notifications
- **Location Discovery:** Public-facing organization and location pages
- **Collection System:** Advanced filtering and categorization for public users

### **Enterprise Features**

- **Multi-organization Support:** Users managing multiple organizations
- **Advanced RBAC:** Custom role creation and granular permissions
- **Audit Logging:** Comprehensive action tracking and reporting
- **White-label Support:** Custom branding and domain configuration

## **5\. Migration Strategy**

### **From Current State**

1. **Preserve Visual Design:** Maintain exact styling and component structure
2. **Incremental Replacement:** Replace mock data with real API calls
3. **Component Reuse:** Leverage existing component patterns where possible
4. **Gradual Enhancement:** Add features without disrupting existing functionality

### **From Archived Frontend**

1. **Pattern Extraction:** Reuse proven patterns from archived issue management
2. **Modernization:** Update to Next.js App Router and latest React patterns
3. **API Integration:** Connect to new tRPC endpoints instead of legacy APIs
4. **Design Alignment:** Adapt archived functionality to current visual design

## **6\. Success Metrics**

### **Phase Completion Criteria**

- **Phase 1:** Real authentication, session persistence, user context
- **Phase 2:** Complete issue management workflow with real-time updates
- **Phase 3:** Dashboard with real data and functional navigation
- **Phase 4:** Full administrative capabilities and user management

### **Overall Success**

- **User Experience:** Smooth, intuitive interface with consistent design
- **Performance:** Fast loading times and responsive interactions
- **Reliability:** Robust error handling and offline capabilities
- **Scalability:** Architecture ready for future feature additions
