# PinPoint Development Discipline

**Last Updated**: 2025-11-10
**Status**: ACTIVE - Your defense against scope creep

## The Prime Directive

> **Ship MVP before perfecting any single feature.**

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

3. **Would MVP be useless without it?**
   - ✅ Yes → Implement it
   - ❌ No → Add to V2_ROADMAP.md and move on

**Example Decisions:**

| Feature Request     | Q1  | Q2  | Q3  | Decision                                |
| ------------------- | --- | --- | --- | --------------------------------------- |
| Issue comments      | ✅  | ✅  | ✅  | **IMPLEMENT** (in spec, required)       |
| Email notifications | ❌  | ❌  | ❌  | **MVP+/1.0** (not in MVP spec)          |
| Rich text editor    | ❌  | ❌  | ❌  | **1.0+** (plain text works)             |
| Issue filtering     | ✅  | ✅  | ✅  | **IMPLEMENT** (in spec)                 |
| Saved filters       | ❌  | ❌  | ❌  | **1.0+** (can re-apply manually)        |
| Photo attachments   | ❌  | ❌  | ❌  | **MVP+** (text works initially)         |
| Password reset      | ✅  | ✅  | ✅  | **IMPLEMENT** (auth useless without it) |

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

**Machine Registry:**

- ✅ DONE (MVP): Can create machine with name, shows in list
- ❌ NOT REQUIRED (MVP): Manufacturer, model, photos (those are MVP+)

---

## The "Just Ship It" Triggers

### When You Find Yourself Saying:

**"What if someone..."**

- STOP. That's future thinking. Does it affect Austin Pinball Collective TODAY?

**"I should probably..."**

- STOP. Is it in PRODUCT_SPEC.md? No? Then you shouldn't.

**"This would be cool if..."**

- STOP. Cool isn't done. Ship first, cool later.

**"I'm just going to quickly refactor..."**

- STOP. Does the current code work? Yes? Then refactor later.

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

- [ ] You're building for "future organizations" (single tenant only until 2.0!)
- [ ] You're creating abstractions with only one use case
- [ ] You're writing custom solutions when libraries exist
- [ ] You're solving problems that don't exist yet
- [ ] You're refactoring working code to make it "better"
- [ ] You're adding features "just in case"
- [ ] You're designing for scale you don't have
- [ ] You're creating complex permission systems (just use `role` field)
- [ ] You're adding caching before measuring performance
- [ ] You're building admin panels for data you could query manually

### ✅ Green Flags You're On Track:

- [ ] You're using Supabase/Drizzle as designed (no custom wrappers)
- [ ] You're copying code when abstraction isn't obvious
- [ ] You're writing Server Actions directly in route files
- [ ] You're querying database directly in Server Components
- [ ] You're using plain text instead of rich text editors
- [ ] You're using HTML forms with progressive enhancement
- [ ] You're manually testing before writing 500 unit tests

---

## The "v2 Backlog" Pattern

### How to Use V2_ROADMAP.md

**When an idea strikes:**

1. Write it in V2_ROADMAP.md
2. Add a quick note why it's valuable
3. Forget about it until MVP ships

**Example entries:**

```markdown
## MVP+ Feature Ideas

### High Priority (Post-MVP)

- [ ] QR codes - Makes issue reporting effortless
- [ ] Machine photos - Visual identification
- [ ] Issue photos - Better problem clarity

### 1.0 Features

- [ ] Email notifications - Keep members informed
- [ ] OPDB integration - Faster machine setup
- [ ] Saved filters - Frequent workflows

### 2.0 Features

- [ ] Multi-tenancy - Support other arcades
- [ ] Analytics - Track patterns
```

**Review monthly:**

- Move items based on user feedback
- Delete ideas that no longer make sense
- Reprioritize based on real usage

---

## The "Half-Finished Features" Prevention

### You Identified This Problem. Here's How to Avoid It:

**Rule: Finish vertically, not horizontally.**

**❌ Wrong (Horizontal Slicing):**

```
Session 1: Build all database tables
Session 2: Build all API routes
Session 3: Build all UI components
Session 4: Wire it all together
```

→ Nothing works until session 4

**✅ Right (Vertical Slicing):**

```
Session 1: Issue creation (DB + Action + UI) - WORKS
Session 2: Issue viewing (DB + Action + UI) - WORKS
Session 3: Issue editing (DB + Action + UI) - WORKS
Session 4: Issue filtering (DB + Action + UI) - WORKS
```

