# **PinPoint UI/UX Architecture Plan (Updated for Frontend Rebuild)**

This document outlines the necessary pages and high-level components for the PinPoint application, based on the Beta and V1.0 roadmap. Pages are organized by their functional purpose, with each page showing different components based on user authentication and permissions.

## **0. Global Components**

- **Purpose:** A persistent header present on all pages providing primary navigation.
- **Key Components:**
  - **Organization Logo:** Links to dashboard (for authenticated users) or organization homepage (for public users).
  - **Navigation Menu:**
    - **Dashboard** (authenticated only)
    - **Locations** - Shows organization page with all locations, includes accordion-style dropdown listing all locations for quick navigation
    - **Games** - Shows all games across the organization
    - **Issues** - Shows all issues across the organization
  - **Authentication Component:**
    - **Logged Out State:** A single "Login / Sign Up" button. Clicking it opens the Authentication Modal.
    - **Logged In State:** The button is replaced with the user's avatar and name. Clicking this opens a dropdown with links to "/profile" and a "Logout" action.
- **Mobile Navigation:**
  - Navigation menu becomes a hamburger menu
  - Location dropdown uses accordion-style expansion within the mobile menu for better touch interaction

### **Authentication Modal**

- **Purpose:** A single modal for handling authentication, triggered from the Universal Header.
- **Key Components:**
  - **Mode Selection:** Separate "Login" and "Sign Up" buttons within the modal to switch between modes
  - **Email Field:** Magic Link (email) input field
  - **Social Sign-in:** Buttons for Google, Facebook authentication
  - **Mode-Specific Behavior:**
    - Login mode: Standard authentication flow
    - Sign Up mode: Shows error message if email already exists
  - **Visual Indication:** Clear indication of which mode (login/signup) is currently active

## **1. Organization & Location Pages**

### **/ (Organization Homepage)**

- **Purpose:** Main landing page showing organization info and locations.
- **Public View:**
  - Organization Name and Logo
  - Grid/list of all public locations
  - Basic organization information
- **Authenticated View (Additional Components):**
  - **"Add Location" button:**
    - Hidden for unauthenticated users
    - Visible but disabled for users without permission (tooltip: "Requires create_location permission")
    - Enabled for users with appropriate permissions
  - Location management quick actions (edit/delete) with permission-based visibility

### **/locations/{locationId} (Location Page)**

- **Purpose:** Display all machines at a specific location.
- **Public View:**
  - Location Name and Address
  - Free-text search bar for filtering games
  - "Report an Issue" button (opens modal)
  - Game Grid with machine cards
  - "View All Issues" link to /locations/{locationId}/issues
- **Authenticated View (Additional Components):**
  - **"Add Machine" button:** Permission-based visibility (tooltip: "Requires create_machine permission")
  - Machine management actions (edit/move/delete): Permission-based
  - Internal issue indicators on machine cards
  - Collection management tools (V1.0)

## **2. Machine Pages**

### **/machines (All Machines Page)**

- **Purpose:** Organization-wide machine inventory view.
- **Public View:**
  - Search and filter controls
  - Machine list/grid with basic information
  - Status indicators
- **Authenticated View (Additional Components):**
  - **"Add Machine" button:** Permission-based visibility
  - Bulk actions for staff (move, update status)
  - Advanced filters (location, owner, status)
  - Export functionality

### **/machines/{machineId} (Machine Detail Page)**

- **Purpose:** Detailed view of a specific machine.
- **Public View:**
  - Machine identification and photos
  - Current status indicator
  - Recent public issues list
  - "Report an Issue" button
  - "View Full History" link
- **Authenticated View (Additional Components):**
  - **Edit Machine:** Permission-based (tooltip: "Requires edit_machine permission")
  - **Move Machine:** Permission-based (tooltip: "Requires move_machine permission")
  - Internal issues (marked with lock icon)
  - Owner information and notification settings
  - Maintenance history (staff only)

### **/machines/{machineId}/report-issue**

- **Purpose:** Dedicated issue reporting page.
- **Components:**
  - Pre-filled machine information
  - Issue type selection
  - Description field
  - Photo upload
  - **"Internal Only" checkbox:** Visible only to authenticated staff with appropriate permissions

## **3. Issue Management Pages**

### **/issues (Issues List)**

- **Purpose:** Central issue tracking across organization.
- **Public View:**
  - List of public issues with basic filters
  - Status indicators
  - Machine and location information
- **Authenticated View (Additional Components):**
  - Internal issues (with privacy badges)
  - Advanced filters (assignee, priority, internal/public)
  - Bulk actions: Permission-based (tooltip: "Requires bulk_manage_issues permission")
  - Issue assignment controls

### **/issues/{issueId} (Issue Detail)**

- **Purpose:** Detailed issue view and management.
- **Public View:**
  - Issue description and status
  - Public comments/updates
  - Machine and location context
- **Authenticated View (Additional Components):**
  - **Edit Issue:** Permission-based (tooltip: "Requires edit_issue permission")
  - **Close Issue:** Permission-based (tooltip: "Requires close_issue permission")
  - Internal notes section
  - Assignment controls
  - Status change history
  - Priority management

### **/locations/{locationId}/issues & /machines/{machineId}/issues**

- **Purpose:** Pre-filtered issue views for specific contexts.
- **Components:** Same as /issues but with active location or machine filters

