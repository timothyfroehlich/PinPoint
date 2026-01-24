# MultiSelect UI Pattern

## Overview

The MultiSelect component provides a dropdown interface for selecting multiple options with checkbox-based selection. It supports both flat option lists and grouped options with indeterminate checkbox states.

**Location**: `src/components/ui/multi-select.tsx`

## When to Use

Use MultiSelect when:

- Users need to select multiple items from a list (2-50 options ideal)
- Options can be grouped by category (e.g., status groups, severity levels)
- You need to show selection count without cluttering the UI
- Search/filter functionality is needed for large option lists

**Don't use** for:

- Single selection (use Select instead)
- Very large lists (>100 items) without grouping
- Binary on/off toggles (use Switch or Checkbox)

## Key Features

### 1. Indeterminate State for Groups

The most important pattern in this component is **indeterminate checkbox state** for groups:

```typescript
const isAllSelected = groupSelectedCount === group.options.length;
const isPartiallySelected =
  groupSelectedCount > 0 && groupSelectedCount < group.options.length;

<Checkbox
  checked={
    isAllSelected
      ? true
      : isPartiallySelected
        ? "indeterminate"
        : false
  }
/>
```

**States**:

- ✅ **Checked** (`true`): All items in group are selected
- ➖ **Indeterminate** (`"indeterminate"`): Some (but not all) items selected
- ☐ **Unchecked** (`false`): No items selected

### 2. Group Toggle Behavior

Clicking a group header toggles ALL items in that group:

```typescript
const toggleGroup = (): void => {
  if (isAllSelected) {
    // Deselect all in group
    onChange(value.filter((v) => !groupOptionValues.includes(v)));
  } else {
    // Select all in group (regardless of partial state)
    const otherValues = value.filter((v) => !groupOptionValues.includes(v));
    onChange([...otherValues, ...groupOptionValues]);
  }
};
```

**Important**: The toggle logic is binary - if not all selected, it selects all. This is more predictable than three-state cycling.

## Implementation Example

### Basic Usage (Flat List)

```tsx
import { MultiSelect } from "~/components/ui/multi-select";

const [selected, setSelected] = useState<string[]>([]);

<MultiSelect
  options={[
    { label: "Option 1", value: "opt1" },
    { label: "Option 2", value: "opt2" },
    { label: "Option 3", value: "opt3" },
  ]}
  value={selected}
  onChange={setSelected}
  placeholder="Select options..."
  searchPlaceholder="Search..."
/>;
```

### Grouped Options (With Indeterminate State)

```tsx
const statusGroups: GroupedOption[] = [
  {
    label: "Open",
    options: [
      { label: "New", value: "new" },
      { label: "Confirmed", value: "confirmed" },
    ],
  },
  {
    label: "Closed",
    options: [
      { label: "Fixed", value: "fixed" },
      { label: "Won't Fix", value: "wont_fix" },
    ],
  },
];

<MultiSelect
  groups={statusGroups}
  value={selectedStatuses}
  onChange={setSelectedStatuses}
  placeholder="Filter by status..."
/>;
```

### With Icons

```tsx
import { AlertCircle, CheckCircle } from "lucide-react";

const options = [
  { label: "Critical", value: "critical", icon: AlertCircle },
  { label: "Resolved", value: "resolved", icon: CheckCircle },
];

<MultiSelect options={options} value={selected} onChange={setSelected} />;
```

## Real-World Usage: Issue Filters

**File**: `src/components/issues/IssueFilters.tsx`

The IssueFilters component uses MultiSelect for status filtering with STATUS_GROUPS:

```typescript
// Status groups configuration
const statusGroups = [
  {
    label: "New",
    options: STATUS_GROUPS.new.map((s) => ({
      label: STATUS_CONFIG[s].label,
      value: s,
      icon: STATUS_CONFIG[s].icon,
      iconColor: STATUS_CONFIG[s].iconColor,
    })),
  },
  // ... more groups
];

<MultiSelect
  groups={statusGroups}
  value={filters.status ?? []}
  onChange={(statuses) => pushFilters({ status: statuses, page: 1 })}
  placeholder="Filter by status..."
  searchPlaceholder="Search statuses..."
/>
```

**User Experience**: Users can click "Closed" group header to select/deselect all closed statuses at once, or individually toggle specific statuses.

## Accessibility

### Keyboard Navigation

- **Tab**: Focus trigger button
- **Enter/Space**: Open/close popover
- **Arrow keys**: Navigate options (via Command component)
- **Enter/Space**: Toggle option selection
- **Escape**: Close popover

### Screen Reader Support

```tsx
<Button
  role="combobox"
  aria-expanded={open}
  // Announces: "Select options, combobox, collapsed/expanded"
>
```

### Visual Indicators

