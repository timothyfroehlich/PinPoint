# PinPoint Development Discipline

**Last Updated**: 2025-11-10
**Status**: ACTIVE - Your defense against scope creep

## The Prime Directive

> **Ship v1.0 before perfecting any single feature.**

Everything in this document exists to help you resist the urge to over-engineer, over-optimize, and over-complicate.

---

## The Scope Firewall

### Before Adding ANY Feature, Answer These:

1. **Is it in PRODUCT_SPEC.md?**
   - ✅ Yes → Proceed to question 2
   - ❌ No → Add to V2_ROADMAP.md and move on

2. **Is it required for the core feature to work?**
   - ✅ Yes → Proceed to question 3
   - ❌ No → Add to V2_ROADMAP.md and move on

3. **Would v1.0 be useless without it?**
   - ✅ Yes → Implement it
   - ❌ No → Add to V2_ROADMAP.md and move on

**Example Decisions:**

| Feature Request | Q1 | Q2 | Q3 | Decision |
|----------------|----|----|----|----|
| Issue comments | ✅ | ✅ | ✅ | **IMPLEMENT** (in spec, required) |
| Email notifications | ❌ | ❌ | ❌ | **V2** (not in spec) |
| Rich text editor | ❌ | ❌ | ❌ | **V2** (plain text works) |
| Issue filtering | ✅ | ✅ | ✅ | **IMPLEMENT** (in spec) |
| Saved filters | ❌ | ❌ | ❌ | **V2** (can re-apply manually) |
| File attachments | ❌ | ❌ | ❌ | **V2** (text description works) |
| Password reset | ✅ | ✅ | ✅ | **IMPLEMENT** (auth is useless without it) |

---

## The "Done Enough" Standard

### A Feature is DONE When:

1. ✅ **Happy path works** - Primary use case functions correctly
2. ✅ **Basic errors handled** - User sees friendly error messages
3. ✅ **Critical path tested** - Integration test or E2E test passes
4. ✅ **Works on mobile** - Responsive design, no broken layouts
5. ✅ **No security holes** - Input validation, auth checks in place

### A Feature is NOT DONE When:

- ❌ Every edge case is handled
- ❌ Error messages are perfectly worded
- ❌ Test coverage is 100%
- ❌ UI is pixel-perfect
- ❌ Performance is optimized
- ❌ Code is perfectly DRY
- ❌ You've thought of every possible improvement

**Examples:**

**Issue Creation Form:**
- ✅ DONE: Form submits, creates issue, shows in list, validates required fields
- ❌ NOT REQUIRED: Auto-save draft, duplicate detection, AI title suggestions

**Machine Photos:**
- ✅ DONE: Can upload image, shows on machine page, validates file type
- ❌ NOT REQUIRED: Image cropping, filters, multiple photos, gallery view

---

## The "Just Ship It" Triggers

### When You Find Yourself Saying:

**"What if someone..."**
- STOP. That's v2 thinking. Does it affect the Austin Pinball Collective TODAY?

**"I should probably..."**
- STOP. Is it in PRODUCT_SPEC.md? No? Then you shouldn't.

**"This would be cool if..."**
- STOP. Cool isn't done. Ship first, cool later.

**"I'm just going to quickly refactor..."**
- STOP. Does the current code work? Yes? Then refactor in v2.

**"I need to add tests for..."**
- STOP. Do you have a test for the happy path? Yes? Ship it. Add more tests if bugs appear.

