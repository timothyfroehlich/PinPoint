# PinPoint Product Specification v2.0

**Last Updated**: 2025-11-10
**Status**: ACTIVE - This is the source of truth for scope decisions

## Mission Statement

Enable the Austin Pinball Collective to efficiently log, track, and resolve pinball machine issues.

**Target User**: Single organization (Austin Pinball Collective)
**Timeline**: MVP in weeks, not months
**Philosophy**: Working software over comprehensive features

---

## Core Value Proposition

A focused issue tracking system for pinball machines that:
- Takes 30 seconds to report an issue
- Shows maintenance staff what needs attention
- Provides public transparency for players
- Maintains complete issue history per machine

---

## The 5 Core Features (v1.0 Scope)

### 1. User Accounts & Authentication

**What's Included:**
- Email/password sign-up and login via Supabase Auth
- Basic profile (name, email, avatar)
- Password reset flow
- Two user types: Members (can do everything) and Public (can only report)

**What's NOT Included:**
- ❌ Social login (Google, GitHub, etc.)
- ❌ Complex role hierarchies
- ❌ User permissions matrix
- ❌ Team management
- ❌ User activity tracking

**Done When:**
- [ ] Users can sign up with email
- [ ] Users can log in
- [ ] Users can reset password
- [ ] Public users can access issue reporting
- [ ] Members can access all features

---

### 2. Machine Registry

**What's Included:**
- Machine profile page (name, manufacturer, year, model, location, photo)
- List of all machines
- Search machines by name
- Machine status indicator (operational, needs service, out of order)
- Link to machine's issue list

**What's NOT Included:**
- ❌ Machine categories/tags
- ❌ Machine history tracking
- ❌ Parts inventory per machine
- ❌ Maintenance schedules
- ❌ Service history separate from issues
- ❌ Multiple locations per machine
- ❌ QR code generation for machines

**Done When:**
- [ ] Can create a machine with basic info
- [ ] Can view machine detail page
- [ ] Can see all machines in a list
- [ ] Can search for machines
- [ ] Machine shows current status based on open issues
- [ ] Machine page shows its issues

---

### 3. Issue Tracking & Resolution

**What's Included:**
- Create issue with: title, description, machine, severity (low/medium/high/critical), reporter
- Issue status: New → In Progress → Resolved
- Issue priority: Low → Medium → High
- Assign issue to a member
- Add comments to issues
- Issue timeline (status changes, assignments, comments)
- Filter issues by: status, severity, priority, machine, assignee
- Issue detail page

**What's NOT Included:**
- ❌ Custom statuses beyond the 3 core states
- ❌ Issue templates
- ❌ Related issues / dependencies
- ❌ Issue labels/tags
- ❌ Bulk operations
- ❌ Due dates
- ❌ Time tracking
- ❌ Recurring issues
- ❌ Email notifications
- ❌ Issue attachments/photos (v1.0)

**Done When:**
- [ ] Can create an issue for a machine
- [ ] Can view issue detail with full timeline
- [ ] Can change status (New/In Progress/Resolved)
- [ ] Can assign to members
- [ ] Can add comments
- [ ] Can filter issue list by all criteria
- [ ] Timeline shows all changes chronologically

---

### 4. Public Issue Reporting

**What's Included:**
- Public-facing form to report issues (no login required for submission)
- Requires: machine selection, title, description
- Optional: email for follow-up
- Shows submission confirmation
- Public reporter can optionally create account to track their reports

**What's NOT Included:**
- ❌ Public issue browsing (issues are private to members)
- ❌ Status updates to public reporters
- ❌ Public API
- ❌ Rate limiting (v1.0 - add if abused)
- ❌ CAPTCHA (v1.0 - add if abused)
- ❌ Photo uploads from public

**Done When:**
- [ ] Public form accessible without login
- [ ] Can select machine and submit issue
- [ ] Issue appears in member dashboard
- [ ] Confirmation shown after submission

---

### 5. Dashboard & Lists

**What's Included:**
- Member dashboard showing:
  - Issues assigned to me
  - Recently reported issues
  - Critical/high priority issues
  - Quick stats (open issues, machines needing service)
- Issues list with filtering (status, priority, severity, machine, assignee)
- Machine list with search

