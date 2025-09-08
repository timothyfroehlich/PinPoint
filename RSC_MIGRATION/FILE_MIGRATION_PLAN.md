# Complete File Migration Impact Analysis

**Migration Type Key:**

- 🗑️ **DELETE** - Remove entirely, complete rewrite from scratch
- 🔄 **HEAVY** - Major structural changes, preserve core logic
- ✏️ **LIGHT** - Minor updates for compatibility
- ✅ **UNTOUCHED** - No changes required

---

## App Router Structure (`/src/app/`)

### Root Layout & Providers

```
src/app/
├── layout.tsx                   🔄 HEAVY - Remove MUI providers, add shadcn setup
├── providers.tsx                🗑️ DELETE - MUI ThemeProvider no longer needed
├── page.tsx                     🔄 HEAVY - Convert to Server Component with direct DB queries
├── globals.css                  ✏️ LIGHT - Update for Tailwind integration
├── favicon.ico                  ✅ UNTOUCHED
└── loading.tsx                  ✏️ LIGHT - Update styling to shadcn/ui patterns
```

### Authentication Routes

```
src/app/auth/
├── callback/page.tsx            ✅ UNTOUCHED - Supabase callback works perfectly
├── sign-in/page.tsx             🔄 HEAVY - Convert to Server Component with Server Actions
└── sign-out/page.tsx            🔄 HEAVY - Server Action for logout
```

### Dashboard & Main Pages

```
src/app/
├── dashboard/
│   ├── page.tsx                 🔄 HEAVY - Server Component with direct analytics queries
│   └── loading.tsx              ✏️ LIGHT - shadcn/ui loading components
├── settings/
│   ├── page.tsx                 🔄 HEAVY - Server Component settings overview
│   ├── roles/page.tsx           🔄 HEAVY - Server-rendered role management
│   ├── users/page.tsx           🔄 HEAVY - Server-rendered user management
│   └── organization/page.tsx    🔄 HEAVY - Server Component org settings
```

### Issue Management Routes

```
src/app/issues/
├── page.tsx                     🔄 HEAVY - Already server component, enhance with DAL
├── [issueId]/
│   ├── page.tsx                 🔄 HEAVY - Server Component with hybrid client islands
│   └── edit/page.tsx            🔄 HEAVY - Server Actions for form handling
├── create/page.tsx              🔄 HEAVY - Server Component with Server Actions
└── bulk/page.tsx                🔄 HEAVY - Server-side bulk operations
```

### Machine & Location Routes

```
src/app/machines/
├── page.tsx                     🔄 HEAVY - Server Component machine inventory
├── [id]/page.tsx                🔄 HEAVY - Server Component machine details
└── create/page.tsx              🔄 HEAVY - Server Actions for machine creation

src/app/locations/
├── page.tsx                     🔄 HEAVY - Server Component location management
└── [id]/page.tsx                🔄 HEAVY - Server Component location details
```

---

## Component Library (`/src/components/`)

### Issue Management Components (🚨 HIGHEST COMPLEXITY)

```
src/components/issues/
├── IssueList.tsx                🗑️ DELETE - 516 lines! Complete Server Component rewrite
├── IssueDetailView.tsx          🗑️ DELETE - Rewrite as hybrid server/client pattern
├── IssueCreateForm.tsx          🗑️ DELETE - Server Actions pattern replacement
├── IssueEditForm.tsx            🗑️ DELETE - Server Actions replacement
├── IssueComments.tsx            🗑️ DELETE - Client island for real-time features
├── IssueCard.tsx                🗑️ DELETE - shadcn/ui Card replacement
├── IssueFilters.tsx             🗑️ DELETE - URL-based server filtering
├── FilterToolbar.tsx            🗑️ DELETE - Server-side filtering UI
├── IssueActions.tsx             🗑️ DELETE - Server Actions replacement
├── BulkActions.tsx              🗑️ DELETE - Server-side bulk operations
├── IssueStatusBadge.tsx         🗑️ DELETE - shadcn/ui Badge replacement
├── IssuePriorityIcon.tsx        🗑️ DELETE - shadcn/ui Icons replacement
├── IssueAssigneeAvatar.tsx      🗑️ DELETE - shadcn/ui Avatar replacement
├── IssueTimeline.tsx            🗑️ DELETE - Server Component timeline
├── ActivityFeed.tsx             🗑️ DELETE - Server Component activity
├── CommentForm.tsx              🗑️ DELETE - Client island with Server Actions
├── CommentList.tsx              🗑️ DELETE - Server Component with client islands
├── IssueAttachments.tsx         🗑️ DELETE - Hybrid upload component
├── AttachmentUpload.tsx         🗑️ DELETE - Client island for file uploads
├── IssueHistory.tsx             🗑️ DELETE - Server Component history
├── IssueMetrics.tsx             🗑️ DELETE - Server Component analytics
├── RelatedIssues.tsx            🗑️ DELETE - Server Component relationships
├── IssueSearch.tsx              🗑️ DELETE - URL-based server search
├── SavedFilters.tsx             🗑️ DELETE - Server-side saved filter management
└── IssueExport.tsx              🗑️ DELETE - Server Actions export
```