**"Let me add this abstraction because we might..."**
- STOP. YAGNI (You Aren't Gonna Need It). Build abstractions when you have 3 use cases, not before.

### Redirect to V2_ROADMAP.md

When you catch yourself wanting to add something, write it down:

```bash
# Add to V2_ROADMAP.md
echo "- [ ] Email notifications for issue updates" >> V2_ROADMAP.md
```

**This is not rejection, it's parking.** You're telling the idea "I see you, I value you, but not right now."

---

## The Anti-Pattern Checklist

### 🚨 Red Flags You're Over-Engineering:

- [ ] You're building infrastructure for "future organizations" (single tenant only!)
- [ ] You're creating abstractions with only one use case
- [ ] You're writing custom solutions when standard libraries exist
- [ ] You're solving problems that don't exist yet
- [ ] You're refactoring working code to make it "better"
- [ ] You're adding features "just in case"
- [ ] You're designing for scale you don't have
- [ ] You're creating complex permission systems (just use `is_member` boolean)
- [ ] You're adding caching before measuring performance
- [ ] You're building admin panels for data you could query manually

### ✅ Green Flags You're On Track:

- [ ] You're using Supabase/Drizzle/tRPC as designed (no custom wrappers)
- [ ] You're copying code when abstraction isn't obvious
- [ ] You're writing Server Actions directly in route files
- [ ] You're querying the database directly in Server Components
- [ ] You're using plain text instead of rich text editors
- [ ] You're using HTML forms instead of complex form libraries
- [ ] You're manually testing instead of writing 500 unit tests

---

## The Daily Standup (With Yourself)

### Every Coding Session, Ask:

1. **What am I building today?**
   - Is it in PRODUCT_SPEC.md?

2. **Why am I building it?**
   - Which of the 5 core features does it enable?

3. **How will I know it's done?**
   - What's the minimum viable version?

4. **What am I NOT building today?**
   - What v2 ideas am I parking?

**Example:**

> **Today:** Implementing issue filtering
> **Why:** Core feature #3 requires filtering by status, severity, machine
> **Done When:** Can apply filters, see filtered results, clear filters
> **NOT Doing:** Saved filters, complex queries, URL state persistence

---

## The "v2 Backlog" Pattern

### How to Use V2_ROADMAP.md

**When an idea strikes:**
1. Write it in V2_ROADMAP.md
2. Add a quick note why it's valuable
3. Forget about it until v1.0 ships

**Example entries:**

```markdown
## V2 Feature Ideas

### High Priority (Post-Launch)
- [ ] Email notifications - Members want updates when assigned
- [ ] Photo attachments - Helps visualize issues
- [ ] Mobile app - Members work on-site

### Medium Priority
- [ ] Saved filters - Frequent users repeat same filters
- [ ] Dashboard customization - Different roles want different views
- [ ] Bulk operations - Archive multiple resolved issues at once

### Low Priority
- [ ] Analytics - Track resolution times, common issues
- [ ] Integration with parts suppliers
- [ ] AI-assisted issue categorization
```

**Review quarterly:**
- Move items from v2 backlog to active development
- Delete ideas that no longer make sense
- Reprioritize based on real user feedback

---

## The Feature Flag Strategy (For v2)

When you inevitably need to build features incrementally:

### Don't Build Complex Feature Flags (v1.0)

- ❌ No feature flag service
- ❌ No environment variables for features
- ❌ No user-based feature rollouts

### Simple Approach:

**Use git branches:**
```bash
# Work on v2 feature in branch
git checkout -b feature/email-notifications

# Ship v1.0 from main
git checkout main
git push origin main

# Continue v2 work after v1.0 launches
git checkout feature/email-notifications
```

**Or use comments in code:**
```typescript
// V2: Add email notification here
// See V2_ROADMAP.md for spec
```

---

## The "Half-Finished Features" Prevention

### You Identified This Problem. Here's How to Avoid It:

**Rule: Finish vertically, not horizontally.**

**❌ Wrong (Horizontal Slicing):**
```
Week 1: Build all database tables
Week 2: Build all API routes
Week 3: Build all UI components
Week 4: Wire it all together
```
→ Nothing works until week 4

**✅ Right (Vertical Slicing):**
```
Week 1: Issue creation (DB + API + UI) - WORKS
Week 2: Issue viewing (DB + API + UI) - WORKS
Week 3: Issue editing (DB + API + UI) - WORKS
Week 4: Issue filtering (DB + API + UI) - WORKS
```
→ Something works every week

**Each feature should be:**
- Deployable independently
- Testable in isolation
- Usable by itself (even if basic)

**Example: Issue Tracking**

**Sprint 1 (Deliverable):**
- ✅ Create issue
- ✅ View issue
- ✅ Basic info only (title, description, machine)

**Sprint 2 (Deliverable):**
- ✅ Add comments
- ✅ Change status

**Sprint 3 (Deliverable):**
- ✅ Assign issues
- ✅ Filter by status

Each sprint delivers VALUE, not just code.

---

## The Refactoring Rules

### When to Refactor:

1. **Rule of Three** - Duplication becomes a problem at 3+ instances
2. **Pain Point** - Code is actively painful to work with
3. **Bug Magnet** - Same area keeps breaking
4. **Before Big Feature** - Refactor to make the new feature easier

### When NOT to Refactor:

1. ❌ "This could be cleaner" - Working code is good code
2. ❌ "I just learned a new pattern" - Don't refactor for novelty
3. ❌ "I'm bored, let me refactor" - Build features instead
4. ❌ "Future-proofing" - YAGNI applies

### Safe Refactoring Pattern:

```bash
# 1. Write test for current behavior
npm test -- issue-creation

# 2. Refactor
# ... make changes ...

# 3. Verify test still passes
npm test -- issue-creation

# 4. Ship if it works
git commit -m "refactor: simplify issue creation"
```

**Never refactor without tests** (integration or E2E minimum)

---

## The Technology Temptation

### ❌ Don't Add New Tech To v1.0

You have a proven stack:
- Next.js 15
- React 19
- Supabase
- Drizzle
- tRPC
- shadcn/ui
- Tailwind v4

**Temptations to Resist:**

| Temptation | Why It's Tempting | Why to Resist |
|------------|-------------------|---------------|
| Zustand/Redux | "Need global state" | Server Components + URL state is enough |
| Tanstack Query | "Better data fetching" | Server Components already handle this |
| Zod forms library | "Better validation" | HTML + Server Actions is simpler |
| Prisma | "Better than Drizzle" | You already know Drizzle |
| tRPC alternatives | "Heard about X" | tRPC works fine |
| CSS-in-JS | "Better styling" | Tailwind is working |
| Storybook | "Component docs" | Build features first |

### When You Can Add New Tech:

- ✅ After v1.0 ships
- ✅ When current solution is demonstrably failing
- ✅ When you have time to learn properly
- ✅ When the value is clear and immediate

---

## The Complexity Budget

### You Have a Fixed Complexity Budget. Spend Wisely.

**High Complexity (Save For Critical Features):**
- Auth flows (already done with Supabase)
- Real-time updates (if needed)
- File uploads (keep simple)

**Medium Complexity:**
- Filtering/search
- Form validation
- Timeline generation

**Low Complexity (Should Be Easy):**
- CRUD operations
- Lists and detail views
- Static pages

**If something feels high complexity, ask:**
1. Am I over-engineering?
2. Is there a simpler approach?
3. Can I use a library instead of building?
4. Can I defer this to v2?

---

## The "Good Enough" Examples

### Issue Creation

**Over-Engineered ❌:**
- Auto-save drafts
- Duplicate detection
- AI title suggestions
- Rich text editor
- Drag-and-drop attachments
- Preview mode
- Custom templates

**Good Enough ✅:**
- HTML form
- Title + description (plain text)
- Machine dropdown
- Submit button
- Show errors if validation fails

### Dashboard

**Over-Engineered ❌:**
- Customizable widgets
- Drag-and-drop layout
- Real-time updates
- Charts and graphs
- Saved views
- Export to PDF
- Email digests

**Good Enough ✅:**
- Static layout
- "My Issues" list
- "Recent Issues" list
- Simple counts
- Links to filtered views

---

## The Accountability System

### How to Stay Disciplined

**1. Public Commitment (Optional)**
Post in Discord/Slack:
> "Shipping PinPoint v1.0 by [DATE]. Only building: user auth, machines, issues, public reporting, dashboard. Everything else is v2."

**2. Weekly Reviews**
Every Friday:
- [ ] Did I ship vertical slices?
- [ ] Did I add to v2 backlog instead of v1?
- [ ] Did I finish features or start too many?
- [ ] Am I on track for 4-week timeline?

**3. Scope Check**
Before every PR:
```markdown
## Feature: [Name]

**Which core feature does this enable?** [1-5]
**Is this the minimum viable version?** [Yes/No]
**What did I defer to v2?** [List]
**Is it done enough?** [5-point checklist]
```

**4. Deploy Often**
Deploy to staging every Friday, even if incomplete.
- Seeing it live reveals what's actually important
- Creates urgency to finish features
- Prevents "almost done" syndrome

---

## The Hard Truths

### Embrace These Realities:

1. **v1.0 will be imperfect** - That's okay, v2 will fix it
2. **Users will request features you skipped** - That validates v2 priorities
3. **You'll cringe at your own code** - Ship it anyway, refactor in v2
4. **There will be bugs** - Fix critical ones, defer minor ones
5. **Someone will complain about UX** - Improve in v2 based on feedback
6. **You'll want to rebuild it "the right way"** - Resist until v1 ships

### Success Looks Like:

- ✅ Austin Pinball Collective is using it
- ✅ Issues are being tracked
- ✅ Public reports are coming in
- ✅ Core workflows work reliably
- ❌ NOT: Perfect code, 100% coverage, every feature polished

---

## The Emergency Brake

### If You're Feeling Overwhelmed:

**STOP. Review PRODUCT_SPEC.md.**

Ask yourself:
1. What's the ABSOLUTE minimum to call this feature "done"?
2. What can I delete right now?
3. What can I hardcode instead of making configurable?
4. What can I do manually instead of automating?

**Example Simplifications:**

| Current Approach | Simplified Approach |
|------------------|---------------------|
| User role management UI | Hardcode member list in database |
| Email notification system | Send manual emails via Supabase dashboard |
| Analytics dashboard | Run SQL queries manually |
| Complex filtering UI | Start with 3 basic filters only |
| Settings page | Hardcode settings in config file |

**Remember:** You can always add these later. AFTER v1.0 ships.

---

## The Victory Conditions

### You Win When:

1. ✅ PRODUCT_SPEC.md features all work
2. ✅ Austin Pinball Collective is actively using it
3. ✅ Critical paths have tests
4. ✅ It's deployed to production
5. ✅ No P0 security issues

**That's it.** Everything else is v2.

### Celebrate and Move to v2:

After v1.0 ships:
1. Take a week off
2. Collect user feedback
3. Review V2_ROADMAP.md
4. Prioritize based on actual usage (not assumptions)
5. Build v2 with same discipline

---

## Quick Reference Card

Print this and put it next to your monitor:

```
┌────────────────────────────────────────┐
│   PINPOINT DISCIPLINE CHECKLIST        │
├────────────────────────────────────────┤
│ Before adding ANY feature:             │
│ □ Is it in PRODUCT_SPEC.md?           │
│ □ Is it required to work?             │
│ □ Would v1 be useless without it?     │
│                                        │
│ If not 3/3 → V2_ROADMAP.md            │
├────────────────────────────────────────┤
│ Feature is "done" when:                │
│ □ Happy path works                     │
│ □ Errors handled (basic)              │
│ □ Critical path tested                │
│ □ Works on mobile                     │
│ □ No security holes                   │
├────────────────────────────────────────┤
│ STOP if you're:                        │
│ • "What if someone..."                 │
│ • "I should probably..."               │
│ • "This would be cool..."              │
│ • "Let me refactor..."                 │
│ • "I need to add..."                   │
│                                        │
│ → Write it in V2_ROADMAP.md           │
├────────────────────────────────────────┤
│ Ship v1.0 before perfecting v1.0      │
└────────────────────────────────────────┘
```

---

**Final Word:** Discipline is choosing what NOT to build. Ship v1.0, learn from reality, build v2 smarter.
