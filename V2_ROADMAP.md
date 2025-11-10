# PinPoint v2.0+ Roadmap

**Last Updated**: 2025-11-10
**Status**: PARKING LOT - Ideas deferred from v1.0

## Purpose

This document captures **good ideas that aren't essential for v1.0**. Everything here gets reconsidered AFTER v1.0 ships and you have real user feedback.

---

## Prioritization Framework

After v1.0 launches, prioritize based on:

1. **User Requests** - What are Austin Pinball Collective members actually asking for?
2. **Pain Points** - What's causing the most friction in daily use?
3. **Impact** - What delivers the most value for the least effort?
4. **Delight Factor** - What would make users love it vs. just use it?

**Don't build based on:**
- ❌ What you THINK users will want
- ❌ What's technically interesting
- ❌ What other tools have
- ❌ What's easy to build

---

## v2.0 Features (Post-Launch Enhancements)

### Tier 1: High Impact, Likely Essential

**These are "obviously next" based on expected usage:**

#### 📸 Photo Attachments
**Problem:** Text descriptions don't always capture the issue clearly
**Solution:** Allow uploading 1-3 photos per issue
**Scope:**
- Upload on issue creation and comments
- Display in issue timeline
- Supabase Storage integration
- File type validation (JPEG, PNG, HEIC)
- Max 5MB per file
**Effort:** Medium (2-3 days)
**Dependencies:** None

#### 📧 Email Notifications
**Problem:** Members don't know when they're assigned or when issues update
**Solution:** Send email on key events
**Scope:**
- Notify on assignment
- Notify on status change (if assigned or reporter)
- Notify on new comments (if participating)
- Unsubscribe option per notification type
- Use Supabase Edge Functions + Resend/SendGrid
**Effort:** Medium (3-4 days)
**Dependencies:** None

#### 🔍 Enhanced Search
**Problem:** Basic machine search isn't enough for large fleets
**Solution:** Full-text search across issues and machines
**Scope:**
- Search issue titles and descriptions
- Search machine names, manufacturers, models
- Fuzzy matching
- Search results page
- Use PostgreSQL full-text search
**Effort:** Small (2 days)
**Dependencies:** None

#### 📊 Basic Analytics
**Problem:** No visibility into resolution times, common problems, active users
**Solution:** Simple dashboard with key metrics
**Scope:**
- Average resolution time per severity
- Top 5 machines by issue count
- Issues resolved this week/month
- Most active members
- Use Drizzle aggregation queries
**Effort:** Medium (3-4 days)
**Dependencies:** Need historical data from v1.0

#### 🔖 Saved Filters
**Problem:** Members repeatedly apply the same filters
**Solution:** Save and name filter combinations
**Scope:**
- Save current filter state
- Name it (e.g., "Critical Open Issues")
- Quick access to saved filters
- Personal to each user
**Effort:** Small (2 days)
**Dependencies:** None

---

### Tier 2: Medium Impact, Nice to Have

**These add polish and convenience:**

#### 🎨 Rich Text Editor
**Problem:** Plain text limits formatting (bold, lists, links)
**Solution:** Markdown editor with preview
**Scope:**
- Markdown editor for descriptions/comments
- Live preview
- Basic formatting toolbar
- Use library like react-markdown
**Effort:** Small (2 days)
**Dependencies:** None

#### 📱 PWA (Progressive Web App)
**Problem:** Members want quick access from home screen
**Solution:** Add PWA manifest and service worker
**Scope:**
- Install prompt
- Offline access to cached data
- Push notifications (if enabled)
- App icon
**Effort:** Medium (3-4 days)
**Dependencies:** Service worker complexity

#### 🏷️ Issue Labels/Tags
**Problem:** Issues need categorization beyond severity (electrical, mechanical, cosmetic)
**Solution:** Custom labels
**Scope:**
- Admin can create labels (name, color)
- Apply multiple labels per issue
- Filter by label
- Suggest labels based on machine type
**Effort:** Medium (3 days)
**Dependencies:** None

#### ⏱️ Time Tracking
**Problem:** Want to know how long repairs take
**Solution:** Log time spent on issues
**Scope:**
- "Start work" / "Stop work" button
- Manual time entry
- Show total time in issue timeline
- Report: time per machine, per member
**Effort:** Medium (3-4 days)
**Dependencies:** None

#### 🔔 In-App Notifications
**Problem:** Email notifications can be missed
**Solution:** Notification bell in nav
**Scope:**
- Badge count for unread
- Notification list
- Mark as read
- Link to relevant issue
- Supabase Realtime for instant updates
**Effort:** Medium (3 days)
**Dependencies:** Real-time infrastructure