### Machine & Location Components

```
src/components/machines/
├── MachineList.tsx              🗑️ DELETE - Server Component with shadcn/ui Table
├── MachineDetailView.tsx        🗑️ DELETE - Server Component machine details
├── MachineCard.tsx              🗑️ DELETE - shadcn/ui Card replacement
├── MachineFilters.tsx           🗑️ DELETE - URL-based server filtering
├── MachineActions.tsx           🗑️ DELETE - Server Actions replacement
├── MachineStatusIndicator.tsx   🗑️ DELETE - shadcn/ui status components
├── MachineModelSelector.tsx     🗑️ DELETE - Server Component selector
└── MachineUpload.tsx            🗑️ DELETE - Server Actions file upload

src/components/locations/
├── LocationList.tsx             🗑️ DELETE - Server Component replacement
├── LocationDetailView.tsx       🗑️ DELETE - Server Component details
├── LocationCard.tsx             🗑️ DELETE - shadcn/ui Card replacement
├── MachineGrid.tsx              🗑️ DELETE - Server Component grid
└── LocationSelector.tsx         🗑️ DELETE - Server Component selector
```

### Layout & Navigation Components

```
src/components/layout/
├── AppShell.tsx                 🗑️ DELETE - shadcn/ui layout replacement
├── Sidebar.tsx                  🗑️ DELETE - Server Component navigation
├── Header.tsx                   🗑️ DELETE - Server Component with client islands
├── MobileNavigation.tsx         🗑️ DELETE - Responsive shadcn/ui navigation
├── Footer.tsx                   🔄 HEAVY - Update to shadcn/ui styling
└── LoadingSpinner.tsx           🔄 HEAVY - shadcn/ui loading components
```

### Authentication & User Components

```
src/components/auth/
├── LoginForm.tsx                🗑️ DELETE - Server Actions form replacement
├── SignUpForm.tsx               🗑️ DELETE - Server Actions replacement
└── AuthGuard.tsx                🔄 HEAVY - Server Component auth checking

src/components/user/
├── UserAvatar.tsx               🔄 HEAVY - shadcn/ui Avatar component
├── UserMenu.tsx                 🗑️ DELETE - Client island with server context
├── UserProfile.tsx              🗑️ DELETE - Server Component with client islands
├── OrganizationSelector.tsx     🔄 HEAVY - Client island for org switching
└── ProfilePictureUpload.tsx     🔄 HEAVY - Client island for file upload
```

### Permission & Role Components

```
src/components/permissions/
├── PermissionGate.tsx           ✏️ LIGHT - Preserve logic, update UI patterns
├── PermissionButton.tsx         🔄 HEAVY - Server Component with conditional rendering
├── RoleSelector.tsx             🔄 HEAVY - Server Component role selection
└── PermissionMatrix.tsx         🔄 HEAVY - Server Component permissions display
```

### UI Utility Components

