# Platform-Specific Improvements

Best practices found on one platform that should be ported to the other.

---

## Mobile → Desktop Improvements

### 1. "Open" / "Closed" Display Labels

**Status**: ✅ Mobile implemented, ⏳ Desktop pending

**Decision**: Use user-friendly group labels ("Open", "In Progress", "Closed") instead of technical names

**Mobile implementation** (COMPLETED):

- ✅ Section labels: "Open" (lines 78), "In Progress" (line 91), "Closed" (line 115)
- ✅ Groups all 11 statuses under these 3 user-friendly categories
- ✅ Smart chip displays: "Open", "Closed", "New", "In Progress", or count

**Desktop TODO**:

```tsx
// StatusSelect.tsx (lines 63-154) - Update SelectGroup labels
<SelectGroup>
  <SelectLabel>Open</SelectLabel> {/* Combine "New" + "In Progress" groups */}
  <SelectItem value="new">...</SelectItem>
  <SelectItem value="confirmed">...</SelectItem>
  <SelectItem value="in_progress">...</SelectItem>
  <SelectItem value="need_parts">...</SelectItem>
  <SelectItem value="need_help">...</SelectItem>
  <SelectItem value="wait_owner">...</SelectItem>
</SelectGroup>

<SelectGroup>
  <SelectLabel>Closed</SelectLabel>
  <SelectItem value="fixed">...</SelectItem>
  <SelectItem value="wont_fix">...</SelectItem>
  <SelectItem value="wai">...</SelectItem>
  <SelectItem value="no_repro">...</SelectItem>
  <SelectItem value="duplicate">...</SelectItem>
</SelectGroup>
```

**Alternative approach** (may be better for desktop):
Keep 3 separate groups but add group quick-select toggles at top like mobile:

```tsx
// Add group toggles before the status list
<div className="mb-2 space-y-1">
  <Button variant="ghost" onClick={() => toggleGroup('new')}>New</Button>
  <Button variant="ghost" onClick={() => toggleGroup('in_progress')}>In Progress</Button>
  <Button variant="ghost" onClick={() => toggleGroup('closed')}>Closed</Button>
</div>
<Separator />
{/* Then normal grouped status list */}
```

**Benefit**: More intuitive, matches mental model of "open vs closed"

---

### 2. Chip-Based Dropdown Pattern

**Current**: Desktop uses heavy MultiSelect component for all filters
**Alternative**: Mobile uses lightweight chip dropdowns for simple filters

**When to use:**

- **MultiSelect**: Complex filters (machine, status with many options)
- **Chip dropdown**: Binary/ternary choices (priority, frequency)

**Example - Priority filter:**

```tsx
// Instead of MultiSelect with 3 options
<button className="filter-chip" onClick={() => toggleDropdown('priority')}>
  Priority
  <ChevronDown className="chip-chevron" />
</button>

<div className="chip-dropdown">
  <button onClick={() => selectPriority('low')}>
    <ArrowDown /> Low
  </button>
  <button onClick={() => selectPriority('medium')}>
    <Minus /> Medium
  </button>
  <button onClick={() => selectPriority('high')}>
    <ArrowUp /> High
  </button>
</div>
```

**Benefit**: Lighter UI, faster interaction for simple choices

**Recommendation**: Consider for Phase 3 (polish), not critical

---

### 3. Bottom Sheet for Sort (Mobile-Specific)

**Current**: Desktop uses dropdown menu
**Mobile pattern**: Bottom sheet (native mobile pattern)

**Keep platform-specific**: This is correct. Bottom sheets are mobile convention, dropdowns are desktop convention.

---

## Desktop → Mobile Improvements

### 1. Smart Badge Grouping

**Current**: Mobile shows individual status badges
**Better**: Desktop collapses groups when all selected

**Desktop logic** (IssueFilters.tsx, lines 176-401):

```typescript
// If all "new" statuses selected (new + confirmed)
// Show: [New] badge
// Instead of: [New] [Confirmed]

// If all "in_progress" statuses selected
// Show: [In Progress] badge
// Instead of: [In Progress] [Need Parts] [Need Help] [Wait Owner]
```

**Implementation for mobile:**

Update `updateStatusChip()` in mockup-issues-list.html:

```javascript
function updateStatusChip() {
  const checked = getCheckedStatuses();

  // Check if all items in a group are selected
  const newGroup = ["New", "Confirmed"];
  const progressGroup = [
    "In Progress",
    "Need Parts",
    "Need Help",
    "Wait Owner",
  ];
  const closedGroup = ["Fixed", "Won't Fix", "WAI", "No Repro", "Duplicate"];

  const allNew = newGroup.every((s) => checked.includes(s));
  const allProgress = progressGroup.every((s) => checked.includes(s));
  const allClosed = closedGroup.every((s) => checked.includes(s));

  // Smart label logic
  if (allNew && allProgress && !allClosed) return "Open";
  if (allClosed && !allNew && !allProgress) return "Closed";
  if (checked.length === newGroup.length && allNew) return "New";
  // ... etc
}
```

**Benefit**: Reduces badge clutter, cleaner UI

---

### 2. Complete Status Icons

**Current**: Mobile uses colored dots for everything
**Better**: Desktop uses semantic icons by group

