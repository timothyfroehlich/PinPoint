# Feature Specification: Individual Issue Detail Page

**Version**: 1.0
**Created**: 2025-11-08
**Status**: Approved for Implementation
**Target User**: Admin/Technician managing machine maintenance

---

## Executive Summary

The Individual Issue Detail Page is the central hub for machine maintenance workflow. An admin opens this page when they receive an issue notification, need to investigate a problem, assign work to technicians, update progress, and coordinate resolution. The page must provide all critical information at a glance while enabling quick updates without navigating away.

**Current Status**: Backend 95% complete, UI gaps in severity/priority management, timeline visualization, and editing capabilities.

---

## Scope

### In Scope (This Specification)

- **Severity Display & Management** - Show and update issue severity (low/medium/high/critical)
- **Priority Display & Management** - Show and update issue priority (organizational priorities)
- **Edit Title/Description** - Inline editing of issue details
- **GitHub-Style Activity Feed** - Unified timeline showing comments + major events (created, assigned, status changed, etc.)
- **Anonymous Reporter Metadata** - Display anonymous submission details to admins
- **Moderation Status** - Show and manage moderation state for anonymous issues
- **Consistency Field** - Display issue consistency (Always, Occasionally, etc.)
- **Comment Edit/Delete** - Modify or remove existing comments
- **Machine Quick Link** - Navigate to full machine details

### Out of Scope (Deferred)

- **Attachments** - File upload/display system (backend ready, UI deferred)
- **Checklists** - Troubleshooting step tracking (schema ready, deferred)
- **Export Functionality** - PDF/CSV export
- **SLA Tracking** - Time-to-resolution metrics

---

## Current Implementation Analysis

### ✅ Fully Functional

| Feature | Implementation | Location |
|---------|----------------|----------|
| Issue Header | Title, ID, creation time, creator | `issue-detail-server.tsx:56-82` |
| Status Management | Display + update with dropdown | `issue-detail-server.tsx:251-274` |
| Assignment | Display + update with dropdown | `issue-detail-server.tsx:196-249` |
| Comments | Display, create, real-time updates | `issue-detail-server.tsx:99-167` |
| Machine Info | Name, model, location | `issue-detail-server.tsx:172-194` |
| Timestamps | Created, updated, resolved | `issue-detail-server.tsx:276-318` |

### ❌ Missing (Critical for Admin Workflow)

| Feature | Schema Support | Backend Support | UI Gap |
|---------|---------------|-----------------|--------|
| Severity | ✅ `issues.severity` | ✅ Can be set on create | ❌ No display or update UI |
| Priority | ✅ `issues.priority_id` | ✅ Relations exist | ❌ No display or update UI |
| Edit Issue | ✅ All fields mutable | ✅ `issue.update` tRPC | ❌ No edit UI |
| Activity Timeline | ✅ `issue_history` table | ✅ Timeline router exists | ❌ No visual timeline |
| Consistency | ✅ `issues.consistency` | ✅ Field available | ❌ Not displayed |
| Anonymous Metadata | ✅ Full schema support | ✅ RLS policies | ❌ Not displayed to admins |
| Moderation | ✅ `moderation_status` | ✅ Workflow ready | ❌ No admin UI |

---

## Feature Requirements (Detailed Specifications)

### 1. Severity Management (P0 - Critical)

**User Story**: As an admin, I need to see and update issue severity so I can prioritize urgent problems (e.g., customer locked out vs. cosmetic issue).

**Visual Design**:
- **Header Badge**: Show severity next to status badge
  - Critical: Red badge (`bg-error text-on-error`)
  - High: Orange badge (`bg-warning text-on-warning`)
  - Medium: Yellow badge (`bg-caution text-on-caution`)
  - Low: Blue badge (`bg-info text-on-info`)
- **Sidebar Control**: Dropdown in new "Issue Details" card
  - Current severity displayed with badge
  - Dropdown with 4 options: Low, Medium, High, Critical
  - Updates immediately on selection

**Technical Specifications**:
```typescript
// Server Action
export async function updateIssueSeverityAction(
  issueId: string,
  prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ severity: string }>>

// Schema (already exists)
severity: severityEnum().default("medium").notNull()
// enum values: "low" | "medium" | "high" | "critical"

// Permission Required
PERMISSIONS.ISSUE_EDIT
```