#### 📅 Maintenance Schedules
**Problem:** Preventive maintenance is ad-hoc
**Solution:** Schedule recurring tasks per machine
**Scope:**
- Create maintenance task template
- Set recurrence (weekly, monthly)
- Auto-create issues on schedule
- Mark as maintenance vs. repair
**Effort:** Large (5-7 days)
**Dependencies:** Cron job infrastructure

---

### Tier 3: Low Priority, Future Exploration

**These are interesting but not proven needs:**

#### 🤝 Public Issue Tracking
**Problem:** Players want to see issue status
**Solution:** Public issue list (read-only)
**Scope:**
- Public page showing open issues per machine
- Status updates visible
- Comments hidden (privacy)
- Optional: QR codes on machines link to issue list
**Effort:** Medium (3 days)
**Dependencies:** Privacy review

#### 🔗 Third-Party Integrations
**Problem:** Want to integrate with other tools
**Solution:** Webhooks or API
**Scope:**
- Webhook on issue create/update/resolve
- REST API for external tools
- API authentication
- Rate limiting
**Effort:** Large (7+ days)
**Dependencies:** API design, documentation

#### 📦 Parts Inventory
**Problem:** Don't know which parts are in stock
**Solution:** Simple inventory tracking
**Scope:**
- Part catalog (name, quantity, location)
- Link parts to machines
- Link parts to issues
- Alert when low stock
**Effort:** Large (7+ days)
**Dependencies:** Significant scope expansion

#### 🤖 AI Features
**Problem:** Repetitive issue triage
**Solution:** AI-assisted categorization
**Scope:**
- Suggest severity based on description
- Suggest machine based on description
- Auto-summarize long issues
- Detect duplicate issues
**Effort:** Large (varies, ongoing)
**Dependencies:** OpenAI API, cost considerations

#### 🌐 Multi-Organization Support
**Problem:** Other pinball arcades want to use PinPoint
**Solution:** Add organization scoping back
**Scope:**
- Organization model
- Org-level RLS policies
- Org switching UI
- Invite system
- This is essentially PinPoint v3.0
**Effort:** Massive (20+ days, architectural shift)
**Dependencies:** Product-market fit validation

#### 📲 Native Mobile Apps
**Problem:** PWA limitations on iOS
**Solution:** React Native apps
**Scope:**
- iOS and Android apps
- Offline support
- Push notifications
- App store distribution
**Effort:** Massive (30+ days, new expertise)
**Dependencies:** Proven web app success

---

## Feature Ideas Inbox

**Unsorted ideas that need more thought:**

- [ ] Issue dependencies (block on other issues)
- [ ] Machine grouping (zones, areas)
- [ ] Custom fields per machine type
- [ ] Issue templates ("Flipper not working", "Display issue")
- [ ] Bulk operations (reassign multiple issues)
- [ ] Issue duplication
- [ ] Export reports to PDF/CSV
- [ ] Dark mode (or respect system preference)
- [ ] User activity feed
- [ ] @mentions in comments
- [ ] Issue voting (let members upvote important issues)
- [ ] Machine QR codes for quick reporting
- [ ] Slack/Discord integration
- [ ] SMS notifications for critical issues
- [ ] Role-based permissions (viewer, tech, admin)
- [ ] Issue SLA tracking
- [ ] Automatic assignment based on machine type
- [ ] Machine maintenance logs (separate from issues)
- [ ] Integration with PinballMap API
- [ ] Issue resolution knowledge base
- [ ] Machine manual storage/links
- [ ] Gamification (badges for resolving issues)
- [ ] Multi-language support
- [ ] Accessibility audit and improvements
- [ ] Custom issue statuses beyond new/in-progress/resolved

---

## Anti-Roadmap (Things We're NOT Building)

**Features that sound good but don't align with mission:**

- ❌ **Social Features** - Not building a social network
- ❌ **Forums/Discussion Boards** - Stay focused on issue tracking
- ❌ **Event Management** - Use dedicated event tools
- ❌ **Member Management** - Supabase handles this
- ❌ **Billing/Payments** - Not a commercial tool (yet)
- ❌ **CMS Features** - Not a content platform
- ❌ **Custom Workflows** - Keep it simple
- ❌ **White Labeling** - Not a SaaS product (yet)

---

## Launch Strategy (Post-v1.0)

### Phase 1: Stabilization (Weeks 1-2)
**Goal:** Fix critical bugs, gather feedback

- Monitor usage patterns
- Fix P0 bugs immediately
- Collect user feedback via form or interviews
- Review analytics (if implemented)
- Assess which v2 features are actually requested

### Phase 2: Polish (Weeks 3-4)
**Goal:** Improve UX based on real usage