## **4. Dashboard (Authenticated Only)**

### **/dashboard**

<<<<<<< HEAD

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

=======

- **Purpose:** Personalized overview for authenticated users.
- **Components:**
  - Issues assigned to current user
  - Recent activity on owned machines
  - Organization statistics (filtered by user's permissions)
  - Quick action buttons based on user's permissions
  - Recent updates across the organization

## **5. User & Admin Pages**

- **Route:** `/admin/organization`
- **Purpose:** Complete organization management for administrators
- **Access Control:** Admin role required
- **Key Features:**
  - Organization logo upload
  - Member management interface
  - Role assignment system
  - Organization statistics dashboard
  - Bulk user operations

<<<<<<< HEAD

### **Machine Management**

=======

- **Purpose:** User profile management.
- **Components:**
  - Edit name, avatar, email preferences
  - Notification preferences (global and per-machine)
  - **My Owned Machines:**
    - List of owned machines with direct links
    - Per-machine notification toggles
  - Activity history
  - Connected social accounts

- **Routes:** `/machines`, `/machines/[id]`, `/machines/new`
- **Purpose:** Complete machine lifecycle management
- **OPDB Integration:** Real-time search and data sync
- **Key Features:**
  - Machine listing with advanced filtering
  - OPDB search with autocomplete
  - Machine detail view with issue history
  - Ownership assignment
  - Location management integration

<<<<<<< HEAD

### **Location Management**

=======

- **Purpose:** Organization settings (Admin only).
- **Components:**
  - Organization name and logo management
  - Default notification settings
  - Collection group toggles (V1.0)
  - Member invitation controls
  - API key management

- **Routes:** `/locations`, `/locations/[id]`
- **Purpose:** Physical location management
- **Multi-tenant Support:** Organization-scoped locations
- **Key Features:**
  - Location listing and detail views
  - Machine assignment to locations
  - Location statistics and analytics
  - Address and contact management

<<<<<<< HEAD

## **3\. Technical Implementation Details**

=======

- **Purpose:** Location management (Admin only).
- **Components:**
  - Location list with add/edit/delete controls
  - **Add Location:** Full permission required
  - Per-location settings:
    - Name, address, contact info
    - Public/Private visibility (V1.0)
    - Operating hours
    - Manual collection management (V1.0)

### **/admin/users**

- **Purpose:** User role management (Admin only).
- **Components:**
  - User list with search/filter
  - Role assignment interface
  - Permission matrix view
  - Activity logs per user
  - Bulk role updates with confirmation

## **Permission-Based UI Patterns**

Throughout the application, use these consistent patterns:

1. **Hidden:** Component not rendered for users without any access
2. **Disabled:** Component visible but grayed out with tooltip
3. **Enabled:** Full functionality for users with appropriate permissions

**Tooltip Format:** "Requires {permission_name} permission"

- Permission names are dynamically inserted
- Prevents message drift when permissions change
- Consider adding "Contact an admin to request access" as second line

Example Implementation:

```tsx
<Button
  disabled={!hasPermission("create_location")}
  title={
    !hasPermission("create_location")
      ? `Requires ${getPermissionName("create_location")} permission`
      : ""
  }
>
  Add Location
</Button>
```

## **Mobile Navigation Design**

1. **Hamburger Menu:**
   - Collapse main navigation on mobile
   - Full-height slide-out drawer

2. **Location Selection:**
   - Accordion-style expansion within mobile menu
   - Tapping "Locations" expands to show:
     - "All Locations" link
     - Individual location links

3. **Touch Targets:**
   - Minimum 44x44px touch targets
   - Adequate spacing between interactive elements

4. **Progressive Disclosure:**
   - Complex forms use expandable sections
   - Multi-step flows for lengthy processes

## **Games Page Structure**

### **/games (All Games Page)**

- **Purpose:** Organization-wide view of all models.
- **Public View:**
  - Searchable list of all models in the organization
  - Filter by manufacturer, era, location
  - Count of instances per title
- **Authenticated View (Additional Components):**
  - Add custom model (permission-based)
  - Edit game metadata
  - Bulk operations

## **V1.0 Enhancements**

### **Multi-Tenancy**

- Public marketing homepage at root domain
- Organization signup flow with subdomain selection
- Tenant switching UI for users in multiple organizations

- **Zero TypeScript Errors:** Strict typing enforced throughout
- **ESLint Compliance:** Consistent code style and best practices
- **Accessibility:** WCAG 2.1 compliance with screen reader support
- **Test Coverage:** Unit, integration, and E2E tests for all phases
- **Performance:** Lighthouse scores >90 for all pages

<<<<<<< HEAD

## **4\. Future Enhancements (Post-Phase 4)**

=======

- **Private Locations:**
  - Repair shops, storage facilities
  - Not shown on public pages
  - Available as destinations for moves
- **Machine Movement Workflows:**
  - Multi-step process with confirmation
  - Reason for move tracking
  - History of all movements
- **Internal-Only Issues:**
  - Checkbox on creation
  - Lock icon indicator
  - Filtered from public views

### **Collection Features**

- **Auto-Generated Collections:**
  - By manufacturer, era, theme
  - Configurable at organization level
- **Manual Collections:**
  - "Rooms" or custom groupings
  - Per-location configuration
- **UI Implementation:**
  - Expandable filter drawers
  - Multi-selection support
  - Visual collection badges on machines