**Icon system:**

- Circle (hollow) - New group (unstarted)
- CircleDot (ring with center) - In Progress group (active)
- Disc (solid) - Closed group (complete)

**Implementation:**

Add to mobile mockup status dropdown:

```html
<!-- New group - Circle icon -->
<button class="chip-dropdown-item">
  <svg class="status-icon status-icon-new">
    <circle
      cx="8"
      cy="8"
      r="6"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    />
  </svg>
  New
</button>

<!-- In Progress group - CircleDot icon -->
<button class="chip-dropdown-item">
  <svg class="status-icon status-icon-progress">
    <circle
      cx="8"
      cy="8"
      r="6"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    />
    <circle cx="8" cy="8" r="3" fill="currentColor" />
  </svg>
  In Progress
</button>

<!-- Closed group - Disc icon -->
<button class="chip-dropdown-item">
  <svg class="status-icon status-icon-closed">
    <circle cx="8" cy="8" r="6" fill="currentColor" />
  </svg>
  Fixed
</button>
```

**Benefit**: Visual hierarchy, semantic meaning

---

### 3. "Unassigned" Special Value

**Current**: Mobile treats "Unassigned" as regular option
**Better**: Desktop uses special constant `"UNASSIGNED"`

**Why it matters:**

- Special handling in filters: `assignee: ["UNASSIGNED"]`
- Distinguishes from null/missing assignee
- Allows filtering specifically for unassigned issues

**Implementation:**

Update mobile assignee dropdown:

```html
<button
  class="chip-dropdown-item chip-dropdown-item-special"
  data-value="UNASSIGNED"
>
  <span class="item-checkbox"></span>
  <svg><!-- X icon --></svg>
  Unassigned
</button>
```

Update JavaScript:

```javascript
function getAssigneeFilters() {
  const selected = getCheckedAssignees();
  return selected.map((item) => {
    if (item.dataset.value === "UNASSIGNED") return "UNASSIGNED";
    return item.dataset.userId;
  });
}
```

---

### 4. Severity & Priority Visual Systems

**Current**: Mobile mockups don't show priority/severity filters
**Better**: Desktop has complete icon + color systems

**Priority system** (priority.ts):

```typescript
PRIORITY_CONFIG = {
  low: { icon: ArrowDown, color: "zinc-500" },
  medium: { icon: Minus, color: "amber-500" },
  high: { icon: ArrowUp, color: "red-500" },
};
```

**Severity system** (severity.ts):

```typescript
SEVERITY_CONFIG = {
  cosmetic: { icon: Smile, color: "zinc-500" },
  minor: { icon: Info, color: "blue-500" },
  major: { icon: AlertCircle, color: "amber-500" },
  unplayable: { icon: AlertOctagon, color: "red-500" },
};
```

**Add to mobile:**

- Priority dropdown in filters modal
- Severity dropdown in filters modal
- Display on issue cards with proper icons/colors

---

## User Display Format Standardization

**Status**: ✅ Mobile updated, ✅ Desktop already correct

### Decision Made

✅ **Context-appropriate display format everywhere**

### Mobile Implementation (COMPLETED)

**Assignee dropdown** (lines 104-115):

- ✅ Changed from "Jake M.", "Sarah C." to full names
- ✅ Now shows: "Jake Martinez", "Sarah Chen", "Tim Froehlich"
- ✅ Matches desktop format

### Standard Format (Both Platforms)

```typescript
// In simple dropdowns (assignee picker):
function formatUserName(user: User): string {
  return user.name; // "Jake Martinez"
}

// In owner selects with metadata:
function formatOwnerLabel(user: FilterUser): string {
  const parts = [user.name];
  if (user.machineCount > 0) parts.push(`(${user.machineCount})`);
  if (user.status === "invited") parts.push("(Invited)");
  return parts.join(" "); // "Jake Martinez (3) (Invited)"
}

// In badges/compact views:
function formatUserBadge(user: User, compact: boolean): string {
  if (compact)
    return user.name
      .split(" ")
      .map((n) => n[0])
      .join(""); // "JM"
  return user.name; // "Jake Martinez"
}
```

### Files Updated

✅ Mobile:

- `docs/inspiration/mobile-redesign/mockup-issues-list.html` (lines 104-115)

✅ Desktop:

- Already using correct format in all components
- AssigneePicker.tsx shows full names
- OwnerSelect.tsx shows metadata format

---

## Summary Table

| Improvement           | Source  | Target  | Priority | Effort        |
| --------------------- | ------- | ------- | -------- | ------------- |
| Quick-select patterns | Mobile  | Desktop | High     | Medium (3-4h) |
| Open/Closed labels    | Mobile  | Desktop | Medium   | Low (1h)      |
| Smart badge grouping  | Desktop | Mobile  | High     | Medium (2h)   |
| All 11 statuses       | Desktop | Mobile  | Critical | Medium (2-3h) |
| STATUS_CONFIG colors  | Desktop | Mobile  | Critical | Low (1h)      |
| Semantic icons        | Desktop | Mobile  | Medium   | Medium (2h)   |
| UNASSIGNED constant   | Desktop | Mobile  | Medium   | Low (1h)      |
| User format standard  | Both    | Both    | Low      | Low (1h)      |