**What's NOT Included:**
- ❌ Customizable dashboard widgets
- ❌ Analytics/charts
- ❌ Export to CSV
- ❌ Saved filters
- ❌ Sorting options beyond default
- ❌ Activity feed

**Done When:**
- [ ] Dashboard shows key issue views
- [ ] Shows basic stats
- [ ] Issue list is filterable
- [ ] Machine list is searchable

---

## Explicit Non-Goals (v1.0)

These are good ideas for later, but NOT in v1.0:

### Multi-Tenancy
- ❌ Multiple organizations
- ❌ Organization switching
- ❌ Org-scoped data isolation via RLS
- ❌ Organization settings/management

### Advanced Features
- ❌ Real-time collaboration (presence, live updates)
- ❌ Mobile apps
- ❌ Offline support
- ❌ Notifications (email, push, SMS)
- ❌ Integrations (Slack, Discord, etc.)
- ❌ API for external tools
- ❌ Webhooks
- ❌ Advanced reporting/analytics

### Rich Content
- ❌ Photo/file attachments on issues
- ❌ Rich text editor (Markdown is fine)
- ❌ Video uploads
- ❌ Drawing/annotation tools

### Workflow Automation
- ❌ Automatic assignments
- ❌ SLA tracking
- ❌ Escalation rules
- ❌ Custom workflows

---

## Success Metrics (v1.0)

**Functionality:**
- All 5 core features work reliably
- Public can report issues in <30 seconds
- Members can find and update issues in <10 seconds
- Zero data loss

**Quality:**
- 80%+ test coverage for critical paths
- No P0 security issues
- Works on mobile browsers
- Loads in <2 seconds

**Adoption:**
- Austin Pinball Collective is actively using it
- Receiving public issue reports
- Issues being tracked through to resolution

---

## The Scope Firewall

**Before adding ANYTHING to v1.0, ask:**

1. ✅ Is it one of the 5 core features?
2. ✅ Is it required for the core feature to work?
3. ✅ Would v1.0 be useless without it?

If not 3/3 yes → **It goes in the v2 backlog.**

**Examples:**

| Feature | Include? | Why? |
|---------|----------|------|
| Issue comments | ✅ Yes | Core feature #3 explicitly includes it |
| Email notifications | ❌ No | Nice to have, not required for tracking |
| Machine photos | ✅ Yes | Helps identify machines, simple to implement |
| File attachments | ❌ No | Adds complexity, can describe issues in text |
| Password reset | ✅ Yes | Required for auth to be usable |
| Social login | ❌ No | Email/password is sufficient |
| Issue filtering | ✅ Yes | Core feature #3 explicitly includes it |
| Saved filters | ❌ No | Can re-apply filters manually |

---

## Feature Completion Definition

A feature is "done" when:

1. ✅ Core functionality works (happy path)
2. ✅ Basic error handling exists (shows user-friendly errors)
3. ✅ Critical paths have tests
4. ✅ Works on mobile browsers
5. ✅ No obvious security holes

A feature is **NOT** "done" when:
- Every edge case is handled
- It has perfect UX polish
- Test coverage is 100%
- It handles every possible error gracefully

**Perfect is the enemy of shipped.**

---

## Timeline & Phases

### Phase 1: Foundation (Week 1)
- Project setup
- Auth (sign up, login, logout)
- Machine creation & listing
- Basic navigation

### Phase 2: Core Issue Tracking (Week 2)
- Issue creation, viewing, editing
- Status & assignment changes
- Comments
- Basic filtering

### Phase 3: Public Reporting (Week 3)
- Public issue form
- Form validation
- Submission confirmation

### Phase 4: Polish & Deploy (Week 4)
- Dashboard views
- Bug fixes
- Tests for critical paths
- Deploy to production

**Total: 4 weeks to v1.0**

---

## V2 Backlog (Post-MVP)

See `V2_ROADMAP.md` for prioritized enhancements after v1.0 ships.

---

## Questions & Decisions Log

| Date | Question | Decision | Rationale |
|------|----------|----------|-----------|
| 2025-11-10 | Support multiple orgs? | No | Single tenant reduces complexity by 40% |
| 2025-11-10 | Email notifications? | v2 | Not required for core tracking functionality |
| 2025-11-10 | Photo attachments? | v2 | Text descriptions sufficient for v1 |

---

**Remember**: This spec is your defense against scope creep. When in doubt, ship v1.0 first, then enhance.
