# Styling with Tailwind CSS v4 & shadcn/ui Patterns

Token-driven styling and the conventions around the shadcn primitives. The primitives themselves live in `src/components/ui/` and are the source of truth for their own APIs — read the file rather than a description of it.

## Styling with Tailwind CSS v4

**Semantic tokens only.** Raw Tailwind palette classes and hardcoded hex are forbidden in component code and enforced by ESLint (`better-tailwindcss/no-restricted-classes`). The vocabulary and the design-layer exemptions are `pinpoint-design-bible` §1. Separately, §18 says which spelling is canonical where two exist — the MD-era names in `globals.css` are kept for backward compatibility but are not for new code.

**Merge classNames with `cn()`** from `~/lib/utils` — never template-string concatenation. `cn()` runs `tailwind-merge`, which drops the losing half of a conflicting pair so the last class you pass wins. Raw concatenation leaves both on the element, and since Tailwind utilities all carry the same specificity, the winner is whichever one sits later in the generated stylesheet — not the one you wrote last. A component that accepts `className` merges it last so callers can override. No inline `style={{…}}`.

## shadcn/ui Component Patterns

### Button

`src/components/ui/button.tsx` owns the variant and size lists. Read the `cva` call there when you need to pick one; any list written down here would be a second copy that drifts the next time a variant is added.

Two conventions that aren't visible from the API:

- **Use `loading` rather than hand-rolling an in-flight state.** It disables the button and renders the project's canonical CORE-A11Y-002 spinner (`animate-spin motion-reduce:animate-none`). A bare `disabled` plus your own `<Loader2>` usually loses the `motion-reduce:` pairing.
- **Don't size icon children.** The base class already sizes any `svg` that doesn't carry its own `size-*`, so adding `size-4` is noise; add one only when overriding. Icon-only buttons still need an `aria-label` (CORE-A11Y-004/005).

### Dialogs, sheets and drawers

Modal shapes, sizing, and footer button order are archetypes owned by `pinpoint-design-bible` §17. Don't build a custom `Modal` or `Drawer` wrapper.

Worth knowing before you pick one: **`Sheet` and `Drawer` are different components.** `sheet.tsx` is built on Radix Dialog; `drawer.tsx` wraps **vaul**, which is what gives the mobile "More" menu its swipe-to-close and momentum. They are not interchangeable, and the names don't tell you which is which.

### Forms

Form composition, required-field indicators, and the autocomplete/`enterkeyhint` conventions are `pinpoint-design-bible` §20. The Radix Select submission carve-out — the single biggest footgun in this codebase — is in `SKILL.md` § Server Action Forms; read it before writing any form that contains a `Select`.
