# Component Patterns

We use **shadcn/ui** as our component library. These components are copy-pasted into `src/components/ui` and are fully customizable.

## Customization Principles

1.  **Global First**: If a style change should apply to _every_ instance of a component (e.g., all inputs should have `h-10` instead of `h-9`), modify the component file in `src/components/ui`.
2.  **Local Second**: If a style is unique to a specific context, use the `className` prop.
3.  **Avoid Hardcoded Spacing**: Do not bake margin (`m-*`) into the base component. Spacing should be handled by the parent layout or passed via `className`.

## Standard Components

### Input

- **Default Height**: `h-9`
- **Padding**: `px-3 py-1` (or consistent with theme)
- **Width**: `w-full`

### Select

- **Trigger Width**: `w-full` (Modified from shadcn default `w-fit` to match Input behavior)

### Button

- **Variants**: Use `variant` prop (default, destructive, outline, secondary, ghost, link).
- **Sizes**: Use `size` prop (default, sm, lg, icon).