```
src/components/ui/
├── Breadcrumbs.tsx              🗑️ DELETE - Server-side breadcrumb generation
├── DataTable.tsx                🗑️ DELETE - shadcn/ui Table replacement
├── SearchInput.tsx              🗑️ DELETE - Client island for search
├── FilterButton.tsx             🗑️ DELETE - shadcn/ui Button replacement
├── ActionMenu.tsx               🗑️ DELETE - shadcn/ui DropdownMenu replacement
├── StatusBadge.tsx              🗑️ DELETE - shadcn/ui Badge replacement
├── LoadingState.tsx             🔄 HEAVY - shadcn/ui loading patterns
├── ErrorBoundary.tsx            ✏️ LIGHT - Update error UI to shadcn/ui
├── ConfirmDialog.tsx            🗑️ DELETE - shadcn/ui Dialog replacement
└── Toast.tsx                    🗑️ DELETE - shadcn/ui toast system
```

### Form & Input Components

```
src/components/forms/
├── FormField.tsx                🗑️ DELETE - shadcn/ui form components
├── TextInput.tsx                🗑️ DELETE - shadcn/ui Input replacement
├── SelectInput.tsx              🗑️ DELETE - shadcn/ui Select replacement
├── DatePicker.tsx               🗑️ DELETE - shadcn/ui DatePicker replacement
├── FileUpload.tsx               🔄 HEAVY - Client island for uploads
├── FormActions.tsx              🗑️ DELETE - Server Actions pattern
└── ValidationMessage.tsx        🗑️ DELETE - shadcn/ui form validation
```

---

## Server Infrastructure (`/src/server/`)

### Database Layer

```
src/server/db/
├── schema/
│   ├── index.ts                 ✅ UNTOUCHED - Perfect Drizzle foundation
│   ├── auth.ts                  ✅ UNTOUCHED - Solid auth schema
│   ├── organizations.ts         ✅ UNTOUCHED - Multi-tenant foundation
│   ├── machines.ts              ✅ UNTOUCHED - Machine schema solid
│   ├── issues.ts                ✅ UNTOUCHED - Issue schema complete
│   └── collections.ts           ✅ UNTOUCHED - Collection schema good
├── queries/
│   ├── issues.ts                ✏️ LIGHT - Expand for Server Component patterns
│   ├── machines.ts              ✏️ LIGHT - Add joins for server rendering
│   ├── organizations.ts         ✏️ LIGHT - Server Component query patterns
│   └── users.ts                 ✏️ LIGHT - User data queries
├── drizzle.ts                   ✅ UNTOUCHED - Perfect database connection
├── provider.ts                  ✅ UNTOUCHED - Provider pattern works
└── seed/                        ✅ UNTOUCHED - Seed data foundation solid
```

### tRPC API Routers

```
src/server/api/
├── root.ts                      ✅ UNTOUCHED - Router registration solid
├── trpc.ts                      ✏️ LIGHT - May need server context updates
└── routers/
    ├── issue.ts                 ✅ UNTOUCHED - Preserve for client islands
    ├── issue.core.ts            ✅ UNTOUCHED - Core issue operations
    ├── issue.comments.ts        ✅ UNTOUCHED - Comment operations for client
    ├── issue.history.ts         ✅ UNTOUCHED - History operations
    ├── machine.ts               ✅ UNTOUCHED - Machine CRUD operations
    ├── machine.models.ts        ✅ UNTOUCHED - Model operations
    ├── location.ts              ✅ UNTOUCHED - Location operations
    ├── user.ts                  ✅ UNTOUCHED - User management
    ├── organization.ts          ✅ UNTOUCHED - Organization operations
    ├── role.ts                  ✅ UNTOUCHED - Role management
    ├── admin.ts                 ✅ UNTOUCHED - Admin operations
    ├── collection.ts            ✅ UNTOUCHED - Collection management
    ├── comment.ts               ✅ UNTOUCHED - Comment operations
    ├── notification.ts          ✅ UNTOUCHED - Notification system
    ├── pinballMap.ts            ✅ UNTOUCHED - External API integration
    └── qrCode.ts                ✅ UNTOUCHED - QR code generation
```

### Services Layer

```
src/server/services/
├── issueActivityService.ts      ✅ UNTOUCHED - Activity tracking solid
├── roleService.ts               ✅ UNTOUCHED - Role management logic
├── permissionService.ts         ✅ UNTOUCHED - Permission checking
├── notificationService.ts       ✅ UNTOUCHED - Notification logic
├── machineService.ts            ✅ UNTOUCHED - Machine business logic
├── locationService.ts           ✅ UNTOUCHED - Location management
├── organizationService.ts       ✅ UNTOUCHED - Organization logic
├── userService.ts               ✅ UNTOUCHED - User management
├── collectionService.ts         ✅ UNTOUCHED - Collection logic
└── analyticsService.ts          ✅ UNTOUCHED - Analytics business logic
```

