# Implementation Plan

Prioritized roadmap for applying consistency fixes.

---

## Phase 1: Critical Fixes (Week 1)

**Goal**: Fix issues that block mobile implementation

### 1.1 Update Mobile Status System (2-3 hours)

**File**: `docs/inspiration/mobile-redesign/mockup-issues-list.html`

**Tasks**:

- [ ] Add all 11 statuses to status dropdown (lines 61-85)
- [ ] Add 3 section labels: "Open", "In Progress", "Closed"
- [ ] Update status color CSS for all 11 (lines 905-908)
- [ ] Update JavaScript status arrays (lines 479-480)
- [ ] Test smart label logic with full status set

**Example**:

```html
<div class="chip-dropdown-section-label">Open</div>
<button class="chip-dropdown-item chip-dropdown-item-check checked">
  <span class="item-checkbox"></span>
  <span class="status-dot status-dot-new"></span>
  New
</button>
<button class="chip-dropdown-item chip-dropdown-item-check checked">
  <span class="item-checkbox"></span>
  <span class="status-dot status-dot-confirmed"></span>
  Confirmed
</button>

<div class="chip-dropdown-section-label">In Progress</div>
<!-- Add: In Progress, Need Parts, Need Help, Wait Owner -->

<div class="chip-dropdown-section-label">Closed</div>
<!-- Add: Fixed, Won't Fix, WAI, No Repro, Duplicate -->
```

### 1.2 Standardize Status Colors (1 hour)

**Files**:

- `docs/inspiration/mobile-redesign/mockup-issues-list.html`
- `docs/inspiration/mobile-redesign/mockup-issue-detail.html`
- `docs/inspiration/mobile-redesign/mockup-report-form.html`

**Tasks**:

- [ ] Replace all status color CSS with STATUS_CONFIG colors
- [ ] Map mobile simplified names to desktop values
- [ ] Update status badge classes

**CSS Updates**:

```css
/* Replace current colors with Tailwind equivalents */
.status-dot-new {
  background: #06b6d4;
} /* cyan-500 */
.status-dot-confirmed {
  background: #14b8a6;
} /* teal-500 */
.status-dot-in-progress {
  background: #d946ef;
} /* fuchsia-500 */
.status-dot-need-parts {
  background: #9333ea;
} /* purple-600 */
.status-dot-need-help {
  background: #ec4899;
} /* pink-500 */
.status-dot-wait-owner {
  background: #a855f7;
} /* purple-500 */
.status-dot-fixed {
  background: #22c55e;
} /* green-500 */
.status-dot-wontfix {
  background: #71717a;
} /* zinc-500 */
.status-dot-wai {
  background: #71717a;
} /* zinc-500 */
.status-dot-no-repro {
  background: #64748b;
} /* slate-500 */
.status-dot-duplicate {
  background: #525252;
} /* neutral-600 */
```

### 1.3 Standardize User Display (1 hour)

**Files**: All mobile mockups with user lists

**Tasks**:

- [ ] Replace "Jake M." with "Jake Martinez" in assignee dropdowns
- [ ] Add metadata format "(count) (Invited)" to owner displays
- [ ] Keep initials only in compact avatar badges

**Changes**:

```html
<!-- Before -->
<button>Jake M.</button>

<!-- After -->
<button>Jake Martinez</button>

<!-- Owner with metadata -->
<button>Jake Martinez (3) (Invited)</button>
```

---

## Phase 2: UX Improvements (Week 2)

**Goal**: Add quick-select patterns to desktop

### 2.1 Add "Me" to Assignee Pickers (2 hours)

**Files**:

- `src/components/issues/AssigneePicker.tsx`
- `src/components/issues/IssueFilters.tsx`

**Tasks**:

- [ ] Get current user from auth context
- [ ] Add "Me" option first in dropdown
- [ ] Add divider after "Me"
- [ ] Pre-select "Me" by default in new issues
- [ ] Update tests

**Implementation**:

```tsx
// AssigneePicker.tsx
const { user: currentUser } = useAuth();

// In dropdown
<DropdownMenuItem
  onClick={() => onAssign(currentUser.id)}
  className="font-medium text-primary"
>
  <User className="mr-2 h-4 w-4" />
  Me
  {assignedToId === currentUser.id && <Check className="ml-auto h-4 w-4" />}
</DropdownMenuItem>
<DropdownMenuSeparator />

<DropdownMenuItem onClick={() => onAssign(null)}>
  <X className="mr-2 h-4 w-4" />
  Unassigned
  {!assignedToId && <Check className="ml-auto h-4 w-4" />}
</DropdownMenuItem>
<DropdownMenuSeparator />

{filteredUsers.map(user => (
  <DropdownMenuItem key={user.id} onClick={() => onAssign(user.id)}>
    <Avatar>{user.name[0]}</Avatar>
    {user.name}
    {assignedToId === user.id && <Check className="ml-auto h-4 w-4" />}
  </DropdownMenuItem>
))}
```