- Badge shows selection count for quick scanning
- Indeterminate checkbox state provides visual feedback for partial selection
- Hover states on both items and group headers

## State Management Patterns

### Controlled Component

The component is **fully controlled** - parent manages state:

```tsx
// Parent component owns the state
const [selected, setSelected] = useState<string[]>([]);

// Parent decides how to handle changes
const handleChange = (newValue: string[]) => {
  setSelected(newValue);
  // Can add validation, logging, API calls, etc.
};

<MultiSelect value={selected} onChange={handleChange} />;
```

### Integration with URL State

```tsx
// IssueFilters.tsx pattern
const { pushFilters } = useSearchFilters(filters);

<MultiSelect
  value={filters.severity ?? []}
  onChange={
    (severity) => pushFilters({ severity, page: 1 }) // Reset page on filter change
  }
/>;
```

## Common Pitfalls

### ❌ Pitfall 1: Forgetting to Reset Pagination

```tsx
// BAD: Filters change but user stays on page 10 with no results
<MultiSelect
  value={filters.status}
  onChange={(status) => pushFilters({ status })}
/>

// GOOD: Reset to page 1 when filtering
<MultiSelect
  value={filters.status}
  onChange={(status) => pushFilters({ status, page: 1 })}
/>
```

### ❌ Pitfall 2: Mutating Value Array

```tsx
// BAD: Mutating the array
const handleChange = (newValue: string[]) => {
  selected.push(newValue[0]); // Mutates state!
  setSelected(selected); // React won't detect the change
};

// GOOD: Creating new array
const handleChange = (newValue: string[]) => {
  setSelected(newValue); // Component already returns new array
};
```

### ❌ Pitfall 3: Inconsistent Group Data

```tsx
// BAD: Group options don't match flat option values
const groups = [{ label: "Group 1", options: [{ label: "A", value: "a" }] }];
const value = ["b"]; // "b" doesn't exist in any group!

// GOOD: Ensure all values have corresponding options
const value = ["a"]; // "a" exists in Group 1
```

### ❌ Pitfall 4: Large Lists Without Grouping

```tsx
// BAD: 200 ungrouped options - hard to scan and slow to render
<MultiSelect
  options={allMachines} // 200 machines
  value={selected}
  onChange={setSelected}
/>

// GOOD: Group by category
<MultiSelect
  groups={[
    { label: "Williams", options: williamsMachines },
    { label: "Stern", options: sternMachines },
    { label: "Bally", options: ballyMachines },
  ]}
  value={selected}
  onChange={setSelected}
/>
```

## Performance Considerations

### Rendering Optimization

The component uses `Command` which implements virtual scrolling internally for large lists. However:

- **Flat lists**: Prefer <100 options
- **Grouped lists**: Can handle more (200+) if properly grouped
- **Search** helps users find options quickly in large lists

### State Updates

Toggle operations create **new arrays** (not mutations):

```typescript
// Efficient: Filters and spreads
const toggleOption = (optionValue: string): void => {
  const newValue = value.includes(optionValue)
    ? value.filter((v) => v !== optionValue) // Remove
    : [...value, optionValue]; // Add
  onChange(newValue);
};
```

## Testing Patterns

### Component Testing

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MultiSelect } from "~/components/ui/multi-select";

test("toggles option selection", async () => {
  const onChange = vi.fn();
  render(
    <MultiSelect
      options={[{ label: "Option 1", value: "opt1" }]}
      value={[]}
      onChange={onChange}
      data-testid="multi-select"
    />
  );

  // Open popover
  await userEvent.click(screen.getByTestId("multi-select"));

  // Select option
  await userEvent.click(screen.getByTestId("multi-select-option-opt1"));

  expect(onChange).toHaveBeenCalledWith(["opt1"]);
});

test("group toggle selects all", async () => {
  const onChange = vi.fn();
  const groups = [
    {
      label: "Group",
      options: [
        { label: "A", value: "a" },
        { label: "B", value: "b" },
      ],
    },
  ];

  render(
    <MultiSelect
      groups={groups}
      value={[]}
      onChange={onChange}
      data-testid="multi-select"
    />
  );

  await userEvent.click(screen.getByTestId("multi-select"));
  await userEvent.click(screen.getByTestId("multi-select-group-group"));

  expect(onChange).toHaveBeenCalledWith(["a", "b"]);
});
```

## Related Components

- **Select**: Single-selection dropdown
- **Checkbox**: Individual boolean toggle
- **Command**: Searchable command palette (used internally)
- **Popover**: Dropdown container (used internally)

## Future Enhancements

Potential improvements (not currently implemented):

- **Select All** option for flat lists
- **Badge labels** for compact display (partially supported via `badgeLabel`)
- **Custom rendering** for option content
- **Async loading** for remote data sources
- **Disabled state** for individual options
