# Standardized Pattern Reference

Use these patterns for all future filter/status work.

---

## Status System

### ✅ Standardized Pattern (Hybrid Approach)

**Group quick-selects at top** (3 toggle buttons):

```
[ ] New          ← Toggles: new + confirmed
[ ] In Progress  ← Toggles: in_progress + need_parts + need_help + wait_owner
[ ] Closed       ← Toggles: fixed + wont_fix + wai + no_repro + duplicate
```

**All 11 statuses below with section labels**:

```
Open (section label)
├─ ☑ new         → cyan-500 dot, checked by default
└─ ☑ confirmed   → teal-500 dot, checked by default

In Progress (section label)
├─ ☑ in_progress → fuchsia-500 dot, checked by default
├─ ☑ need_parts  → purple-600 dot, checked by default
├─ ☑ need_help   → pink-500 dot, checked by default
└─ ☑ wait_owner  → purple-500 dot, checked by default

Closed (section label)
├─ ☐ fixed       → green-500 dot
├─ ☐ wont_fix    → zinc-500 dot
├─ ☐ wai         → zinc-500 dot, muted
├─ ☐ no_repro    → slate-500 dot, muted
└─ ☐ duplicate   → neutral-600 dot, muted
```

**Default state**: All 6 "Open" statuses checked

### Source of Truth

**File**: `src/lib/issues/status.ts`

**Constants**:

- `ISSUE_STATUSES` - All status values (line 21-31)
- `STATUS_CONFIG` - Display config (lines 108-195)
- `STATUS_GROUPS` - Grouping (lines 66-101)
  - `STATUS_GROUPS.new` = ["new", "confirmed"]
  - `STATUS_GROUPS.in_progress` = ["in_progress", "need_parts", "need_help", "wait_owner"]
  - `STATUS_GROUPS.closed` = ["fixed", "wont_fix", "wai", "no_repro", "duplicate"]

**Never hardcode statuses** - always import from status.ts

---

## Quick-Select Pattern

### ✅ Assignee Dropdown Structure (Standardized)

```
┌─────────────────────────┐
│ ☑ 👤 Me                 │ ← Current user, with icon, pre-selected
│ □ ✕ Unassigned         │ ← Special value, with X icon, muted style
├─────────────────────────┤ ← Divider
│ □ Jake Martinez         │ ← All users (full names, alphabetical)
│ □ Sarah Chen            │
│ □ Tim Froehlich         │
└─────────────────────────┘
```

**Rules:**

1. "Me" always first, with user icon, pre-selected by default
2. "Unassigned" second, with X icon, muted style (special value: `"UNASSIGNED"`)
3. Divider after "Unassigned"
4. All users alphabetically by full name (not abbreviated)
5. No divider after "Me" - keeps quick-selects visually grouped

### ✅ Machine/Owner Filter Structure (Standardized)

```
┌─────────────────────────┐
│ ⊡ 👤 My machines        │ ← Quick toggle, with user icon, indeterminate state
├─────────────────────────┤ ← Divider
│ □ AFM                   │ ← All machines (initials only in dropdown)
│ □ CFTBL                 │
│ □ HD                    │
│ □ MM                    │
│ □ TAF                   │
│ □ TZ                    │
└─────────────────────────┘
```

**Rules:**

1. "My machines"/"Your machines" always first with user icon
2. Shows indeterminate checkbox (⊡) when some owned machines selected
3. Divider after quick option
4. Machines show **initials only** in dropdown (not "AFM - Adams Family")
5. Machines sorted alphabetically by initials
6. Quick-select uses same visual style as individual checkboxes

---

## Filter Badge Display

### ✅ Smart Chip Label Logic (Standardized)

**Priority order** (most specific to least specific):

1. **No selection** → "Status" (neutral label)
2. **All selected** → "All" (all 11 statuses)
3. **All open** → "Open" (all new + in progress, no closed)
4. **All closed** → "Closed" (all closed, no open)
5. **All new only** → "New" (2 items: new + confirmed)
6. **All in progress only** → "In Progress" (4 items: in_progress + need_parts + need_help + wait_owner)
7. **Single status** → Show status name (e.g., "Fixed", "Need Help")
8. **Mixed selection** → "N statuses" (e.g., "3 statuses")

### Implementation (Mobile & Desktop)

