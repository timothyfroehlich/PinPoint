# Form Correctness Conventions (§20)

Required input attributes, autocomplete tokens, required-field indicators, and validation timing.

## 20. Form Correctness Conventions

Forms are the highest-leverage place to lean on the Widely-available web platform. The browser does post-interaction validation, autofill, mobile-keyboard hints, password-manager integration, and screen-reader announcement — opt in correctly and most "form polish" tickets disappear. Concrete rules and code in `pinpoint-ui` skill → `references/form-correctness.md`; canonical rules in CORE-FORM-001..006.

### Required attributes on every form input

| Attribute               | When                                                                 |
| :---------------------- | :------------------------------------------------------------------- |
| `type`                  | Always — `email`, `tel`, `url`, `password`, `text` per CORE-FORM-001 |
| `autocomplete`          | Every credential/identity input — per the token table below          |
| `required`              | Every field the form will refuse to submit without                   |
| `enterkeyhint`          | Every field in a multi-field form (CORE-FORM-006)                    |
| `inputmode`             | Numeric/decimal/tel where type alone isn't enough                    |
| `pattern` / `minlength` | When the validation can be expressed declaratively                   |

### Autocomplete token quick reference

| Form / field             | Token                                                     |
| :----------------------- | :-------------------------------------------------------- |
| Sign-in email            | `username`                                                |
| Sign-in password         | `current-password` (`id="current-password"` too)          |
| Sign-up email            | `username`                                                |
| Sign-up new password     | `new-password`                                            |
| Sign-up confirm password | `off` ← critical; do not autofill the confirm             |
| Reset password (new)     | `new-password`                                            |
| Reset password (confirm) | `off`                                                     |
| First name               | `given-name`                                              |
| Last name                | `family-name`                                             |
| Email (general identity) | `email`                                                   |
| Phone                    | `tel`                                                     |
| Domain-specific picker   | `off` (explicit — prevents browser from guessing/filling) |

### Required-field indicators

Append `<span aria-hidden="true">*</span>` to the `<Label>` of every required field. For forms with many required fields, include a `<p className="text-sm text-muted-foreground">* required</p>` legend once near the top. Don't rely on the post-submit error to teach the user which fields are required.

### Validation feedback timing

- **Visual:** `:user-invalid` styling on the shared `<Input>` / `<Textarea>` primitives — fires only after the user has interacted (CORE-FORM-003).
- **AT:** `aria-invalid="true"` synced on blur when `checkValidity()` fails (CORE-FORM-004). Both live in the primitive, once, never per form.
- **The shadcn `Select` is deliberately outside both mechanisms** — a Radix trigger is a `<button>` with no native validity, so invalid state there is caller-driven via `aria-invalid`. Don't try to extend the primitives' treatment to it. Rationale: `pinpoint-ui` skill → `references/form-correctness.md`.
- **Form-level errors:** `<Alert variant="destructive">` at the top of the form (per §13 Error State).
- **Field-level errors:** inline `<p className="text-sm text-destructive-text">` under the field. There is no form-library `<FormMessage>` — the app builds forms with plain `<form onSubmit>` + Server Actions.

### Submit-button enabled state

Disable a submit button **after** the user has attempted submission (to prevent double-posts), not preemptively while a field isn't yet filled. Preemptive disabling gives users no feedback about _why_ the button is greyed out. The exception is the shadcn `<Button loading>` state during an in-flight submission.
