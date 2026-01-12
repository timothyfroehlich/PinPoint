# Visual Component Structure

## StatusSelect Component

### Trigger (Closed State)

```
┌─────────────────────────────────────────┐
│ ● New                            ▼      │
└─────────────────────────────────────────┘
```

### Dropdown (Open State)

```
┌─────────────────────────────────────────┐
│ New                                      │
├─────────────────────────────────────────┤
│ ● New                 [tooltip: Just... │
│ ● Confirmed           [tooltip: Verifi...│
├─────────────────────────────────────────┤
│ In Progress                              │
├─────────────────────────────────────────┤
│ ◉ In Progress         [tooltip: Active...│
│ ◉ Need Parts          [tooltip: Waitin...│
│ ◉ Need Help           [tooltip: Escala...│
│ ◉ Pending Owner       [tooltip: Pendin...│
├─────────────────────────────────────────┤
│ Closed                                   │
├─────────────────────────────────────────┤
│ ⬤ Fixed               [tooltip: Issue...│
│ ⬤ As Intended         [tooltip: Workin...│
│ ⬤ Won't Fix           [tooltip: Issue...│
│ ⬤ No Repro            [tooltip: Couldn...│
│ ⬤ Duplicate           [tooltip: Already│
└─────────────────────────────────────────┘
```

Legend:

- ● = Circle (New statuses, cyan/teal colors)
- ◉ = CircleDot (In Progress statuses, purple/pink colors)
- ⬤ = Disc (Closed statuses, green/gray colors)

## SeveritySelect Component

### Trigger (Closed State)

```
┌─────────────────────────────────────────┐
│ ⚠ Minor                          ▼      │
└─────────────────────────────────────────┘
```

### Dropdown (Open State)

```
┌─────────────────────────────────────────┐
│ ⚠ Cosmetic                               │
│ ⚠ Minor                                  │
│ ⚠ Major                                  │
│ ⚠ Unplayable                             │
└─────────────────────────────────────────┘
```

All items use AlertTriangle (⚠) icon with amber color gradations.

## PrioritySelect Component

### Trigger (Closed State)

```
┌─────────────────────────────────────────┐
│ ↗ Medium                         ▼      │
└─────────────────────────────────────────┘
```

### Dropdown (Open State)

```
┌─────────────────────────────────────────┐
│ ↗ Low                                    │
│ ↗ Medium                                 │
│ ↗ High                                   │
└─────────────────────────────────────────┘
```

All items use TrendingUp (↗) icon with purple color gradations.

## ConsistencySelect Component

### Trigger (Closed State)

```
┌─────────────────────────────────────────┐
│ ↻ Intermittent                   ▼      │
└─────────────────────────────────────────┘
```

### Dropdown (Open State)

```
┌─────────────────────────────────────────┐
│ ↻ Intermittent                           │
│ ↻ Frequent                               │
│ ↻ Constant                               │
└─────────────────────────────────────────┘
```

All items use Repeat (↻) icon with cyan color gradations.

## Color Mappings

### Status Colors (from STATUS_CONFIG)

- **New**: Cyan (text-cyan-400)
- **Confirmed**: Teal (text-teal-400)
- **In Progress**: Fuchsia (text-fuchsia-400)
- **Need Parts**: Purple (text-purple-300)
- **Need Help**: Pink (text-pink-400)
- **Pending Owner**: Purple (text-purple-400)
- **Fixed**: Green (text-green-400)
- **As Intended**: Gray (text-zinc-400)
- **Won't Fix**: Gray (text-zinc-400)
- **No Repro**: Slate (text-slate-400)
- **Duplicate**: Neutral (text-neutral-400)

### Severity Colors

- **Cosmetic**: Light Amber (text-amber-300)
- **Minor**: Medium Amber (text-amber-400)
- **Major**: Dark Amber (text-amber-500)
- **Unplayable**: Darker Amber (text-amber-600)

### Priority Colors

- **Low**: Dark Purple (text-purple-600)
- **Medium**: Medium Purple (text-purple-400)
- **High**: Light Purple (text-purple-200)

### Consistency Colors

- **Intermittent**: Dark Cyan (text-cyan-600)
- **Frequent**: Medium Cyan (text-cyan-400)
- **Constant**: Light Cyan (text-cyan-200)

## Integration Points

### Update Forms (Issue Detail Page)

Located at: `/m/[initials]/i/[issueNumber]`

```tsx
// Each form follows this pattern:
<StatusSelect
  value={selectedStatus}
  onValueChange={handleValueChange}
  disabled={isPending}
/>
```

With auto-submit on change:

```tsx
const handleValueChange = (newValue) => {
  setSelectedValue(newValue);
  const form = document.querySelector('form[data-form="form-name"]');
  if (form instanceof HTMLFormElement) {
    form.requestSubmit();
  }
};
```

### Unified Report Form

Located at: `/report`

```tsx
// Each select used with hidden input for form submission:
<Label>Severity *</Label>
<input type="hidden" name="severity" value={severity} />
<SeveritySelect
  value={severity}
  onValueChange={setSeverity}
/>
```

## Accessibility Features

1. **ARIA Labels**: Each select has `aria-label` attribute
2. **Test IDs**: All options maintain `data-testid` attributes
3. **Keyboard Navigation**: Full keyboard support via Radix UI
4. **Focus Indicators**: Clear focus states
5. **Screen Reader Support**: Proper semantic HTML structure
6. **Tooltips**: Status descriptions available on hover (StatusSelect only)

## Responsive Behavior

- Dropdowns use `position="popper"` for proper positioning
- Content adapts to available viewport space
- Touch-friendly target sizes on mobile
- Proper z-index layering for overlays
