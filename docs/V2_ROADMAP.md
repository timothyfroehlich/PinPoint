# PinPoint Roadmap

**Last Updated**: 2025-12-06

## Release Strategy

### MVP (Minimum Viable Product) - ✅ COMPLETED

Bare minimum to start tracking issues. See PRODUCT_SPEC.md for details.

- ✅ Members-only
- ✅ Machines with name only
- ✅ Basic issue tracking (title, description, severity, status, comments)
- ✅ Anonymous public reporting
- ✅ Simple dashboard

### MVP+ (Immediate Next Set) - 🚧 IN PROGRESS

Polish and usability improvements that make it practical for daily use.
**These are "obviously next" features.**

### 1.0 (Full-Featured Single-Tenant)

Complete vision with notifications, integrations, advanced roles.
**Major features that round out the experience.**

### 2.0 (Multi-Tenant)

Support multiple organizations with data isolation.
**Platform expansion.**

---

## MVP+ Features (Immediate Next Set)

These make MVP practical for daily use:

### High Priority

**QR Codes for Machines**

- Problem: Reporting issues requires navigating to form
- Solution: QR codes on machines link directly to issue reporting for that machine
- Scope: Generate QR code per machine, print/display on machine, scan → pre-filled form
- Effort: Small (1-2 days)
- Impact: Dramatically improves public reporting UX

**OPDB Integration (Open Pinball Database)** - 🚧 IN PROGRESS

- Problem: Manual machine data entry is tedious
- Solution: Search OPDB, import machine details (name, manufacturer, year, etc.)
- Scope: OPDB API integration, search UI, import flow
- Status: Infrastructure and schema partially implemented (Machine Details)
- Impact: Faster machine setup

**Machine Photos**

- Problem: Multiple machines with similar names
- Solution: Upload photo for each machine
- Scope: Supabase Storage, image upload form, display on machine page
- Effort: Small (2 days)
- Impact: Visual identification

**Issue Photos**

- Problem: Text descriptions don't always capture the issue clearly
- Solution: Allow photo uploads on issues
- Scope: 1-3 photos per issue, Supabase Storage, display in timeline
- Effort: Medium (2-3 days)
- Impact: Clarity for complex issues

**Machine Search**

- Problem: Finding machines in a large list is tedious
- Solution: Search/filter machine list by name, manufacturer, location
- Scope: Search input, filter logic, highlighted results
- Effort: Small (1 day)
- Impact: Usability as fleet grows

### Medium Priority

**Machine Ownership & Notifications** - ✅ COMPLETED

- Problem: Machine owners want to know about issues with their machines
- Solution: Assign owner to machine, notify on new issues
- Scope: owner_id field, notification to owner on issue creation
- Status: Infrastructure and schema implemented
- Impact: Proactive issue awareness

**Public Landing Page**

- Problem: Public can't see what issues exist before reporting
- Solution: Read-only public page showing recent issues per machine
- Scope: Public route, issue list (title, severity, status only), no comments visible
- Effort: Small (1-2 days)
- Impact: Transparency, reduces duplicate reports

**Guest Accounts** - ✅ COMPLETED

- Problem: Public reporters can't track their reports
- Solution: Self-service guest account creation, can view their submitted issues
- Scope: Guest role, self-signup, filter issues by "reported by me"
- Status: Role implemented, signup flow active
- Impact: Better engagement with public reporters

**Email Capture on Public Reports**

