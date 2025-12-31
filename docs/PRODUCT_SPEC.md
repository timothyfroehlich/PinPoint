# PinPoint Product Specification

**Last Updated**: 2025-11-10
**Status**: ACTIVE - Source of truth for scope decisions

## Mission

Enable the Austin Pinball Collective to efficiently log, track, and resolve pinball machine issues.

**Target**: Single organization (Austin Pinball Collective)
**Philosophy**: Working software over comprehensive features

---

## Core Value Proposition

A focused issue tracking system for pinball machines that:

- Takes 30 seconds to report an issue
- Shows maintenance staff what needs attention
- Maintains complete issue history per machine
- Enables efficient repair workflows

---

## Release Strategy

### MVP (Minimum Viable Product)

The absolute bare minimum to start tracking issues. Members-only, basic features.

### MVP+ (Immediate Next Set)

Polish and usability improvements that make it practical for daily use.

### 1.0 (First Major Release)

Full-featured single-tenant application with notifications, integrations, and advanced roles.

### 2.0 (Multi-Tenant)

Support multiple organizations with full data isolation.

---

## MVP Scope (Ship First)

### 1. User Accounts & Authentication

**Included:**

- Email/password sign-up and login via Supabase Auth
- Basic profile (name, email, avatar)
- Password reset flow
- Single role: **Member** (full access)

**Not Included:**

- ❌ Guest role (MVP+)
- ❌ Admin role (1.0)
- ❌ Social login (1.0)
- ❌ Self-service sign-up (MVP+ for guests)

**Done When:**

- [ ] Members can sign up with email
- [ ] Members can log in
- [ ] Members can reset password
- [ ] Profile shows name and avatar

---

### 2. Machine Registry

**Included:**

- Machine with **name only**
- List of all machines
- Machine detail page showing its issues
- Machine status derived from open issues (operational/needs service/unplayable)

**Not Included:**

- ❌ Manufacturer, year, model, location (MVP+)
- ❌ Machine photos (MVP+)
- ❌ Machine search (MVP+)
- ❌ Machine ownership (MVP+)
- ❌ Machine notes/tournament settings (1.0)
- ❌ QR codes (MVP+)

**Done When:**

- [ ] Can create a machine with name
- [ ] Can view machine detail page
- [ ] Can see all machines in a list
- [ ] Machine status reflects its open issues
- [ ] Machine page shows its issues

**Design Decision:** Issues are **always** per-machine. Every issue must have exactly one machine.

---

### 3. Issue Tracking & Resolution

**Included:**

- Create issue with: title, description, machine (required), severity
- **Severity levels:** `minor` | `playable` | `unplayable`
  - **minor**: Cosmetic or very minor issues (e.g., light out)
  - **playable**: Affects gameplay but machine is still playable (e.g., shot not registering)
  - **unplayable**: Machine cannot be played
- Issue status: `new` → `in_progress` → `resolved`
- Assign issue to a member
- Add comments to issues
- Issue timeline (status changes, assignments, comments)
- Filter issues by: status, severity, machine, assignee
- Issue detail page

**Not Included:**

- ❌ Priority field (MVP+ if needed)
- ❌ Issue photos (MVP+)
- ❌ Custom statuses (1.0+)
- ❌ Issue templates (1.0+)
- ❌ Related issues (2.0+)
- ❌ Issue labels/tags (1.0+)
- ❌ Bulk operations (1.0+)
- ❌ Due dates (1.0+)
- ❌ Email notifications (1.0)

**Done When:**

- [ ] Can create an issue for a machine
- [ ] Can view issue detail with full timeline
- [ ] Can change status (new/in_progress/resolved)
- [ ] Can assign to members
- [ ] Can add comments
- [ ] Can filter issue list by all criteria
- [ ] Timeline shows all changes chronologically

---

### 4. Public Issue Reporting

**Included:**

- Public-facing form to report issues (no login required)
- Requires: machine selection, title, description, severity
- Shows submission confirmation
- Anonymous submissions (no email capture)