**Behavior**:
- Only users with `ISSUE_EDIT` permission can update
- Change logged to `issue_history` table with `activity_type: 'SEVERITY_CHANGED'`
- Notification generated if severity increases to High/Critical
- Optimistic UI update (dropdown shows new value immediately)
- Page revalidated after server confirmation

**Files to Modify**:
- Create: `src/components/issues/issue-severity-client.tsx`
- Update: `src/components/issues/issue-detail-server.tsx` (add severity badge + sidebar card)
- Create: Server action in `src/lib/actions/issue-actions.ts`
- Update: Activity logging service (if not already handling severity)

---

### 2. Priority Management (P0 - Critical)

**User Story**: As an admin, I need to see and update issue priority so I can schedule work appropriately (high-priority issues get handled first, even if low severity).

**Visual Design**:
- **Header Badge**: Show priority next to severity badge
  - Badge color from organization's priority configuration
  - Display: Priority name (e.g., "P0", "Urgent", "Low")
  - Optional: Show priority order number
- **Sidebar Control**: Dropdown in "Issue Details" card
  - Current priority displayed with badge
  - Dropdown populated from org's custom priorities
  - Sorted by priority order (highest first)

**Technical Specifications**:
```typescript
// Server Action
export async function updateIssuePriorityAction(
  issueId: string,
  prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ priorityId: string }>>

// Schema (already exists)
priority_id: text().notNull()
// References priorities table (org-scoped)

// Priority Table Structure
priorities: {
  id: text,
  name: text,
  order: integer,  // Lower = higher priority
  organization_id: text,
  is_default: boolean
}

// Permission Required
PERMISSIONS.ISSUE_EDIT
```

**Behavior**:
- Fetch available priorities from `getAvailablePriorities(organizationId)`
- Only users with `ISSUE_EDIT` permission can update
- Change logged to `issue_history` with `activity_type: 'PRIORITY_CHANGED'`
- Notification generated if priority elevated significantly
- Optimistic UI update
- Page revalidated after confirmation

**Files to Modify**:
- Create: `src/components/issues/issue-priority-client.tsx`
- Update: `src/components/issues/issue-detail-server.tsx` (add priority badge + sidebar card)
- Create: Server action in `src/lib/actions/issue-actions.ts`
- Update: DAL function `getAvailablePriorities()` (may already exist for org settings)

---

### 3. Edit Title & Description (P0 - Critical)

**User Story**: As an admin, I need to edit issue title and description so I can fix typos, clarify vague reports, or add diagnostic findings.

**Visual Design**:
- **Edit Button**: Pencil icon next to title (only visible to users with ISSUE_EDIT)
- **Edit Modal**: Dialog with form fields
  - Title input (pre-filled with current value)
  - Description textarea (pre-filled, supports multiline)
  - Cancel and Save buttons
  - Validation: Title required, max lengths enforced
- **Visual Feedback**:
  - Loading state during save
  - Success toast: "Issue updated"
  - Error toast with specific message

**Technical Specifications**:
```typescript
// Use existing tRPC mutation
api.issue.core.update.useMutation({
  onSuccess: () => {
    revalidatePath(`/issues/${issueId}`);
    toast.success("Issue updated");
  }
})

// Input Schema (already exists)
issueUpdateSchema: {
  id: issueIdSchema,
  title: titleSchema.optional(),
  description: descriptionSchema.nullable().optional()
}

// Permission Required
PERMISSIONS.ISSUE_EDIT
```

**Behavior**:
- Modal opens on edit button click
- Form validates on client side (required fields, max length)
- Submit sends tRPC mutation
- Change logged to `issue_history` (separate entries for title/description if both changed)
- Modal closes on success
- Page updates with new values
- Edited timestamp updated

**Files to Create**:
- `src/components/issues/issue-edit-dialog-client.tsx` - Modal dialog component
- `src/components/issues/issue-edit-form-client.tsx` - Form within dialog

**Files to Update**:
- `src/components/issues/issue-detail-server.tsx` - Add edit button next to title

---

### 4. GitHub-Style Activity Feed (P1 - High Priority)