- Problem: Can't follow up with anonymous reporters
- Solution: Optional email field on public report form
- Scope: Store email, display to members (don't require account)
- Effort: Trivial (<1 day)
- Impact: Follow-up capability

**Recent Issues Per Machine** - ✅ COMPLETED

- Problem: Machine page doesn't show issue history
- Solution: Show last 5 issues on machine detail page
- Scope: Query recent resolved issues, display below open issues
- Status: Implemented on machine page
- Impact: Context for recurring problems

### Polish

**Issue Priority Field** - ✅ COMPLETED

- Problem: Severity alone might not be enough for prioritization
- Solution: Add optional priority field (low/medium/high)
- Scope: Add field, update forms, filter by priority
- Status: Schema and UI implemented
- Impact: Better prioritization if severity isn't sufficient

**Better Mobile UX**

- Problem: Members repair on-site using phones
- Solution: Mobile-optimized layouts, larger touch targets, simplified nav
- Effort: Medium (ongoing)
- Impact: On-site usability

---

## 1.0 Features (Full-Featured Single-Tenant)

Major features that complete the vision:

### Notifications - ✅ COMPLETED

**Email Notifications**

- Assignments (you've been assigned)
- Status changes (issues you reported or are assigned to)
- New comments (issues you're participating in)
- Configurable per-user preferences
- Status: Implemented (Mailpit/Resend)

**In-App Notifications**

- Notification bell with unread count
- List of recent notifications
- Link to relevant issue
- Mark as read
- Status: Implemented (Real-time polling)

### Roles & Permissions - ✅ COMPLETED

**Guest Role**

- Can report issues
- Can view their own reports
- Read-only for everything else
- Status: Implemented

**Member Role**

- Full access to issue management
- Can manage machines
- Can assign issues
- (Current default role)

**Admin Role**

- User management (promote guest → member)
- System settings
- Can delete machines/issues
- Status: Implemented (Admin dashboard)

### Integration

**OPDB Integration (Open Pinball Database)**

- Problem: Manual machine data entry is tedious
- Solution: Search OPDB, import machine details (name, manufacturer, year, etc.)
- Scope: OPDB API integration, search UI, import flow
- Effort: Medium (3-4 days)
- Impact: Faster machine setup

**Social Login**

- Google OAuth
- GitHub OAuth
- Easier onboarding
- Effort: Small (1-2 days with Supabase)

### Machine Management

**Locations**

- Problem: Machines move between venues
- Solution: Location model, assign machines to locations
- Scope: Locations table, assign location to machine, filter by location
- Effort: Medium (2-3 days)

**Machine Notes**

- Tournament setup notes
- Known issues (non-blocking quirks)
- Maintenance history/notes
- Effort: Small (2 days)

**Self-Service Guest Accounts** - ✅ COMPLETED

- Public users can create guest accounts
- Email verification
- Upgrade to member (admin approval)
- Status: SignUp flow and Admin approval implemented

### Issue Management (1.0+)

**Custom Issue Statuses** - ✅ COMPLETED

- Problem: Simple new/in_progress/resolved is not enough for complex repairs
- Solution: 11 distinct statuses across New, In Progress, and Closed groups
- Status: Implemented (new, confirmed, in_progress, need_parts, need_help, wait_owner, fixed, wont_fix, wai, no_repro, duplicate)
- Impact: Precise tracking of repair lifecycle

**Saved Filters**

- Save current filter combination
- Name it (e.g., "Critical Open Issues")
- Quick access dropdown
- Personal to each user
- Effort: Small (2 days)

**Bulk Operations**

- Select multiple issues
- Bulk status change
- Bulk assign
- Bulk archive
- Effort: Medium (3 days)

**Issue Labels/Tags**

- Categorize beyond severity (electrical, mechanical, cosmetic, software)
- Apply multiple labels
- Filter by label
- Admin manages label list
- Effort: Medium (3-4 days)

---

## 2.0+ Features (Long-Term Vision)

### Multi-Tenancy

**Multiple Organizations**

- Each org has isolated data
- Org-scoped RLS policies
- Org switching UI
- Billing/subscriptions (if SaaS)
- Effort: Large (10+ days, architectural shift)
- Dependency: Validated demand from other arcades

### Advanced Features

**Analytics & Reporting (2.0+)**

- Average resolution time by severity
- Top machines by issue count
- Most active members
- Issue trends over time
- Export to CSV
- Effort: Medium (4-5 days)

**Webhooks & API**

- Webhook on issue create/update/resolve
- REST API for external integrations
- API authentication & rate limiting
- Documentation
- Effort: Large (7+ days)

**Parts Inventory**

- Track parts in stock
- Link parts to machines
- Alert on low stock
- Parts used per issue
- Effort: Large (10+ days)

**AI Features**

- Auto-suggest severity based on description
- Detect duplicate issues
- Summarize long issue descriptions
- Suggest machine based on problem description
- Effort: Variable (ongoing, cost considerations)

---

## Features Explicitly Not Building

**Removed Based on Feedback:**

- ❌ SLA tracking - Not a helpdesk tool
- ❌ SMS notifications - Email is sufficient
- ❌ Time tracking - Not needed for hobby repairs
- ❌ Recurring maintenance schedules - Will add if users request it

**Not Prioritized:**

- ❌ Native mobile apps - PWA is sufficient
- ❌ Offline support - Online-first is fine
- ❌ Video uploads - Photos are enough
- ❌ Forums/discussion boards - Stay focused
- ❌ Social features - Not a social network
- ❌ Event management - Use dedicated tools
- ❌ White labeling - Not a SaaS yet

---

## Unsorted Ideas Inbox

**Needs More Thought:**

- [ ] Issue dependencies (blocking issues)
- [ ] Custom fields per machine type
- [ ] Issue templates (common problems)
- [ ] Issue duplication (copy issue as template)
- [ ] Dark mode toggle
- [ ] User activity feed (who did what)
- [ ] @mentions in comments
- [ ] Issue voting (upvote important issues)
- [ ] Machine manuals storage/links
- [ ] Integration with PinballMap API
- [ ] Issue resolution knowledge base
- [ ] Gamification (badges for resolving issues)
- [ ] Multi-language support

---
