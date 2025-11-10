# Material 3 Color Conversion Guide

## Overview

This guide provides systematic conversion patterns from hardcoded Tailwind colors to Material 3 semantic colors for GitHub Copilot tasks.

**IMPORTANT:** This is a color conversion task only. Do not fix TypeScript errors, functionality issues, or other problems not directly caused by the color changes.

## Material 3 Color System

Our Material 3 colors are generated from source color `#6750A4` (purple) and available as CSS custom properties in `globals.css`. All color classes use the format: `bg-{role}`, `text-{role}`, `border-{role}`.

## Common Conversion Patterns

### Background Colors

| Hardcoded Color | Material 3 Replacement        | Usage                          |
| --------------- | ----------------------------- | ------------------------------ |
| `bg-white`      | `bg-surface`                  | Default backgrounds, cards     |
| `bg-gray-50`    | `bg-surface-container-lowest` | Subtle container backgrounds   |
| `bg-gray-100`   | `bg-surface-container-low`    | Light container backgrounds    |
| `bg-gray-200`   | `bg-surface-container`        | Standard container backgrounds |
| `bg-gray-300`   | `bg-surface-container-high`   | Elevated container backgrounds |
| `bg-red-50`     | `bg-error-container`          | Error state backgrounds        |
| `bg-red-500`    | `bg-error`                    | Primary error backgrounds      |
| `bg-red-600`    | `bg-error`                    | Primary error backgrounds      |
| `bg-green-50`   | `bg-tertiary-container`       | Success/positive backgrounds   |
| `bg-green-500`  | `bg-tertiary`                 | Primary success backgrounds    |
| `bg-green-600`  | `bg-tertiary`                 | Primary success backgrounds    |
| `bg-blue-50`    | `bg-primary-container`        | Primary state backgrounds      |
| `bg-blue-500`   | `bg-primary`                  | Primary action backgrounds     |
| `bg-blue-600`   | `bg-primary`                  | Primary action backgrounds     |
| `bg-yellow-50`  | `bg-secondary-container`      | Warning/attention backgrounds  |
| `bg-yellow-200` | `bg-secondary-container`      | Warning/attention backgrounds  |
| `bg-purple-50`  | `bg-primary-container`        | Primary variant backgrounds    |
| `bg-purple-500` | `bg-primary`                  | Primary backgrounds            |
| `bg-purple-600` | `bg-primary`                  | Primary backgrounds            |

### Text Colors

| Hardcoded Color   | Material 3 Replacement                 | Usage                                  |
| ----------------- | -------------------------------------- | -------------------------------------- |
| `text-white`      | `text-on-surface` or `text-on-primary` | High contrast text (context dependent) |
| `text-gray-400`   | `text-on-surface-variant`              | Subtle text, captions                  |
| `text-gray-500`   | `text-on-surface-variant`              | Secondary text                         |
| `text-gray-600`   | `text-on-surface`                      | Primary text on light backgrounds      |
| `text-gray-700`   | `text-on-surface`                      | Primary text                           |
| `text-gray-800`   | `text-on-surface`                      | High emphasis text                     |
| `text-gray-900`   | `text-on-surface`                      | Highest emphasis text                  |
| `text-red-600`    | `text-error`                           | Error text                             |
| `text-red-700`    | `text-error`                           | Error text                             |
| `text-red-800`    | `text-on-error-container`              | Text on error backgrounds              |
| `text-green-600`  | `text-tertiary`                        | Success/positive text                  |
| `text-green-700`  | `text-tertiary`                        | Success/positive text                  |
| `text-green-800`  | `text-on-tertiary-container`           | Text on success backgrounds            |
| `text-blue-600`   | `text-primary`                         | Primary action text                    |
| `text-blue-700`   | `text-primary`                         | Primary action text                    |
| `text-blue-800`   | `text-on-primary-container`            | Text on primary backgrounds            |
| `text-yellow-700` | `text-secondary`                       | Warning/attention text                 |
| `text-yellow-800` | `text-on-secondary-container`          | Text on warning backgrounds            |
| `text-purple-600` | `text-primary`                         | Primary text                           |
| `text-purple-700` | `text-primary`                         | Primary text                           |
| `text-purple-800` | `text-on-primary-container`            | Text on primary backgrounds            |

### Border Colors

| Hardcoded Color     | Material 3 Replacement   | Usage                 |
| ------------------- | ------------------------ | --------------------- |
| `border-white`      | `border-outline-variant` | Subtle borders        |
| `border-gray-200`   | `border-outline-variant` | Default borders       |
| `border-gray-300`   | `border-outline`         | Standard borders      |
| `border-red-200`    | `border-error`           | Error state borders   |
| `border-green-200`  | `border-tertiary`        | Success state borders |
| `border-blue-200`   | `border-primary`         | Primary state borders |
| `border-yellow-200` | `border-secondary`       | Warning state borders |