**Not Included:**

- ❌ Email capture for follow-up (MVP+)
- ❌ Guest account creation (MVP+)
- ❌ Public issue browsing (MVP+)
- ❌ Photo uploads (MVP+)
- ❌ Rate limiting (add if abused)
- ❌ CAPTCHA (add if abused)

**Done When:**

- [ ] Public form accessible without login
- [ ] Can select machine, severity, and submit issue
- [ ] Issue appears in member dashboard
- [ ] Confirmation shown after submission

---

### 5. Dashboard & Lists

**Included:**

- Member dashboard showing:
  - Issues assigned to me
  - Recently reported issues
  - Unplayable machines (critical attention needed)
  - Quick stats (open issues, machines needing service)
- Issues list with filtering (status, severity, machine, assignee)
- Machine list (simple, no search yet)
- **Public landing page**: Dashboard serves as public landing for unauthenticated users (read-only view)

**Not Included:**

- ❌ Customizable dashboard (2.0+)
- ❌ Analytics/charts (2.0+)
- ❌ Export to CSV (1.0+)
- ❌ Saved filters (1.0+)
- ❌ Activity feed (1.0+)

**Done When:**

- [ ] Dashboard shows key issue views
- [ ] Shows basic stats
- [ ] Issue list is filterable
- [ ] Machine list displays all machines

---

## MVP+ Scope (Immediate Next Features)

These make MVP practical for daily use:

### Usability Enhancements

- **Machine model info**: Manufacturer, year, model, location
- **Machine search**: Find machines quickly as fleet grows
- **Machine photos**: Identify machines visually
- **Machine ownership**: Machines owned by members, notifications to owners
- **Issue photos**: Upload photos with issues for better clarity
- **QR codes**: Generate QR codes for machines, link directly to issue reporting

### User Experience

- **Guest accounts**: Self-service guest sign-up for public reporters
- **Email capture**: Optional email on public reports for follow-up
- **Recent issues per machine**: Show last 5 issues on machine page

### Polish

- **Machine search**: Filter/search machine list
- **Better mobile UX**: Optimized layouts for on-site repairs
- **Issue priority**: Add priority field if severity isn't enough

---

## 1.0 Scope (Full-Featured Single-Tenant)

Major features that complete the vision:

### Notifications

- **Email notifications**: Assignments, status changes, comments
- **In-app notifications**: Notification bell with unread count

### Roles & Permissions

- **Guest role**: Can only report issues (read-only otherwise)
- **Member role**: Can manage issues, machines, assignments
- **Admin role**: Can manage users, roles, system settings

### Integration

- **OPDB integration**: Pull machine data from OPDB (Open Pinball Database)
- **Social login**: Google, GitHub for easier onboarding

### Machine Management

- **Locations**: Track which location each machine is at
- **Machine notes**: Tournament setup notes, known issues, maintenance history
- **Self-service guest accounts**: Public users can create guest accounts

### Issue Management

- **Custom issue statuses**: Beyond new/in_progress/resolved (1.0+)
- **Saved filters**: Save and name common filter combinations (1.0+)
- **Bulk operations**: Archive multiple resolved issues (1.0+)
- **Issue labels/tags**: Categorize issues (electrical, mechanical, cosmetic) (1.0+)

---

## 2.0+ Scope (Long-Term Vision)

### Multi-Tenancy

- Support multiple organizations
- Organization-scoped data isolation
- Organization switching
- Billing/subscriptions if SaaS

### Advanced Features

- **Analytics**: Resolution times, common problems, active users (2.0+)
- **Third-party integrations**: Webhooks, API access
- **Parts inventory**: Track parts and link to machines
- **AI features**: Auto-categorization, duplicate detection

---

## Explicit Non-Goals

**Things we're NOT building:**

### Not Applicable

