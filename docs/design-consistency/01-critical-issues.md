# Critical Design Inconsistencies

Issues that will cause implementation problems or user confusion.

## Status Overview

| Issue            | Severity | Mobile Mockup              | Desktop Production      | Status       |
| ---------------- | -------- | -------------------------- | ----------------------- | ------------ |
| 1. Status System | Critical | ✅ Fixed (11 statuses)     | ⏳ Needs update         | Mobile ready |
| 2. Status Colors | High     | ✅ Fixed (STATUS_CONFIG)   | ✅ Already correct      | Resolved     |
| 3. Quick-Select  | High     | ✅ Fixed (Me, My machines) | ⏳ Needs implementation | Mobile ready |

**Summary**: All critical mobile mockup issues resolved. Desktop implementation needed for consistency.

---

## 1. Status System Mismatch

**Severity**: 🔴 Critical → ✅ **RESOLVED**
**Impact**: Mobile mockups can't support production workflow

### Decision Made

✅ **Hybrid approach implemented** - Keep all 11 statuses with group quick-selects at top

### Implementation (COMPLETED in mockup-issues-list.html)

**Group quick-selects at top** (3 buttons):

```
[ ] New          ← Toggles: New + Confirmed
[ ] In Progress  ← Toggles: In Progress + Need Parts + Need Help + Wait Owner
[ ] Closed       ← Toggles: Fixed + Won't Fix + WAI + No Repro + Duplicate
```

**All 11 statuses below with proper grouping:**

```
Open (section label)
├─ ☑ New (cyan dot, checked by default)
└─ ☑ Confirmed (teal dot, checked by default)

In Progress (section label)
├─ ☑ In Progress (fuchsia dot, checked by default)
├─ ☑ Need Parts (purple dot, checked by default)
├─ ☑ Need Help (pink dot, checked by default)
└─ ☑ Wait Owner (purple dot, checked by default)

Closed (section label)
├─ ☐ Fixed (green dot)
├─ ☐ Won't Fix (zinc dot)
├─ ☐ WAI (zinc dot, muted)
├─ ☐ No Repro (slate dot, muted)
└─ ☐ Duplicate (neutral dot, muted)
```

**Default state**: All 6 "Open" statuses checked → chip displays "Open"

**Smart chip label logic**:

- All open selected → "Open"
- All closed selected → "Closed"
- All new selected (2 items) → "New"
- All in-progress selected (4 items) → "In Progress"
- Single status → Shows status name
- Mixed selection → "N statuses"

### Files Updated

✅ `docs/inspiration/mobile-redesign/mockup-issues-list.html` (lines 60-141)

- Added 3 group quick-select buttons at top
- Expanded from 4 to 11 statuses
- Added `data-group` attributes for group toggling
- Added `toggleStatusGroup()` function
- Updated `updateStatusChip()` for smart labeling
- All 6 open statuses pre-selected

---

## 2. Status Color Inconsistency

**Severity**: 🟡 High → ✅ **RESOLVED**
**Impact**: Visual confusion, brand inconsistency

### Decision Made

✅ **Adopt desktop STATUS_CONFIG colors as single source of truth**

### Implementation (COMPLETED in mockup-issues-list.html)

All 11 status dot colors now match `src/lib/issues/status.ts` STATUS_CONFIG:

**New group** (cool colors - unstarted):

```css
.status-dot-new {
  background: #06b6d4;
} /* cyan-500 */
.status-dot-confirmed {
  background: #14b8a6;
} /* teal-500 */
```

**In Progress group** (vibrant colors - active):

```css
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
```

**Closed group** (muted colors - complete):

```css
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

### Files Updated

✅ `docs/inspiration/mobile-redesign/mockup-issues-list.html` (lines 905-920)

- Replaced 4 old colors with 11 new colors
- All colors match desktop STATUS_CONFIG
- Added semantic grouping comments

---

## 3. Quick-Select Pattern Gap

**Severity**: 🟡 High
**Status**: ✅ Mobile updated, ⏳ Desktop pending

### Decision Made

✅ **Standardize quick-select pattern across both platforms**

**Assignee ordering**: Me → Unassigned → All users (full names)
**Machine filter**: "My machines" quick-toggle at top

### Implementation (COMPLETED in mobile mockup)

**Assignee dropdown** (mockup-issues-list.html, lines 92-116):

```html
<!-- Quick-select first -->
<button class="chip-dropdown-item chip-dropdown-item-check checked">
  <span class="item-checkbox"></span>
  <svg><!-- user icon --></svg>
  Me
</button>

<!-- Special value second -->
<button
  class="chip-dropdown-item chip-dropdown-item-check chip-dropdown-item-muted"
>
  <span class="item-checkbox"></span>
  <svg><!-- X icon --></svg>
  Unassigned
</button>

<!-- Divider -->
<div class="chip-dropdown-divider"></div>

<!-- All users (full names, alphabetical) -->
<button>Jake Martinez</button>
<button>Sarah Chen</button>
<button>Tim Froehlich</button>
```

**Machine dropdown** (already had "My machines", unchanged):

```html
<button class="chip-dropdown-item chip-dropdown-item-quick">
  <span class="item-checkbox item-checkbox-indeterminate"></span>
  <svg><!-- user icon --></svg>
  My machines
</button>
<div class="chip-dropdown-divider"></div>
<!-- All machines -->
```

### Files Updated

✅ Mobile:

- `docs/inspiration/mobile-redesign/mockup-issues-list.html` (lines 92-116)
- Updated assignee ordering: Me → Unassigned → Users
- Changed names from abbreviated (Jake M.) to full (Jake Martinez)
- Added user icon to "Me"
- Added X icon to "Unassigned"

### Desktop TODO (Phase 2)

⏳ **Pending implementation**:

**1. AssigneePicker.tsx** (lines 149-207)

- Add "Me" option first (with user icon)
- Keep "Unassigned" second (with X icon)
- Add divider after "Unassigned"

**2. IssueFilters.tsx** (lines 106-132)

- Add "My machines" quick-toggle to machine filter
- Use same pattern as mobile mockup

**3. MachineFilters.tsx** (lines 42-90)

- Add "Your machines" quick-toggle to owner filter

**Reasoning**: Mobile mockup establishes the pattern. Desktop implementation is Phase 2 work (lower priority than status system fixes).