**User Story**: As an admin, I need to see a unified timeline of all issue activity (comments, status changes, assignments, etc.) so I can understand the full history at a glance, just like GitHub issues.

**Visual Design**:
- **Unified Feed**: Single vertical timeline combining comments and events
- **Event Types**:
  - **Comments**: Full comment with avatar, author, content
  - **Created**: "User created this issue" with timestamp
  - **Assigned**: "User assigned this to Assignee" with user avatars
  - **Status Changed**: "User changed status from X to Y" with status badges
  - **Priority Changed**: "User changed priority from X to Y"
  - **Severity Changed**: "User changed severity from X to Y"
  - **Resolved**: "User marked as resolved" with resolved timestamp
  - **Reopened**: "User reopened this issue"
- **Visual Style**:
  - Left gutter with vertical line connecting items
  - Icon/avatar for each item (comment = user avatar, event = icon)
  - Timestamp on each item (relative time)
  - System events use gray/muted styling
  - Comments use full styling with borders

**GitHub Reference**: Similar to https://github.com/issues - events are interspersed with comments chronologically

**Technical Specifications**:
```typescript
// Data Structure
type TimelineItem = Comment | ActivityEvent;

interface ActivityEvent {
  id: string;
  issueId: string;
  activityType:
    | 'CREATED'
    | 'STATUS_CHANGED'
    | 'ASSIGNED'
    | 'PRIORITY_CHANGED'
    | 'SEVERITY_CHANGED'
    | 'RESOLVED'
    | 'REOPENED';
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date;
  actor: {
    id: string;
    name: string;
    email: string;
  };
}

// Backend Query (combine comments + issue_history)
const timeline = await db.query.issueHistory.findMany({
  where: eq(issueHistory.issue_id, issueId),
  with: { actor: true },
  orderBy: asc(issueHistory.created_at)
});

const comments = await db.query.comments.findMany({
  where: eq(comments.issue_id, issueId),
  with: { author: true },
  orderBy: asc(comments.created_at)
});

// Merge and sort by timestamp
const feed = mergeByCr eatedAt(timeline, comments);
```

**Behavior**:
- Server-rendered timeline (initial load)
- Comments section replaced by unified feed
- Real-time updates append new items (using existing RealtimeCommentsClient pattern)
- Filter option: "Show comments only" / "Show all activity" (toggle)
- Comment form at bottom of feed (unchanged)

**Files to Create**:
- `src/components/issues/activity-feed-server.tsx` - Server component for timeline
- `src/components/issues/activity-event-item.tsx` - Display component for events
- `src/components/issues/activity-feed-client.tsx` - Real-time wrapper (if needed)
- `src/lib/dal/issue-timeline.ts` - DAL function to fetch merged timeline

**Files to Update**:
- `src/components/issues/issue-detail-server.tsx` - Replace comments section with activity feed
- `src/server/db/schema/issues.ts` - Verify `issue_history` schema (should be ready)

---

### 5. Consistency Field Display (P2 - Medium Priority)

**User Story**: As an admin, I need to see how consistently an issue occurs (Always, Occasionally, etc.) so I can prioritize reproducible issues.

**Visual Design**:
- **Sidebar Card**: "Issue Details" card (same card as severity/priority)
- **Display**: Read-only badge or text field
  - Values: "Always", "Occasionally", "Intermittent", "Once"
  - Gray badge if set, hidden if null
- **Future**: Can make editable with dropdown (same pattern as severity)

**Technical Specifications**:
```typescript
// Schema (already exists)
consistency: text() // e.g., "Always", "Occasionally"

// No new backend work needed, just display
```

**Files to Update**:
- `src/components/issues/issue-detail-server.tsx` - Add consistency to sidebar

---

### 6. Anonymous Reporter Metadata (P2 - Medium Priority)

**User Story**: As an admin, I need to see who submitted an anonymous issue so I can follow up if needed (e.g., "Customer reported via QR code, email: customer@example.com").

**Visual Design**:
- **Reporter Section** in sidebar (new card)
  - If authenticated: Show creator (already implemented)
  - If anonymous:
    - Badge: "Anonymous Reporter"
    - Display: Submitter name (if provided)
    - Display: Contact method (email/phone)
    - Display: Session ID (for admin debugging)