**Tests**:

```typescript
it('should show "Me" as first option', () => {
  render(<AssigneePicker currentUserId="user123" ... />);
  const firstOption = screen.getAllByRole('menuitem')[0];
  expect(firstOption).toHaveTextContent('Me');
});

it('should default to "Me" for new issues', () => {
  const onAssign = vi.fn();
  render(<AssigneePicker assignedToId={null} onAssign={onAssign} ... />);
  // Should suggest current user
});
```

### 2.2 Add "My Machines" Quick Filter (2 hours)

**Files**:

- `src/components/issues/IssueFilters.tsx`
- `src/components/machines/MachineFilters.tsx`

**Tasks**:

- [ ] Add quick toggle button to machine filters
- [ ] Implement toggle logic (select/deselect user's machines)
- [ ] Show indeterminate state when partial
- [ ] Update badge display
- [ ] Update tests

**Implementation**:

```tsx
// IssueFilters.tsx
const userMachines = useMemo(
  () =>
    machines.filter((m) => m.ownerId === currentUser.id).map((m) => m.initials),
  [machines, currentUser]
);

const toggleMyMachines = () => {
  const allSelected = userMachines.every((m) => filters.machine?.includes(m));

  if (allSelected) {
    // Deselect all user machines
    pushFilters({
      machine: filters.machine?.filter((m) => !userMachines.includes(m)),
    });
  } else {
    // Select all user machines
    pushFilters({
      machine: [
        ...(filters.machine ?? []),
        ...userMachines.filter((m) => !filters.machine?.includes(m)),
      ],
    });
  }
};

// In machine MultiSelect
const machineOptions = [
  {
    type: "action",
    label: "My machines",
    icon: User,
    action: toggleMyMachines,
    className: "font-medium text-primary",
  },
  { type: "separator" },
  ...machines.map((m) => ({
    label: m.name,
    value: m.initials,
    badgeLabel: m.initials,
  })),
];
```

### 2.3 Update Status Group Labels (30 min)

**File**: `src/components/issues/fields/StatusSelect.tsx`

**Tasks**:

- [ ] Change "New" group label to "Open"
- [ ] Keep "In Progress" as-is
- [ ] Keep "Closed" as-is
- [ ] Update any references in tests/docs

**Changes**:

```tsx
// Line 63-66
<SelectGroup>
  <SelectLabel>Open</SelectLabel> {/* was "New" */}
  <SelectItem value="new">...</SelectItem>
  <SelectItem value="confirmed">...</SelectItem>
</SelectGroup>
```

---

## Phase 3: Polish & Extras (Week 3-4)

**Goal**: Nice-to-have improvements

### 3.1 Port Smart Badge Grouping to Mobile (2 hours)

**File**: `docs/inspiration/mobile-redesign/mockup-issues-list.html`

**Tasks**:

- [ ] Extract badge grouping logic from IssueFilters.tsx
- [ ] Port to JavaScript in mobile mockup
- [ ] Update badge display to use groups
- [ ] Test all status combinations

**Implementation**: See `02-improvements.md` section on smart badge grouping

### 3.2 Add Severity/Priority to Mobile (2-3 hours)

**Files**: All mobile mockups

**Tasks**:

- [ ] Add priority filter to filters modal
- [ ] Add severity filter to filters modal
- [ ] Add icons to issue cards
- [ ] Style with proper colors
- [ ] Update JavaScript for new filters

### 3.3 Semantic Status Icons (2 hours)

**File**: `docs/inspiration/mobile-redesign/mockup-issues-list.html`

**Tasks**:

- [ ] Add Circle/CircleDot/Disc SVG icons
- [ ] Replace colored dots with semantic icons
- [ ] Color icons according to status
- [ ] Update CSS for icon sizing

### 3.4 Consider Chip Dropdown Component (4-6 hours)

**Files**:

- `src/components/ui/chip-dropdown.tsx` (new)
- `src/components/issues/IssueFilters.tsx`

**Tasks**:

- [ ] Build reusable ChipDropdown component
- [ ] Migrate priority filter to chip dropdown
- [ ] Migrate frequency filter to chip dropdown
- [ ] User test for preference
- [ ] Keep MultiSelect for complex filters

**Reasoning**: May not be worth effort. Desktop users expect standard dropdowns.

---

## Phase 4: Documentation (Ongoing)

### 4.1 Update Agent Skills (1 hour)

**File**: `.agent/skills/pinpoint-ui/SKILL.md`

**Tasks**:

- [ ] Add quick-select pattern section
- [ ] Document status system reference
- [ ] Add filter badge grouping rules
- [ ] Include user/machine display formats

### 4.2 Update AGENTS.md (30 min)

**File**: `AGENTS.md`

**Tasks**:

- [ ] Add filter patterns section
- [ ] Document quick-select as standard
- [ ] Reference STATUS_CONFIG as source of truth

### 4.3 Create Visual Consistency Guide (2 hours)

**File**: `docs/design-system/consistency-guide.md`

**Tasks**:

- [ ] Screenshot examples of patterns
- [ ] Side-by-side mobile vs desktop
- [ ] Color palette reference
- [ ] Do's and don'ts

---

## Testing Strategy

### Manual Testing Checklist

**Status System**:

- [ ] All 11 statuses appear in desktop StatusSelect
- [ ] All 11 statuses appear in mobile status dropdown
- [ ] Colors match STATUS_CONFIG on both platforms
- [ ] Icons are correct (Circle/CircleDot/Disc)
- [ ] Group labels show "Open"/"In Progress"/"Closed"

**Quick-Select**:

- [ ] "Me" appears first in assignee picker
- [ ] "Me" is pre-selected for new issues
- [ ] "My machines" toggles user's owned machines
- [ ] Indeterminate state shows when partial selection
- [ ] Dividers appear after quick options

**Badge Display**:

- [ ] Individual badges show for partial selections
- [ ] "Open" badge shows when all open statuses selected
- [ ] "Closed" badge shows when all closed statuses selected
- [ ] Badge limit prevents overflow (show "2 more...")

**User Display**:

- [ ] Full names in all dropdowns (no abbreviations)
- [ ] Metadata format correct: "Name (count) (Invited)"
- [ ] Initials only in avatar badges
- [ ] Consistent across mobile and desktop

### Automated Tests

```bash
# Unit tests
pnpm test src/components/issues/AssigneePicker.test.tsx
pnpm test src/components/issues/IssueFilters.test.tsx
pnpm test src/lib/issues/status.test.ts

# E2E tests
pnpm e2e tests/filters.spec.ts
pnpm e2e tests/issue-status.spec.ts
```

**New test cases**:

```typescript
// AssigneePicker.test.tsx
describe("quick-select", () => {
  it('shows "Me" as first option');
  it("pre-selects current user for new issues");
  it('filters correctly when "Me" selected');
});

// IssueFilters.test.tsx
describe("machine quick-select", () => {
  it('shows "My machines" option');
  it("toggles all user machines");
  it("shows indeterminate when partial");
});
```

---

## Rollout Plan

### Desktop Changes

1. **Soft launch** (Phase 2 complete):
   - Feature flag: `FEATURE_QUICK_SELECT_FILTERS`
   - Enable for beta testers
   - Gather feedback

2. **Production** (1 week after soft launch):
   - Remove feature flag
   - Monitor analytics for usage
   - Adjust defaults if needed

### Mobile Implementation

1. **Mockup validation** (Phase 1 complete):
   - Show updated mockups to team
   - Get approval on 11-status system
   - Confirm color scheme

2. **Implementation** (After mockup approval):
   - Build mobile components from mockups
   - Use same patterns as desktop (shared logic)
   - Test on real devices

---

## Success Metrics

### Quantitative

- [ ] 100% of statuses appear on both platforms
- [ ] 0 color mismatches between platforms
- [ ] <5% user confusion about filters (support tickets)
- [ ] > 50% of assignee selections use "Me" option
- [ ] > 30% of machine filters use "My machines"

### Qualitative

- [ ] Team finds filters easier to use
- [ ] Designers approve visual consistency
- [ ] New developers understand patterns from docs
- [ ] Mobile mockups approved for implementation

---

## Risks & Mitigation

| Risk                                 | Impact | Probability | Mitigation                              |
| ------------------------------------ | ------ | ----------- | --------------------------------------- |
| User confusion with 11 statuses      | Medium | Low         | Clear grouping, tooltips, documentation |
| Desktop users don't use quick-select | Low    | Medium      | A/B test, keep both options available   |
| Mobile mockups rejected              | High   | Low         | Get early stakeholder review            |
| Performance with many machines       | Medium | Low         | Virtualize long lists                   |
| Breaking changes to filters          | High   | Low         | Comprehensive testing, feature flags    |

---

## Effort Estimate

| Phase                 | Hours     | Priority |
| --------------------- | --------- | -------- |
| Phase 1: Critical     | 4-5       | P0       |
| Phase 2: Quick-select | 4.5       | P1       |
| Phase 3: Polish       | 8-11      | P2       |
| Phase 4: Docs         | 3.5       | P2       |
| **Total**             | **20-24** | -        |

**Timeline**: 3-4 weeks with 1 developer

---

## Next Steps

1. ✅ **Review this documentation** - You are here
2. ⬜ **Prioritize phases** - Which to do first?
3. ⬜ **Update PinPoint-aea** - Add chosen tasks to epic
4. ⬜ **Create sub-tasks** - Break down phases into beads issues
5. ⬜ **Begin Phase 1** - Fix critical inconsistencies