- Fix most painful UX issues
- Improve mobile experience if needed
- Add small quality-of-life features
- Improve error messages based on support requests

### Phase 3: v2 Planning (Week 5)
**Goal:** Data-driven roadmap for v2.0

- Review V2_ROADMAP.md
- Interview 3-5 active users
- Prioritize features based on actual requests
- Estimate effort for top 5 features
- Decide: v2 enhancements OR multi-org expansion

### Phase 4: v2 Development (Weeks 6+)
**Goal:** Ship most impactful features

- Build top 3-5 features from Tier 1
- Maintain same discipline (DISCIPLINE.md still applies)
- Ship incrementally (feature flags if needed)
- Continue gathering feedback

---

## Decision Framework (Post-v1.0)

### Before Building ANY v2 Feature:

1. **Has a user explicitly requested it?**
   - Bonus points if multiple users asked
   - Extra bonus if they explained the pain point

2. **Can you measure the impact?**
   - How will you know if it's successful?
   - What metric improves?

3. **What's the effort/impact ratio?**
   - High impact + low effort = build now
   - High impact + high effort = consider
   - Low impact + low effort = maybe
   - Low impact + high effort = defer

4. **Does it align with core mission?**
   - Issue tracking for pinball machines
   - If it's a tangent, reconsider

### Example Analysis:

**Feature: Photo Attachments**
1. ✅ Users: "Hard to describe electrical issues in text"
2. ✅ Measure: % of issues with photos, clarity improvement
3. ✅ Effort/Impact: Medium effort, high impact
4. ✅ Mission: Directly improves issue reporting

**Decision: BUILD**

**Feature: Gamification/Badges**
1. ❌ Users: No one asked for this
2. ❓ Measure: Unclear what success looks like
3. ❌ Effort/Impact: Medium effort, unclear impact
4. ❓ Mission: Tangential to issue tracking

**Decision: DEFER**

---

## Monthly Roadmap Review

**First Monday of each month:**

1. Review what shipped last month
2. Gather user feedback from last month
3. Re-prioritize this roadmap based on data
4. Move 1-2 features from Tier 2/3 to Tier 1 (or vice versa)
5. Archive ideas that are no longer relevant
6. Add new ideas to Inbox

**Keep it fresh, keep it real.**

---

## Success Metrics (v2.0+)

### Usage Metrics
- Daily active members
- Issues created per week
- Average time to resolution
- Issues resolved per member
- Mobile vs. desktop usage

### Feature Adoption
- % of issues with photos (if implemented)
- Notification open rate (if implemented)
- Saved filters created (if implemented)
- Search usage (if implemented)

### Quality Metrics
- User-reported bugs per week (trending down?)
- Support requests per week
- Net Promoter Score (NPS) - would you recommend?

---

## Expansion Considerations (v3.0+)

**If PinPoint succeeds beyond Austin Pinball Collective:**

### Multi-Organization SaaS
- Organization onboarding flow
- Billing/subscriptions (Stripe)
- Organization-scoped RLS policies
- Custom domains per org
- User limits per plan

### Freemium Model
**Free Tier:**
- 1 organization
- 3 users
- 10 machines
- Basic features

**Pro Tier ($X/month):**
- Unlimited users
- Unlimited machines
- Photo attachments
- Email notifications
- Analytics
- Priority support

**Enterprise Tier (Custom):**
- Multiple organizations
- API access
- SSO
- Custom integrations
- Dedicated support

**Note:** Only consider this if:
- ✅ Austin Pinball Collective loves it
- ✅ Other arcades are asking for it
- ✅ You want to run a SaaS business
- ✅ You've validated willingness to pay

---

## The Long-Term Vision

**Where could PinPoint go?**

### Scenario 1: Focused Tool
- Stay single-org
- Deep integration with Austin Pinball Collective workflows
- Custom features for their specific needs
- Open source for other arcades to self-host

### Scenario 2: Multi-Tenant SaaS
- Expand to other pinball arcades
- Standardized feature set
- Paid plans
- Support multiple organizations

### Scenario 3: Platform
- API-first approach
- Integrate with pinball industry tools
- Parts suppliers integration
- Service provider network
- Marketplace for pinball services

**Don't decide now. Let v1.0 usage guide you.**

---

## Graduation Criteria

**When to move features from this roadmap to active development:**

1. ✅ v1.0 is stable (no critical bugs)
2. ✅ Feature has been requested by 3+ users
3. ✅ Feature aligns with core mission
4. ✅ You have capacity to build and maintain it
5. ✅ Impact justifies effort

**Update this roadmap quarterly based on reality, not assumptions.**

---

**Remember:** This is a parking lot, not a commitment. Build what users actually need, not what you think they might need.