- **Conditional Display**: Only visible to admins (users with ISSUE_EDIT or ISSUE_MODERATE permissions)

**Technical Specifications**:
```typescript
// Schema (already exists)
reporter_type: reporterTypeEnum() // "authenticated" | "anonymous"
reporter_email: text()
submitter_name: text()
anonymous_contact_method: varchar(255)
anonymous_session_id: varchar(255)

// Permission Check
// Display if user has ISSUE_EDIT or admin role
```

**Files to Create**:
- `src/components/issues/anonymous-reporter-info.tsx` - Display component

**Files to Update**:
- `src/components/issues/issue-detail-server.tsx` - Add reporter info card to sidebar

---

### 7. Moderation Status Management (P2 - Medium Priority)

**User Story**: As an admin, I need to see and approve/reject anonymous issues before they're publicly visible, preventing spam or inappropriate content.

**Visual Design**:
- **Moderation Badge** (header, next to status badge)
  - Pending: Yellow badge "Pending Moderation"
  - Approved: Green badge "Approved" (or hidden)
  - Rejected: Red badge "Rejected"
- **Moderation Controls** (sidebar, admin-only)
  - Buttons: "Approve" and "Reject"
  - Only visible if status is "pending"
  - Confirmation dialog for rejection
- **Visibility**:
  - Pending issues only visible to admins
  - Approved issues visible per RLS rules
  - Rejected issues hidden from public, visible to admins

**Technical Specifications**:
```typescript
// Schema (already exists)
moderation_status: moderationStatusEnum() // "pending" | "approved" | "rejected"

// Server Action
export async function updateModerationStatusAction(
  issueId: string,
  status: "approved" | "rejected"
): Promise<ActionResult<{ status: string }>>

// Permission Required
PERMISSIONS.ISSUE_MODERATE (or admin role)
```

**Behavior**:
- Only admins see moderation controls
- Approve/Reject updates `moderation_status` field
- Activity logged to `issue_history`
- RLS policies enforce visibility based on moderation status
- Notification sent to submitter if email provided

**Files to Create**:
- `src/components/issues/moderation-controls-client.tsx` - Approve/reject buttons
- Server action in `src/lib/actions/issue-actions.ts`

**Files to Update**:
- `src/components/issues/issue-detail-server.tsx` - Add moderation badge + controls
- RLS policies (verify they handle moderation_status, should already be there)

---

### 8. Comment Edit & Delete (P2 - Medium Priority)

**User Story**: As an admin, I need to edit or delete comments to fix typos, remove outdated info, or moderate inappropriate content.

**Visual Design**:
- **3-Dot Menu** on each comment (kebab menu icon)
  - Options: "Edit", "Delete"
  - Only visible to comment author or admins with ISSUE_EDIT
- **Edit Mode**:
  - Textarea replaces comment text
  - Save and Cancel buttons
  - Edited badge appears after save
- **Delete Confirmation**:
  - Alert dialog: "Are you sure? This action cannot be undone."
  - Soft delete (comment.deleted_at set, content hidden)

**Technical Specifications**:
```typescript
// Schema (already exists)
comments: {
  deleted_at: timestamp,
  deleted_by: text,
  updated_at: timestamp
}

// Server Actions
export async function editCommentAction(
  commentId: string,
  prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ content: string }>>

export async function deleteCommentAction(
  commentId: string
): Promise<ActionResult<{ success: boolean }>>

// Permission Check
// Allow if: user is author OR user has ISSUE_EDIT
```

**Files to Create**:
- `src/components/issues/comment-actions-menu-client.tsx` - 3-dot menu
- `src/components/issues/comment-edit-form-client.tsx` - Inline edit form
- Server actions in `src/lib/actions/comment-actions.ts` (may already exist)

**Files to Update**:
- `src/components/issues/issue-detail-server.tsx` - Add menu to each comment

---

### 9. Machine Quick Link (P3 - Low Priority)

**User Story**: As an admin, I want to click on the machine name to view full machine details (all issues, location info, owner contact).

**Visual Design**:
- **Machine Card** (sidebar) becomes clickable
- **Hover State**: Underline on machine name, cursor changes to pointer
- **Link Target**: `/machines/[machineId]`