### Gradient Colors

| Hardcoded Pattern             | Material 3 Replacement              | Usage                     |
| ----------------------------- | ----------------------------------- | ------------------------- |
| `from-purple-600 to-blue-500` | `from-primary to-primary-container` | Primary gradients         |
| `from-blue-600 to-purple-500` | `from-primary-container to-primary` | Reverse primary gradients |

## Context-Specific Replacements

### Authentication Components

- Error states: Use `bg-error-container` with `text-on-error-container`
- Success states: Use `bg-tertiary-container` with `text-on-tertiary-container`
- Form backgrounds: Use `bg-surface` or `bg-surface-container-low`

### Settings & Admin Components

- Security warnings: Use `bg-secondary-container` with `text-on-secondary-container`
- System status indicators: Use `bg-tertiary-container` for healthy/good states
- Configuration cards: Use `bg-surface-container` for elevated appearance

### Issue Management Components

- Status indicators:
  - New/Critical: `bg-error` with `text-on-error`
  - In Progress: `bg-secondary` with `text-on-secondary`
  - Completed: `bg-tertiary` with `text-on-tertiary`
- Comment threads: Use `bg-surface-container-low` for subtle separation

## Examples

### Before & After: Button Variants

**Before:**

```tsx
<Button className="bg-red-600 text-white hover:bg-red-700 border-red-600">
  Delete
</Button>
```

**After:**

```tsx
<Button className="bg-error text-on-error hover:bg-error/90 border-error">
  Delete
</Button>
```

### Before & After: Card with Status

**Before:**

```tsx
<div className="bg-white border-gray-200 text-gray-800">
  <div className="bg-green-50 text-green-800 border-green-200">Success</div>
</div>
```

**After:**

```tsx
<div className="bg-surface border-outline-variant text-on-surface">
  <div className="bg-tertiary-container text-on-tertiary-container border-tertiary">
    Success
  </div>
</div>
```

### Before & After: Form with Error State

**Before:**

```tsx
<form className="bg-white">
  <input className="border-gray-300 text-gray-900" />
  <div className="bg-red-50 text-red-800 border-red-200">Error message</div>
</form>
```

**After:**

```tsx
<form className="bg-surface">
  <input className="border-outline text-on-surface" />
  <div className="bg-error-container text-on-error-container border-error">
    Error message
  </div>
</form>
```

## Verification Commands

After making changes, run these commands to verify the conversion:

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Optional: Run specific component tests if they exist
npm test -- --testNamePattern="YourComponent"
```

## Scope Rules

### ✅ DO CONVERT:

- `bg-{color}-{number}` → `bg-{material3-role}`
- `text-{color}-{number}` → `text-{material3-role}`
- `border-{color}-{number}` → `border-{material3-role}`
- `from-{color}-{number}` → `from-{material3-role}`
- `to-{color}-{number}` → `to-{material3-role}`

### ❌ DON'T FIX:

- TypeScript errors not caused by color changes
- Missing imports or components
- Functionality bugs
- Performance issues
- Other ESLint warnings unrelated to colors

### ⚠️ SPECIAL CASES:

- If a hardcoded color doesn't have a clear Material 3 equivalent, use the closest semantic match
- For hover states, add `/90` opacity: `hover:bg-primary/90`
- For disabled states, add `/50` opacity: `disabled:bg-surface/50`

## Available Material 3 Colors

### Primary Family

- `primary`, `on-primary`
- `primary-container`, `on-primary-container`
- `primary-fixed`, `on-primary-fixed`
- `primary-fixed-dim`, `on-primary-fixed-variant`

### Secondary Family

- `secondary`, `on-secondary`
- `secondary-container`, `on-secondary-container`
- `secondary-fixed`, `on-secondary-fixed`
- `secondary-fixed-dim`, `on-secondary-fixed-variant`

### Tertiary Family

- `tertiary`, `on-tertiary`
- `tertiary-container`, `on-tertiary-container`
- `tertiary-fixed`, `on-tertiary-fixed`
- `tertiary-fixed-dim`, `on-tertiary-fixed-variant`

### Error Family

- `error`, `on-error`
- `error-container`, `on-error-container`

### Surface Family

- `surface`, `on-surface`
- `surface-variant`, `on-surface-variant`
- `surface-container-lowest`
- `surface-container-low`
- `surface-container`
- `surface-container-high`
- `surface-container-highest`

### Other

- `outline`, `outline-variant`
- `shadow`, `scrim`

---

**Remember:** This is a systematic color conversion task. Focus only on replacing hardcoded colors with Material 3 semantic colors. Keep all other functionality intact.