→ Something works every session

**Each feature should be:**

- Deployable independently
- Testable in isolation
- Usable by itself (even if basic)

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

**Never refactor without tests** (integration or E2E minimum).

---

## The Technology Temptation

### ❌ Don't Add New Tech To MVP

You have a proven stack:

- Next.js 16
- React 19
- Supabase
- Drizzle
- tRPC (minimal)
- shadcn/ui
- Tailwind v4

**Temptations to Resist:**

| Temptation      | Why It's Tempting      | Why to Resist                           |
| --------------- | ---------------------- | --------------------------------------- |
| Zustand/Redux   | "Need global state"    | Server Components + URL state is enough |
| Tanstack Query  | "Better data fetching" | Server Components already handle this   |
| React Hook Form | "Better validation"    | HTML + Server Actions is simpler        |
| Prisma          | "Better than Drizzle"  | You already chose Drizzle               |
| CSS-in-JS       | "Better styling"       | Tailwind is working                     |
| Storybook       | "Component docs"       | Build features first                    |

### When You Can Add New Tech:

- ✅ After MVP ships
- ✅ When current solution is demonstrably failing
- ✅ When you have time to learn properly
- ✅ When the value is clear and immediate

---

## The Complexity Budget

### You Have a Fixed Complexity Budget. Spend Wisely.

**High Complexity (Save For Critical Features):**

- Auth flows (Supabase handles this)
- Real-time updates (not needed for MVP)
- File uploads (MVP+ only)

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
4. Can I defer this to MVP+ or later?

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
- Machine dropdown (required)
- Severity dropdown
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

**Good Enough ✅:**

- Static layout
- "My Issues" list
- "Recent Issues" list
- Simple counts (open issues, unplayable machines)
- Links to filtered views

---

## Spare-Time Development Realities

### Accept These Truths:

1. **Development is intermittent** - You might code for 2 hours tonight, then nothing for a week. That's okay.
2. **Context switching is expensive** - Write notes for future-you ("TODO: next session, add filtering")
3. **Momentum matters** - Finish features quickly while you have context
4. **Perfect is impossible** - Good enough is the only viable standard for passion projects
5. **Energy varies** - Some sessions for hard problems, some for easy wins

### Make It Work For You:

**High-energy sessions:**

- Tackle complex features (auth, filtering, timeline)
- Make architectural decisions
- Write tests for critical paths

**Low-energy sessions:**

- Polish UI
- Fix small bugs
- Update documentation
- Add seed data

**Write notes for yourself:**

```typescript
// TODO: [@your-name next session]
// This works but needs error handling for when machine doesn't exist
// Test case: try creating issue with invalid machine_id
```

---

## The Hard Truths

### Embrace These Realities:

1. **MVP will be imperfect** - That's okay, MVP+ will improve it
2. **Users will request features you skipped** - That validates roadmap priorities
3. **You'll cringe at your own code** - Ship it anyway, refactor later
4. **There will be bugs** - Fix critical ones, defer minor ones
5. **Someone will complain about UX** - Improve based on feedback
6. **You'll want to rebuild it "the right way"** - Resist until MVP ships

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

| Current Approach          | Simplified Approach                        |
| ------------------------- | ------------------------------------------ |
| User role management UI   | Manually update roles in Supabase Studio   |
| Email notification system | Send manual emails if needed (1.0 feature) |
| Analytics dashboard       | Run SQL queries manually                   |
| Complex filtering UI      | Start with 3 basic filters only            |
| Settings page             | Hardcode settings in config file           |

**Remember:** You can always add these later. AFTER MVP ships.

---

## The Victory Conditions

### You Win When:

1. ✅ PRODUCT_SPEC.md MVP features all work
2. ✅ Austin Pinball Collective is actively using it
3. ✅ Critical paths have tests
4. ✅ It's deployed to production
5. ✅ No P0 security issues

**That's it.** Everything else is MVP+/1.0/2.0.

### After MVP Ships:

1. Celebrate! (Take a break)
2. Collect user feedback
3. Review V2_ROADMAP.md
4. Prioritize MVP+ features based on actual usage
5. Build MVP+ with same discipline

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
│ □ Would MVP be useless without it?    │
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
│ Ship MVP before perfecting MVP         │
└────────────────────────────────────────┘
```

---

**Final Word:** Discipline is choosing what NOT to build. Ship MVP, learn from reality, build MVP+ smarter. This is a passion project - make it joyful, not stressful.