### Authentication & Middleware

```
src/server/auth/
├── supabase.ts                  ✅ UNTOUCHED - Perfect SSR patterns
└── permissions.ts               ✅ UNTOUCHED - Permission logic solid

middleware.ts                    ✅ UNTOUCHED - Auth middleware works perfectly
```

---

## Library Utilities (`/src/lib/`)

### Supabase Integration

```
src/lib/supabase/
├── server.ts                    ✅ UNTOUCHED - Perfect server client
├── client.ts                    ✏️ LIGHT - May reduce usage for client islands
├── middleware.ts                ✅ UNTOUCHED - Middleware patterns solid
├── hooks.ts                     🔄 HEAVY - Reduce client-side hooks usage
├── ssr.ts                       ✅ UNTOUCHED - SSR patterns perfect
├── types.ts                     ✅ UNTOUCHED - Type definitions solid
└── admin.ts                     ✅ UNTOUCHED - Admin client works
```

### Authentication & Permissions

```
src/lib/auth/
├── server.ts                    ✅ UNTOUCHED - Server auth utilities perfect
├── client.ts                    ✏️ LIGHT - Minimal client auth usage
├── types.ts                     ✅ UNTOUCHED - Auth types solid
└── utils.ts                     ✅ UNTOUCHED - Auth utilities work

src/lib/permissions/
├── client.ts                    🔄 HEAVY - Convert to server context patterns
├── server.ts                    ✅ UNTOUCHED - Server permission checking
├── types.ts                     ✅ UNTOUCHED - Permission types solid
├── constants.ts                 ✅ UNTOUCHED - Permission constants
└── utils.ts                     ✅ UNTOUCHED - Permission utilities
```

### Business Logic Libraries

```
src/lib/issues/
├── filterUtils.ts               🔄 HEAVY - URL-based server filtering patterns
├── urlUtils.ts                  🔄 HEAVY - Server-side URL handling
├── selectionUtils.ts            🗑️ DELETE - No client-side bulk selection
├── statusValidation.ts          ✅ UNTOUCHED - Validation logic solid
├── priorityUtils.ts             ✅ UNTOUCHED - Priority logic solid
└── creationValidation.ts        ✅ UNTOUCHED - Creation validation works

src/lib/machines/
├── modelUtils.ts                ✅ UNTOUCHED - Model utilities solid
├── locationUtils.ts             ✅ UNTOUCHED - Location utilities work
├── statusUtils.ts               ✅ UNTOUCHED - Status logic solid
└── validationUtils.ts           ✅ UNTOUCHED - Validation utilities work
```

### Utility Libraries

```
src/lib/utils/
├── case-transformers.ts         ✅ UNTOUCHED - Case utilities work everywhere
├── id-generation.ts             ✅ UNTOUCHED - ID generation solid
├── image-processing.ts          ✅ UNTOUCHED - Image utilities solid
├── date-formatting.ts           ✅ UNTOUCHED - Date utilities work
├── url-helpers.ts               ✏️ LIGHT - May enhance for server URL handling
├── validation.ts                ✅ UNTOUCHED - Validation utilities solid
├── api-response-transformers.ts ✏️ LIGHT - May adjust for Server Components
├── error-handling.ts            ✅ UNTOUCHED - Error handling solid
├── logger.ts                    ✅ UNTOUCHED - Logging utilities work
├── environment.ts               ✅ UNTOUCHED - Environment utilities solid
└── tracing.ts                   ✅ UNTOUCHED - Tracing utilities work
```

### Data Processing

```
src/lib/data/
├── transformers.ts              ✅ UNTOUCHED - Data transformation solid
├── validators.ts                ✅ UNTOUCHED - Data validation works
├── serializers.ts               ✏️ LIGHT - May enhance for Server Component patterns
└── formatters.ts                ✅ UNTOUCHED - Data formatting utilities work
```

---

## Client-Side Code

### tRPC Client