- ❌ SLA tracking - Not a helpdesk tool
- ❌ SMS notifications - Email is sufficient
- ❌ Time tracking - Not needed for hobby repairs
- ❌ Social features - Not a social network
- ❌ Forums/discussion boards - Stay focused on issues
- ❌ Event management - Use dedicated tools

### Not Prioritized

- Mobile native apps (PWA is sufficient)
- Offline support (online-first is fine)
- Video uploads (photos are enough)
- Custom workflows (keep it simple)
- White labeling (not a SaaS yet)

---

## The Scope Firewall

**Before adding ANYTHING to MVP, ask:**

1. ✅ Is it one of the 5 core features?
2. ✅ Is it required for the core feature to work?
3. ✅ Would MVP be useless without it?

If not 3/3 yes → **It goes in MVP+ or later.**

**Examples:**

| Feature             | Include? | Why?                                     |
| ------------------- | -------- | ---------------------------------------- |
| Issue comments      | ✅ MVP   | Core feature #3 explicitly includes it   |
| Issue photos        | ❌ MVP+  | Text descriptions work for MVP           |
| Machine name        | ✅ MVP   | Can't track without identifying machines |
| Machine model       | ❌ MVP+  | Name is sufficient initially             |
| Email notifications | ❌ 1.0   | Nice to have, not required for tracking  |
| QR codes            | ❌ MVP+  | Makes reporting easier but not essential |
| Saved filters       | ❌ 1.0+  | Can re-apply filters manually            |

---

## Feature Completion Definition

A feature is "done" when:

1. ✅ **Happy path works** - Primary use case functions correctly
2. ✅ **Basic errors handled** - User sees friendly error messages
3. ✅ **Critical path tested** - Integration test or E2E test passes
4. ✅ **Works on mobile** - Responsive design, no broken layouts
5. ✅ **No security holes** - Input validation, auth checks in place

A feature is **NOT** "done" when:

- Every edge case is handled
- It has perfect UX polish
- Test coverage is 100%
- It handles every possible error gracefully

**Perfect is the enemy of shipped.**

---

## Success Metrics

### MVP Success

- ✅ Austin Pinball Collective members are using it
- ✅ Issues are being created and resolved
- ✅ Anonymous public reports are coming in
- ✅ No data loss, no critical bugs
- ✅ Core workflows work reliably

### MVP+ Success

- ✅ Members prefer PinPoint over existing methods
- ✅ QR codes deployed on machines
- ✅ Photo attachments improve issue clarity
- ✅ Machine search helps find machines quickly

### 1.0 Success

- ✅ Email notifications keep members informed
- ✅ Guest users can self-serve
- ✅ OPDB integration reduces manual data entry
- ✅ Multiple locations supported if APC expands

---

## Environment Strategy

**Two Supabase Projects:**

### Preview Environment

- Database with test/seed data
- Safe for experimentation
- Used for development and staging
- Can be reset/rebuilt freely

### Production Environment

- Real member data
- Strict change control
- Backups configured
- Monitoring enabled

**No data sharing between environments.**

---

## Decisions Log

| Date       | Question                   | Decision                  | Rationale                               |
| ---------- | -------------------------- | ------------------------- | --------------------------------------- |
| 2025-11-10 | Support multiple orgs?     | 2.0                       | Single tenant simplifies architecture   |
| 2025-11-10 | Issue severity levels?     | minor/playable/unplayable | Clear, player-centric language          |
| 2025-11-10 | Issues per-machine always? | Yes                       | Aligns with reality, simplifies queries |
| 2025-11-10 | Email notifications?       | 1.0                       | Important but not required for MVP      |
| 2025-11-10 | Photo attachments?         | MVP+                      | Adds clarity but text works initially   |
| 2025-11-10 | QR codes?                  | MVP+                      | High impact but not blocking            |
| 2025-11-10 | Machine model info?        | MVP+                      | Name is sufficient to start             |
| 2025-11-10 | Next.js version?           | 16 (latest)               | Use latest stable release               |

---

**Remember**: This spec is your defense against scope creep. When in doubt, defer to later release.
