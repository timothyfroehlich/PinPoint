# Mockups & Severity Vocabulary (§23–§24)

How to present mockups for review, and the player-centric severity levels.

## 23. Presenting Mockups for Review

When you build a mockup or prototype of a change for review, **show enough of the surrounding page that the reviewer can judge how the change fits** — not just the changed element in isolation.

- **Include the context, not only the delta.** Render the change inside its containing page archetype (§5) — neighboring sections, the header/nav chrome, the elements above and below it — so proportion, spacing, and placement among existing content are visible. A cropped fragment can only be evaluated for its own internal look, not for fit.
- **Err toward more context.** A too-wide mockup costs a few extra elements; a too-narrow one costs a review round because the reviewer can't tell whether it belongs. When unsure how much page to include, include more.
- **Label what's changing vs. unchanged.** Make it obvious which parts are the actual proposal and which are existing context shown for placement (a caption, a highlight, or a short "everything outside the highlighted area is current UI, shown for context" note). This keeps the surrounding context from reading as new design decisions up for debate.

This is a presentation rule for design _exploration_, not a constraint on the product UI itself.

## 24. Severity Vocabulary (player-centric language)

Issue severity has exactly four levels, and they are named for what a **player** experiences at the machine — not for how hard the repair is.

| Level        | Means                                                                               |
| :----------- | :---------------------------------------------------------------------------------- |
| `cosmetic`   | Visual only, play is unaffected — dirty glass, a minor bulb out                     |
| `minor`      | Small issue that doesn't change gameplay — sound slightly distorted                 |
| `major`      | Plays, but a significant feature is broken — a shot not registering, a weak flipper |
| `unplayable` | The machine cannot be played — ball stuck, flippers dead, no power                  |

**Rules:**

- Use player-centric language in every label, description, and piece of copy. The user filing an issue is a player standing at a machine, not a technician triaging a queue.
- These four, in this order. **Never** substitute technical or generic scales — no low/medium/high, no `critical`, no `P1`/`P2`, no `blocker`.
- The enum is defined once in `src/lib/issues/status.ts` (`SEVERITY_CONFIG`) and enforced by the schema enum; labels, colors, and icons come from there (§1). Don't restate the values in a component.

Machine status derives from these — `unplayable` on an open issue makes the machine unplayable, `major` makes it need service. That derivation lives in `src/lib/machines/status.ts`; see `pinpoint-ui` → **Server & Data Conventions**.
