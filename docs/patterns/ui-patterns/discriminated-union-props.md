# Discriminated Union Component Props

**Status**: Established Pattern
**Version**: 1.0
**Last Updated**: January 10, 2026

---

## Overview

Use TypeScript discriminated unions for component props when a single component handles multiple related types. This ensures type safety by linking the `type` prop to the correct `value` type.

## Pattern Structure

```typescript
// Base props shared across all variants
type BaseProps = {
  variant?: "normal" | "compact";
  className?: string;
  showTooltip?: boolean;
};

// Discriminated union for type-specific props
type ComponentProps = BaseProps &
  (
    | { type: "status"; value: StatusEnum }
    | { type: "priority"; value: PriorityEnum }
    | { type: "severity"; value: SeverityEnum }
  );

export function MyComponent({
  type,
  value,
  variant,
  className,
}: ComponentProps) {
  // TypeScript knows value type based on type prop
  // e.g., if type is "status", value must be StatusEnum
}
```

## Real-World Example: IssueBadge

[src/components/issues/IssueBadge.tsx](file:///home/froeht/Code/PinPoint/src/components/issues/IssueBadge.tsx)

```typescript
type IssueBadgeProps = {
  variant?: "normal" | "strip";
  className?: string;
  showTooltip?: boolean;
} & (
  | { type: "status"; value: IssueStatus }
  | { type: "severity"; value: IssueSeverity }
  | { type: "priority"; value: IssuePriority }
  | { type: "consistency"; value: IssueConsistency }
);

export function IssueBadge({ type, value, variant, className, showTooltip }: IssueBadgeProps) {
  let label = "";
  let styles = "";
  let Icon: React.ElementType | null = null;

  // Switch on discriminant to get correct config
  switch (type) {
    case "status":
      label = getIssueStatusLabel(value); // value is IssueStatus
      styles = STATUS_STYLES[value];
      Icon = getIssueStatusIcon(value);
      break;
    case "severity":
      label = getIssueSeverityLabel(value); // value is IssueSeverity
      styles = SEVERITY_STYLES[value];
      Icon = ISSUE_FIELD_ICONS.severity;
      break;
    // ... other cases
  }

  return (
    <Badge className={cn(styles, className)}>
      <Icon className="size-3" />
      <span>{label}</span>
    </Badge>
  );
}
```

## Usage

```tsx
// ✅ Correct: Type and value match
<IssueBadge type="status" value="in_progress" />
<IssueBadge type="severity" value="major" />

// ❌ TypeScript error: value doesn't match type
<IssueBadge type="status" value="major" /> // Error: "major" is not IssueStatus
<IssueBadge type="severity" value="new" /> // Error: "new" is not IssueSeverity
```

## Benefits

1. **Type Safety**: TypeScript enforces that `value` matches `type`
2. **Single Component**: One component handles multiple related types
3. **Exhaustive Checking**: Switch statements ensure all types are handled
4. **Clear API**: Users can't pass invalid type/value combinations
5. **Good DX**: IDE autocomplete shows correct values for each type

## When to Use

✅ Component renders different content based on a `type` prop
✅ Each type requires a different value type
✅ Types share common rendering logic (colors, icons, labels)
✅ Types are conceptually related (all badges, all inputs, etc.)

❌ Types have completely different rendering logic (use separate components)
❌ Only one type exists (use simple props)
❌ Types don't share any props (use separate components)

## Pattern Variations

### With Optional Discriminant

```typescript
type Props = {
  value: string;
} & (
  | { showIcon: true; icon: LucideIcon }
  | { showIcon?: false; icon?: never }
);

// ✅ If showIcon is true, icon is required
<Component value="test" showIcon icon={Check} />

// ✅ If showIcon is false/undefined, icon is not allowed
<Component value="test" />
```

### With Nested Discriminants

```typescript
type Props =
  | { type: "text"; value: string; placeholder?: string }
  | { type: "number"; value: number; min?: number; max?: number }
  | {
      type: "select";
      value: string;
      options: Array<{ label: string; value: string }>;
    };
```

## Complementary Patterns

Discriminated union props work well with:

- [Config-Driven Enums](./config-driven-enums.md) - Use enum configs to get metadata
- [Pick\u003cType, Keys\u003e](./type-boundaries.md) - Narrow prop types for grid/list components

## Real-World Examples

### IssueBadge

[src/components/issues/IssueBadge.tsx](file:///home/froeht/Code/PinPoint/src/components/issues/IssueBadge.tsx)

Single component handles 4 badge types (status, severity, priority, consistency) with type-safe values.

### IssueBadgeGrid

[src/components/issues/IssueBadgeGrid.tsx](file:///home/froeht/Code/PinPoint/src/components/issues/IssueBadgeGrid.tsx)

Uses `Pick<Issue, "status" | "severity" | "priority" | "consistency">` to accept minimal props and composes `IssueBadge` components.

## Anti-Patterns

### ❌ String Union Without Discrimination

```typescript
// BAD: No type safety between category and value
type Props = {
  category: "status" | "severity";
  value: string; // Could be anything!
};
```

### ❌ Separate Boolean Props

```typescript
// BAD: Can set multiple booleans to true
type Props = {
  isStatus?: boolean;
  isSeverity?: boolean;
  value: string;
};
```

### ❌ Any Type Value

```typescript
// BAD: Loses type safety
type Props = {
  type: "status" | "severity";
  value: any; // Defeats the purpose!
};
```

## TypeScript Tips

### Narrowing in Switch

```typescript
function MyComponent(props: ComponentProps) {
  switch (props.type) {
    case "status":
      // TypeScript knows props.value is IssueStatus here
      const label = getIssueStatusLabel(props.value);
      break;
    case "severity":
      // TypeScript knows props.value is IssueSeverity here
      const label = getIssueSeverityLabel(props.value);
      break;
  }
}
```

### Exhaustive Checking

```typescript
function MyComponent(props: ComponentProps) {
  switch (props.type) {
    case "status":
      return <StatusBadge />;
    case "severity":
      return <SeverityBadge />;
    default:
      // TypeScript error if we miss a case
      const exhaustive: never = props.type;
      throw new Error(`Unhandled type: ${exhaustive}`);
  }
}
```

## Related Patterns

- [Config-Driven Enums](./config-driven-enums.md)
- [Type Boundaries](./type-boundaries.md)
- [Component Composition](./ui-patterns/component-composition.md)

## References

- [TypeScript Handbook: Discriminated Unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions)
- [src/components/issues/IssueBadge.tsx](file:///home/froeht/Code/PinPoint/src/components/issues/IssueBadge.tsx)