```javascript
function updateStatusChip() {
  const allItems = [...dropdown.querySelectorAll(".chip-dropdown-item-check")];
  const checked = allItems.filter((b) => b.classList.contains("checked"));
  const checkedLabels = checked.map((b) => b.textContent.trim());

  // Define groups
  const newStatuses = ["New", "Confirmed"];
  const progressStatuses = [
    "In Progress",
    "Need Parts",
    "Need Help",
    "Wait Owner",
  ];
  const closedStatuses = ["Fixed", "Won't Fix", "WAI", "No Repro", "Duplicate"];

  // Check complete group selections
  const allNew = newStatuses.every((s) => checkedLabels.includes(s));
  const allProgress = progressStatuses.every((s) => checkedLabels.includes(s));
  const allClosed = closedStatuses.every((s) => checkedLabels.includes(s));

  let text;
  if (checked.length === 0) {
    text = "Status";
  } else if (checked.length === allItems.length) {
    text = "All";
  } else if (allNew && allProgress && !allClosed) {
    text = "Open"; // Common case - all 6 open statuses
  } else if (allClosed && !allNew && !allProgress) {
    text = "Closed";
  } else if (allNew && checked.length === newStatuses.length) {
    text = "New"; // Just the 2 new statuses
  } else if (allProgress && checked.length === progressStatuses.length) {
    text = "In Progress"; // Just the 4 in-progress statuses
  } else if (checked.length === 1) {
    text = checkedLabels[0]; // Single status
  } else {
    text = checked.length + " statuses"; // Mixed selection
  }

  label.textContent = text;
}
```

### Badge Display Examples

**Desktop filter bar badges**:

```
[Open] [AFM] [CFTBL] [Me]
```

Instead of showing all 6 open statuses individually.

**Mixed selection**:

```
[New] [Fixed] [AFM]
```

When: 2 new statuses + Fixed selected (not a clean group).

**Single group**:

```
[Closed] [All machines]
```

When: All 5 closed statuses selected.

---

## User Display Format

### Context-Based Rules

| Context             | Format                | Example                       |
| ------------------- | --------------------- | ----------------------------- |
| Dropdown list       | Full name             | "Jake Martinez"               |
| Owner with metadata | Name + count + status | "Jake Martinez (3) (Invited)" |
| Avatar badge        | Initials              | "JM"                          |
| Issue card          | Full name             | "Jake Martinez"               |
| Badge (compact)     | First + Last initial  | "J. Martinez" or "JM"         |

### Implementation

```typescript
// Simple dropdown
const userName = user.name;

// Owner select
const ownerLabel = [
  user.name,
  user.machineCount > 0 ? `(${user.machineCount})` : "",
  user.status === "invited" ? "(Invited)" : "",
]
  .filter(Boolean)
  .join(" ");

// Avatar
const initials = user.name
  .split(" ")
  .map((n) => n[0])
  .join("")
  .toUpperCase();

// Badge
const badgeName = compact ? initials : user.name;
```

---

## Machine Display Format

### Badge vs Dropdown

| Context         | Format          | Example                |
| --------------- | --------------- | ---------------------- |
| Filter badge    | Initials only   | "AFM"                  |
| Dropdown option | Name + initials | "Adams Family (AFM)"   |
| Issue card      | Initials        | "AFM"                  |
| Machine list    | Full name       | "Adams Family Pinball" |
| Quick reference | Initials        | "AFM"                  |

### Implementation

```typescript
interface MachineOption {
  initials: string; // "AFM"
  name: string; // "Adams Family Pinball"
  badgeLabel: string; // "AFM" (explicit override)
}

// In filter
const machineOptions = machines.map((m) => ({
  label: `${m.name} (${m.initials})`, // Dropdown shows full
  value: m.initials, // Value is initials
  badgeLabel: m.initials, // Badge shows initials
}));
```

---

## Filter State Structure

### Standard Interface

```typescript
interface FilterState {
  // Search
  q?: string; // Text search query

  // Multi-select filters (arrays)
  status?: IssueStatus[];
  machine?: string[]; // Machine initials
  assignee?: string[]; // User IDs + "UNASSIGNED"
  owner?: string[]; // User IDs
  reporter?: string[]; // User IDs
  severity?: IssueSeverity[];
  priority?: IssuePriority[];
  frequency?: IssueFrequency[];

  // Boolean flags
  watching?: boolean;
  includeInactiveMachines?: boolean;

  // Date ranges
  createdFrom?: Date;
  createdTo?: Date;
  updatedFrom?: Date;
  updatedTo?: Date;

  // Pagination/sorting
  sort?: string; // "column_direction" format
  page?: number;
  pageSize?: number;
}
```

### URL Encoding

```
?status=new,confirmed,in_progress
&machine=AFM,CFTBL
&assignee=user123,UNASSIGNED
&watching=true
&sort=updated_desc
&page=2
```

**Rules:**

- Arrays: Comma-separated values
- Empty: `&status=all` or omit parameter
- Booleans: `true` string or omit
- Defaults omitted for clean URLs

---

## Interactive Patterns

### Chip Dropdown (Mobile)

```html
<button
  class="filter-chip filter-chip-dropdown"
  onclick="toggleDropdown('statusDropdown')"
>
  <span id="chipLabel">Open</span>
  <svg class="chip-chevron" id="chevron">...</svg>
</button>

<div class="chip-dropdown" id="statusDropdown">
  <div class="chip-dropdown-section-label">Open</div>
  <button class="chip-dropdown-item chip-dropdown-item-check checked">
    <span class="item-checkbox"></span>
    New
  </button>
  <!-- ... -->
</div>
```