```
src/trpc/
├── react.tsx                    🔄 HEAVY - Minimal usage for client islands only
├── query-client.ts              🔄 HEAVY - Reduce client-side query usage
├── server.ts                    ✅ UNTOUCHED - Server-side tRPC perfect
└── shared.ts                    ✅ UNTOUCHED - Shared utilities work
```

### React Hooks & Contexts

```
src/hooks/
├── usePermissions.ts            🔄 HEAVY - Convert to server context patterns
├── useClientMounted.ts          🗑️ DELETE - No hydration issues with RSC
├── useLocalStorage.ts           ✏️ LIGHT - Keep for client islands
└── useDebounce.ts               ✏️ LIGHT - Keep for search client islands

src/contexts/
├── PermissionDepsContext.tsx    🔄 HEAVY - Convert to server context
└── ThemeContext.tsx             🗑️ DELETE - No theme switching needed
```

---

## Configuration Files

### Package Configuration

```
package.json                     🔄 HEAVY - Remove MUI deps, add shadcn/ui
package-lock.json                🔄 HEAVY - Will regenerate with new dependencies
```

### Build & Development Configuration

```
next.config.mjs                  ✏️ LIGHT - Remove MUI config, add any shadcn config
tsconfig.json                    ✅ UNTOUCHED - TypeScript config solid
tsconfig.config.json             ✅ UNTOUCHED - Config TypeScript solid
eslint.config.js                 ✅ UNTOUCHED - ESLint config works
prettier.config.js               ✅ UNTOUCHED - Prettier config works
vitest.config.ts                 ✅ UNTOUCHED - Test config solid
playwright.config.ts             ✅ UNTOUCHED - E2E config works
```

### New Configuration Files Needed

```
tailwind.config.js               🆕 NEW - Tailwind configuration for shadcn/ui
components.json                  🆕 NEW - shadcn/ui component configuration
postcss.config.js                🆕 NEW - PostCSS for Tailwind processing
```

### Development Files

```
middleware.ts                    ✅ UNTOUCHED - Auth middleware perfect
.env.example                     ✅ UNTOUCHED - Environment template solid
.env.local                       ✅ UNTOUCHED - Local environment solid
.gitignore                       ✅ UNTOUCHED - Git ignore solid
README.md                        ✏️ LIGHT - Update setup instructions for shadcn/ui
```

---

## Testing Infrastructure

### Unit Tests

```
src/lib/common/__tests__/        ✅ UNTOUCHED - Pure function tests work
src/lib/utils/__tests__/         ✅ UNTOUCHED - Utility function tests solid
src/server/services/*.test.ts    ✅ UNTOUCHED - Service tests work perfectly
```

### Integration & E2E Tests

```
e2e/smoke-test-workflow.spec.ts  ✏️ LIGHT - Update selectors for shadcn/ui
supabase/tests/                  ✅ UNTOUCHED - RLS tests work perfectly
```

### Test Configuration

```
vitest.config.ts                 ✅ UNTOUCHED - Vitest config solid
playwright.config.ts             ✅ UNTOUCHED - Playwright config works
```

---

## Summary Statistics

### Files by Migration Impact:

- 🗑️ **DELETE**: ~75 files (All MUI components, client-heavy code)
- 🔄 **HEAVY**: ~45 files (App router pages, layout system, forms)
- ✏️ **LIGHT**: ~25 files (Utilities, minor config updates)
- ✅ **UNTOUCHED**: ~120 files (Database, API, services, business logic)
- 🆕 **NEW**: ~3 files (Tailwind config, shadcn/ui setup)

### Risk Assessment by Category:

- **HIGHEST RISK**: Issue components (516-line IssueList.tsx complexity)
- **MODERATE RISK**: Layout system, authentication flows, form handling
- **LOW RISK**: Database layer, API layer, business logic, utilities

### Conversion Order Dependencies:

1. **Foundation First**: shadcn/ui setup, DAL creation, Server Actions
2. **Core Systems**: Layout, authentication, issue management
3. **Feature Systems**: Machines, organizations, user management
4. **Polish**: Client islands, real-time features, optimization

This migration plan accounts for every source file in the codebase and provides a clear action plan for the complete RSC + shadcn/ui conversion.
