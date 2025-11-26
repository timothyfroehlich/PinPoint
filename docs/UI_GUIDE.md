# UI Development Guide

**Status**: Living Document
**Authority**: High (Follow this for all UI work)

This guide is the single source of truth for UI development in PinPoint. It consolidates best practices for our specific stack: **Next.js 16**, **Tailwind CSS v4**, and **shadcn/ui**.

## 1. Technology Stack

- **Tailwind CSS v4**: The styling engine. We use the new CSS-first configuration (`@theme` in CSS), not `tailwind.config.ts`.
- **shadcn/ui**: The component library. Components live in `src/components/ui` and are owned by us.
- **Lucide React**: The icon set.
- **Next.js 16**: The framework. We heavily leverage Server Components and Server Actions.

## 2. Styling Philosophy

### Global vs. Local

- **Global (`globals.css`)**: Defines the "Soul" of the app. Typography, colors, radius, and resets live here.
- **Component (`src/components/ui/*`)**: Defines the "Body" of the app. Reusable primitives (Buttons, Inputs) get their base styles here.
- **Instance (`className`)**: Defines the "Context". Margins, width, and positioning happen here.

### The "No-Cruft" Rule

- **No Hardcoded Colors**: Use `bg-muted`, not `bg-[#f4f4f5]`.
- **No Arbitrary Spacing**: Use `p-4`, `m-2`, not `p-[13px]`.
- **No Inline Styles**: `style={{ ... }}` is forbidden unless strictly dynamic (e.g., coordinates).

## 3. Component Architecture (Server-First)

We follow a strict **Server-First** approach to UI.

### The Leaf Pattern

Push `"use client"` as far down the tree as possible.

- **Server**: Pages, Layouts, Data Fetching, Container Components.
- **Client**: Interactive leaves (Buttons with `onClick`, Forms with `useActionState`, Dropdowns).

### Progressive Enhancement

Forms **MUST** work without JavaScript.

1.  **Base**: `<form action={serverAction}>`.
2.  **Enhance**: Wrap in a Client Component using `useActionState` for loading states/validation.
3.  **Forbidden**: `onClick={() => submit()}` on a div.

## 4. Common Patterns

### Layouts

- **PageShell**: Use `src/components/layout/PageShell` for standard page containers.
- **Grid**: Prefer CSS Grid for main layouts (`grid-cols-[250px_1fr]`).

### Typography

- **Defaults**: `h1`-`h6`, `p`, `a` have global styles. Do not add utility classes unless overriding.
- **Prose**: For user-generated content, use a `prose` wrapper (if installed) or standard tags.

### Forms

- **Structure**: Label + Input + Error Message.
- **Validation**: Zod on the server.
- **Feedback**: `useActionState` for inline errors, `Flash` messages for redirects.

## 5. Troubleshooting

### "My styles aren't applying"

- **Check Specificity**: Tailwind v4 has low specificity. Custom CSS might override it.
- **Check `cn()`**: Did you merge `className` in your component?
- **Check Cache**: `rm -rf .next` if Tailwind seems stuck.

### "Hydration Error"

- **Cause**: HTML mismatch between Server and Client.
- **Fix**: Ensure you aren't rendering random data (dates, math) without `useEffect` or `suppressHydrationWarning`.
- **Fix**: Check for invalid HTML nesting (e.g., `<div>` inside `<p>`).

## 6. Reference

- [**Styling Principles**](ui-patterns/styling-principles.md)
- [**Typography**](ui-patterns/typography.md)
- [**Components**](ui-patterns/components.md)