**Technical Specifications**:
```typescript
// Simple Link component
<Link href={`/machines/${issue.machineId}`}>
  <Card className="cursor-pointer hover:border-primary">
    {/* Existing machine display */}
  </Card>
</Link>
```

**Files to Update**:
- `src/components/issues/issue-detail-server.tsx` - Wrap machine card in Link

---

## Implementation Priorities

### Phase 1: Core Issue Management (Week 1)

**Goal**: Enable full issue lifecycle management with severity and priority

1. **Severity Management** (2 days)
   - Severity badge in header
   - Severity dropdown in sidebar
   - Server Action for updates
   - Activity logging

2. **Priority Management** (2 days)
   - Priority badge in header
   - Priority dropdown in sidebar
   - Server Action for updates
   - Fetch org priorities

3. **Edit Title/Description** (1 day)
   - Edit button + modal dialog
   - Form with validation
   - Use existing tRPC mutation

**Deliverables**: Admins can fully manage issue metadata (status, severity, priority, assignment, title, description)

---

### Phase 2: Activity Timeline (Week 2)

**Goal**: Provide GitHub-style unified activity feed

1. **Backend Integration** (2 days)
   - DAL function to merge `issue_history` + `comments`
   - Sort by timestamp
   - Type discriminators

2. **UI Components** (2 days)
   - Activity feed container
   - Event item components (different styles per event type)
   - Comment item (existing, refactored)

3. **Real-time Updates** (1 day)
   - Extend existing real-time pattern to events
   - Append new items to feed

**Deliverables**: Unified timeline showing full issue history (comments + system events)

---

### Phase 3: Metadata & Moderation (Week 3)

**Goal**: Support anonymous issues and moderation workflows

1. **Anonymous Reporter Info** (1 day)
   - Sidebar card displaying anonymous metadata
   - Permission-based visibility

2. **Consistency Field** (0.5 days)
   - Display in sidebar
   - Optional: Make editable

3. **Moderation Controls** (2 days)
   - Moderation status badge
   - Approve/reject buttons
   - Server Actions
   - Notification on approval/rejection

4. **Comment Edit/Delete** (1.5 days)
   - 3-dot menu on comments
   - Edit form (inline)
   - Delete confirmation + soft delete
   - Server Actions

**Deliverables**: Full support for anonymous issues with moderation

---

### Phase 4: Polish (Week 4)

**Goal**: UX improvements and minor features

1. **Machine Quick Link** (0.5 days)
2. **Responsive Design** (1 day)
   - Mobile-friendly sidebar (collapse to tabs)
   - Touch-friendly dropdowns
3. **Keyboard Shortcuts** (1 day)
   - E: Edit issue
   - S: Change status
   - A: Assign
   - C: Focus comment field
4. **Loading States** (1 day)
   - Skeleton screens
   - Optimistic UI polish
5. **Error Handling** (0.5 days)
   - Graceful degradation
   - Retry mechanisms

**Deliverables**: Production-ready polished UI

---

## Technical Architecture

### Server-First Pattern (NON_NEGOTIABLES.md Compliance)

```
┌─────────────────────────────────────────────┐
│         Issue Detail Page (Server)          │
│  - Fetch issue, comments, timeline          │
│  - Organization scoping enforced            │
│  - React 19 cache() for deduplication       │
└─────────────────┬───────────────────────────┘
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
┌───────────────┐   ┌───────────────┐
│ Client Island │   │ Client Island │
│  (Severity)   │   │  (Priority)   │
│  - Dropdown   │   │  - Dropdown   │
│  - Form       │   │  - Form       │
└───────┬───────┘   └───────┬───────┘
        │                   │
        └─────────┬─────────┘
                  ▼
        ┌─────────────────┐
        │ Server Actions  │
        │  - Auth check   │
        │  - Permission   │
        │  - Validation   │
        │  - DB update    │
        │  - Activity log │
        │  - Revalidate   │
        └─────────────────┘
```

### Data Flow

