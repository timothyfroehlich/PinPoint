# Form Correctness & Native HTML Primitives

CORE-FORM-001..006 in practice, and where native platform primitives complement shadcn/Radix.

## Form Correctness

Forms are the highest-leverage place to follow the Widely-available web platform — the browser already does post-interaction validation, autofill, mobile-keyboard hints, and password-manager integration. Opt in correctly and most "form polish" tickets disappear.

### Input type

| Field                             | Type                                |
| :-------------------------------- | :---------------------------------- |
| Email (login, signup, reporter)   | `type="email"`                      |
| Phone                             | `type="tel"`                        |
| URL                               | `type="url"`                        |
| Password / new password / confirm | `type="password"`                   |
| Numeric ID (postal, etc.)         | `type="text" inputMode="numeric"`   |
| Number you do math on             | `type="number"`                     |
| Date / time                       | `type="date"` / `type="time"`       |
| Plain text                        | `type="text"` (the actual fallback) |

Wrong types lose the mobile keyboard hint and native format validation. `type="text"` for an email field is a CORE-FORM-001 violation.

### Autocomplete tokens

Password managers and browser autofill key on `autocomplete`. Wrong/missing tokens silently break credential flows.

```tsx
// Sign-in form
<Input id="email"            name="email"    type="email"    autoComplete="username" required />
<Input id="current-password" name="password" type="password" autoComplete="current-password" required />

// Sign-up form
<Input id="email"            name="email"            type="email"    autoComplete="username" required />
<Input id="new-password"     name="password"         type="password" autoComplete="new-password" required />
<Input id="confirm-password" name="confirm-password" type="password" autoComplete="off" required />
//                                                                                ^^^^^ off on confirm

// Anonymous-reporter form
<Input name="firstName" autoComplete="given-name" required />
<Input name="lastName"  autoComplete="family-name" required />
<Input name="email"     type="email" autoComplete="email" required />

// Domain-specific picker that should NOT autofill
<select id="machineId" name="machineId" autoComplete="off">…</select>
```

The full token list is in MDN; the auth-form-specific subset is in MWG `autofill-sign-in-form` and `autofill-sign-up-form`.

### `enterkeyhint` for mobile flow

Multi-field forms read better with the correct return-key label at each step. Baseline since Dec 2021.

```tsx
<Input enterKeyHint="next" /> // every field except the last
<Input enterKeyHint="next" />
<Input enterKeyHint="done" /> // last field
```

Use `"send"` on the last field of a message/search form, `"search"` on a search input, `"done"` on a generic last input.

### Post-interaction validation styling (`:user-invalid`)

> **Not yet implemented** — tracked under PP-kqbk.2. The shared `<Input>` currently only styles `aria-invalid:`. Add the `:user-invalid:` selectors in `src/components/ui/input.tsx` once; do not copy them per form site.

`:user-invalid` flips a CSS pseudo-class only **after** the user interacts with the control — no premature red rings on page load, no JS state to manage. Adding the two CSS variants below to the shared `<Input>` (and `<Textarea>`, `<Select>`) primitive gives the entire app post-interaction validation feedback for free.

```tsx
// Add to src/components/ui/input.tsx (and textarea.tsx, select.tsx)
<input
  className={cn(
    "border-input focus-visible:ring-ring",
    "aria-invalid:border-destructive aria-invalid:ring-destructive/40",
    "[&:user-invalid]:border-destructive [&:user-invalid]:ring-destructive/40",
    className
  )}
/>
```

### Screen-reader error announcement (`aria-invalid`)

> **Not yet implemented** — tracked under PP-kqbk.2 (bundled with `:user-invalid` styling above).

`:user-invalid` is visual only — AT users need `aria-invalid="true"` to hear "invalid" next to the field label. Add the listener to `src/components/ui/input.tsx` once so every field across the app gets it automatically — don't copy it per form.

```tsx
// Add to src/components/ui/input.tsx (and textarea.tsx, select.tsx)
function syncInvalid(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.setAttribute(
    "aria-invalid",
    e.currentTarget.checkValidity() ? "false" : "true"
  );
}

// In the primitive's render: pass syncInvalid as the default onBlur,
// merging with any caller-supplied onBlur via composeEventHandlers.
```

### Required-field indicators

Mark required fields visually before submission, not via a post-submit error.

```tsx
<Label htmlFor="email">
  Email <span aria-hidden="true">*</span>
</Label>
<Input id="email" name="email" type="email" autoComplete="username" required />
```

For a form with many required fields, include a legend (`<p className="text-sm text-muted-foreground">* required</p>`) once near the top instead of explaining at every label.

## Native HTML primitives alongside shadcn/Radix

> **shadcn/Radix is the design system.** It owns Dialog, AlertDialog, Sheet, Drawer, Popover, Tooltip, DropdownMenu, Accordion, Form, etc. Don't migrate components off Radix to chase native primitives — Radix delivers consistent variants, theming, focus trapping, animation, and a single tested behavior across the app.
>
> The web platform has Widely-available primitives that **complement** the shadcn stack. Reach for them in two situations: (1) one-off uses that don't deserve a new shadcn variant, and (2) attributes/behaviors that drop straight onto shadcn components and strengthen them.

### Use `inert` to harden Radix modals (CORE-A11Y-006)

`inert` (Baseline since Mar 2022) removes a subtree from tab order, click handling, and the AT tree in one declarative step — stronger than `aria-hidden` (AT-only). Radix uses `aria-hidden` + pointer-events on the rest of the DOM when a modal opens; layering `inert` on top closes a small but real focus-leak gap.

```tsx
// Wrap the page content so it goes inert while any modal is open.
<div inert={anyModalOpen || undefined}>{/* main page content */}</div>
```

The shadcn primitives stay — `inert` is one attribute added to the background container, not a replacement.

### Native `<dialog>` only when a shadcn variant would be overkill

`<dialog>.showModal()` is Baseline Widely available (Baseline since Mar 2023; see the Browser Support table in `references/browser-support.md`) and ships focus trap + top-layer + `::backdrop` for free. Use it for one-off, self-contained, single-purpose dialogs that don't earn a place in the shadcn variant system — for example, a debug-only inspector panel, an `<a href="#fragment">`-driven help blurb, or a tightly-scoped picker that doesn't need theming.

**Default to shadcn `<Dialog>` / `<AlertDialog>` / `<Sheet>` / `<Drawer>` for product UI.** Native `<dialog>` is an option in your toolbox, not the new default. If a Radix modal is doing its job, leave it.

### `<details>` + `<summary>` for trivial disclosure

For collapsible content that doesn't animate and doesn't need the visual treatment of `<Accordion>` — collapsible debug panels, `<summary>` for an inline "show more" — the native pair is keyboard- and SR-accessible with zero JS. Use shadcn `<Accordion>` whenever the disclosure is part of the product UI (FAQs, settings panels, content sections).

### Native form validation works with shadcn `<Input>`

`<Input>` already forwards `required`, `pattern`, `minLength`, `maxLength`. The browser does the validation; `:user-invalid` styles the result. `useActionState` handles cross-field validation (e.g., "passwords match") and server-side checks. You don't choose between shadcn and native — they layer.