**Behavior:**

- Click chip → Opens dropdown below
- Chevron rotates 180deg
- Click outside → Closes all dropdowns
- Selection updates chip label

### MultiSelect (Desktop)

```tsx
<MultiSelect
  placeholder="Select status"
  options={statusOptions}
  value={filters.status}
  onChange={(value) => setFilters({ status: value })}
  grouped={true} // Show section labels
  maxDisplay={2} // Show "2 more" after 2 badges
/>
```

**Features:**

- Search within options
- Grouped sections
- Checkbox selection
- Badge count display

---

## Timing Constants

```typescript
// src/lib/constants.ts

export const SEARCH_DEBOUNCE_MS = 300; // Search input debounce
export const TOOLTIP_DELAY_MS = 300; // Hover tooltip delay
export const DROPDOWN_ANIMATION_MS = 150; // Dropdown open/close
export const TOAST_DURATION_MS = 3000; // Success toast duration
```

**Use everywhere** - no magic numbers in components

---

## Color Palette

### Status Colors (from STATUS_CONFIG)

```typescript
// New group - Cool colors (unstarted)
cyan-500    #06b6d4   // new
teal-500    #14b8a6   // confirmed

// In Progress group - Vibrant colors (active)
fuchsia-500 #d946ef   // in_progress
purple-600  #9333ea   // need_parts
pink-500    #ec4899   // need_help
purple-500  #a855f7   // wait_owner

// Closed group - Muted colors (complete)
green-500   #22c55e   // fixed
zinc-500    #71717a   // wont_fix
zinc-500    #71717a   // wai
slate-500   #64748b   // no_repro
neutral-600 #525252   // duplicate
```

### Severity Colors

```typescript
zinc - 500; // cosmetic
blue - 500; // minor
amber - 500; // major
red - 500; // unplayable
```

### Priority Colors

```typescript
zinc - 500; // low
amber - 500; // medium
red - 500; // high
```

---

## Icon System

### Status Icons

```typescript
import { Circle, CircleDot, Disc } from 'lucide-react';

// New group
<Circle className="h-4 w-4" />

// In Progress group
<CircleDot className="h-4 w-4" />

// Closed group
<Disc className="h-4 w-4" />
```

### Severity Icons

```typescript
import { Smile, Info, AlertCircle, AlertOctagon } from 'lucide-react';

cosmetic:   <Smile className="h-4 w-4" />
minor:      <Info className="h-4 w-4" />
major:      <AlertCircle className="h-4 w-4" />
unplayable: <AlertOctagon className="h-4 w-4" />
```

### Priority Icons

```typescript
import { ArrowDown, Minus, ArrowUp } from 'lucide-react';

low:    <ArrowDown className="h-4 w-4" />
medium: <Minus className="h-4 w-4" />
high:   <ArrowUp className="h-4 w-4" />
```

---

## Testing Patterns

### Filter State Tests

```typescript
describe('filter state', () => {
  it('should default to open statuses', () => {
    const filters = parseFilters({});
    expect(filters.status).toEqual(['new', 'confirmed', 'in_progress', ...]);
  });

  it('should parse quick-select "Me"', () => {
    const filters = parseFilters({ assignee: 'ME' });
    expect(filters.assignee).toEqual([currentUserId]);
  });

  it('should handle UNASSIGNED special value', () => {
    const filters = parseFilters({ assignee: 'UNASSIGNED' });
    expect(filters.assignee).toEqual(['UNASSIGNED']);
  });
});
```

### Badge Display Tests

```typescript
describe('badge grouping', () => {
  it('should show "Open" when all open statuses selected', () => {
    const label = getBadgeLabel(['new', 'confirmed', 'in_progress', ...]);
    expect(label).toBe('Open');
  });

  it('should show individual badges for partial selection', () => {
    const badges = getBadges(['new', 'confirmed']);
    expect(badges).toHaveLength(2);
  });
});
```

---

## Accessibility

### Required Patterns

```tsx
// Dropdown trigger
<button
  aria-haspopup="menu"
  aria-expanded={isOpen}
  aria-controls="status-dropdown"
>
  Status
</button>

// Dropdown menu
<div
  id="status-dropdown"
  role="menu"
  aria-labelledby="status-button"
>
  <button role="menuitem">New</button>
</div>

// Checkbox in filter
<input
  type="checkbox"
  id="status-new"
  aria-labelledby="status-new-label"
/>
<label id="status-new-label">New</label>
```

### Keyboard Navigation

- **Tab**: Focus next filter
- **Enter/Space**: Toggle dropdown
- **Arrow keys**: Navigate options
- **Escape**: Close dropdown
- **Type**: Search within options