1. **Initial Load** (Server Component):
   ```typescript
   const [issue, timeline, assignableUsers, statuses, priorities] =
     await Promise.all([
       getIssueById(issueId, organizationId),
       getIssueTimeline(issueId, organizationId), // New
       getAssignableUsers(organizationId),
       getAvailableStatuses(organizationId),
       getAvailablePriorities(organizationId), // New
     ]);
   ```

2. **User Interaction** (Client Island):
   ```typescript
   // Example: Severity dropdown
   const [state, formAction] = useActionState(
     updateIssueSeverityAction.bind(null, issueId),
     null
   );
   ```

3. **Server Action**:
   ```typescript
   export async function updateIssueSeverityAction(...) {
     // 1. Auth + Permission
     const authContext = await getRequestAuthContext();
     await requirePermission(authContext, PERMISSIONS.ISSUE_EDIT);

     // 2. Validate
     const validated = severitySchema.parse(formData);

     // 3. Update DB (org-scoped)
     await db.update(issues)
       .set({ severity: validated })
       .where(and(
         eq(issues.id, issueId),
         eq(issues.organization_id, authContext.org.id)
       ));

     // 4. Activity log (background)
     await runAfterResponse(async () => {
       await logSeverityChange(issueId, oldValue, validated);
     });

     // 5. Cache invalidation
     revalidatePath(`/issues/${issueId}`);

     return actionSuccess({ severity: validated });
   }
   ```

4. **Revalidation**: Page re-fetches server data, shows updated values

---

## Type Safety (TYPESCRIPT_STRICTEST_PATTERNS.md Compliance)

### Discriminated Unions for Timeline Items

```typescript
// Type-safe timeline items
type TimelineItem =
  | { type: 'comment'; data: Comment }
  | { type: 'event'; data: ActivityEvent };

function renderTimelineItem(item: TimelineItem) {
  if (item.type === 'comment') {
    return <CommentItem comment={item.data} />;
  } else {
    return <ActivityEventItem event={item.data} />;
  }
}
```

### Null Safety

```typescript
// Safe optional chaining
const reporterInfo = issue.reporterType === 'anonymous'
  ? {
      name: issue.submitterName ?? 'Anonymous',
      contact: issue.anonymousContactMethod ?? issue.reporterEmail,
      sessionId: issue.anonymousSessionId,
    }
  : null;
```

### Explicit Return Types

```typescript
export async function getIssueTimeline(
  issueId: string,
  organizationId: string
): Promise<TimelineItem[]> {
  // Implementation
}
```

---

## Testing Strategy (TESTING_GUIDE.md Compliance)

### Unit Tests

- **Validation Schemas**: Severity/priority input validation
- **Type Guards**: Timeline item discriminators
- **Utilities**: Timestamp formatting, badge color logic

### Integration Tests

- **Server Actions**: All new actions (severity, priority, edit, moderation)
  - Auth checks
  - Permission enforcement
  - DB updates
  - Activity logging
- **DAL Functions**: `getIssueTimeline()`, `getAvailablePriorities()`

### E2E Tests (Playwright)

- **Happy Path**: View issue → Edit title → Update severity → Change priority → Add comment → Resolve
- **Permission Tests**: Non-admin cannot edit severity/priority
- **Anonymous Flow**: View anonymous issue metadata as admin → Approve/reject
- **Timeline**: Verify events appear in feed after actions

### RLS Tests (pgTAP)

- **Moderation**: Verify pending issues only visible to admins
- **Organization Scoping**: Issue updates enforce org_id
- **Anonymous Access**: Public can read approved issues, not pending

---

## Security Considerations (CORE-SEC-001)

### Organization Scoping

All database queries MUST include `organizationId`:

```typescript
// ✅ Correct
await db.update(issues)
  .set({ severity: validated })
  .where(and(
    eq(issues.id, issueId),
    eq(issues.organization_id, authContext.org.id) // REQUIRED
  ));

// ❌ Wrong - allows cross-org updates
await db.update(issues)
  .set({ severity: validated })
  .where(eq(issues.id, issueId));
```

### Permission Enforcement

```typescript
// All editing requires ISSUE_EDIT permission
await requirePermission(authContext, PERMISSIONS.ISSUE_EDIT);

// Moderation requires ISSUE_MODERATE or admin
await requirePermission(authContext, PERMISSIONS.ISSUE_MODERATE);
```

### Input Validation

```typescript
// Always use Zod schemas
const severitySchema = z.enum(["low", "medium", "high", "critical"]);
const validated = severitySchema.parse(formData.get("severity"));
```

---

## Success Criteria

### Admin Efficiency Metrics

- **Time to Triage**: < 30 seconds
  - Read issue → Assess severity/priority → Assign → Done
- **Time to Update**: < 10 seconds
  - Change status/severity/priority with single dropdown interaction
- **Time to Resolve**: < 2 minutes
  - Final update → Add resolution comment → Mark resolved

### Information Completeness

- ✅ All critical fields visible: Status, Severity, Priority, Assignee
- ✅ Full context: Machine, location, reporter, history
- ✅ Timeline shows complete history (comments + system events)
- ✅ Anonymous issues show submitter metadata
- ✅ Moderation status clear for pending issues

### User Experience

- ✅ Zero navigation needed (all actions on one page)
- ✅ Instant feedback (optimistic UI updates)
- ✅ Clear state (color-coded badges, visual hierarchy)
- ✅ Mobile-responsive (sidebar collapses on small screens)
- ✅ Accessible (keyboard shortcuts, ARIA labels)

---

## Open Issues & Decisions

### Resolved (Based on User Feedback)

1. ✅ **Severity vs Priority**: Both visible and editable
2. ✅ **Timeline Style**: GitHub-style unified feed (comments + events)
3. ✅ **Edit Permissions**: Based on ISSUE_EDIT permission
4. ✅ **Anonymous Metadata**: Visible to admins
5. ✅ **Moderation**: Required for anonymous issues

### Pending (Implementation Details)

1. **Activity Feed Filtering**: Should we add filter options (e.g., "Comments only", "Events only")?
2. **Notification Preferences**: Who gets notified on severity/priority changes?
3. **Bulk Operations**: Should we add "Update multiple issues" from detail page (e.g., "Apply to similar issues")?
4. **Mobile Experience**: Sidebar as bottom sheet on mobile, or vertical stack?

---

## Dependencies & Risks

### External Dependencies

- **None** - All features use existing tech stack (Next.js, tRPC, Drizzle, shadcn/ui)

### Schema Dependencies

- ✅ All required fields exist in schema
- ✅ No migration files needed (pre-beta, direct schema modification if necessary)
- ✅ RLS policies already handle organization scoping

### Integration Risks

- **Low Risk**: Features are isolated, incremental additions
- **Medium Risk**: Timeline refactor touches comments section (well-tested existing code)
- **Mitigation**: Feature flags for phased rollout (optional)

---

## Appendix: File Structure

### New Files to Create

```
src/components/issues/
├── issue-severity-client.tsx          # Severity dropdown
├── issue-priority-client.tsx          # Priority dropdown
├── issue-edit-dialog-client.tsx       # Edit title/description modal
├── issue-edit-form-client.tsx         # Form within dialog
├── activity-feed-server.tsx           # Unified timeline (Server)
├── activity-event-item.tsx            # Event display component
├── activity-feed-client.tsx           # Real-time wrapper (optional)
├── anonymous-reporter-info.tsx        # Anonymous metadata card
├── moderation-controls-client.tsx     # Approve/reject buttons
├── comment-actions-menu-client.tsx    # 3-dot menu
└── comment-edit-form-client.tsx       # Inline edit

src/lib/dal/
└── issue-timeline.ts                  # Timeline data fetching

src/lib/actions/
├── issue-actions.ts                   # Add: severity, priority, edit, moderation actions
└── comment-actions.ts                 # Add: edit, delete actions
```

### Files to Modify

```
src/components/issues/
└── issue-detail-server.tsx            # Add: badges, sidebar cards, timeline

src/server/db/schema/
└── issues.ts                          # Verify schema (no changes needed)

src/lib/types/
└── api.ts                             # Add timeline types (if needed)
```

---

## Changelog

- **2025-11-08**: Initial specification created based on codebase investigation and user requirements
  - Scope: Severity, priority, editing, timeline, moderation, metadata
  - Deferred: Attachments, checklists
  - Decisions: GitHub-style timeline, ISSUE_EDIT permission gating, both severity+priority visible

---

**End of Specification**
