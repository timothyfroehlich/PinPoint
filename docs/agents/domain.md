# Domain Docs

Read this document before exploring or changing non-mechanical product behavior.
It routes the domain documentation that applies to the work.

## Read before product work

- **`CONTEXT.md`** — the project-wide glossary. Use its canonical terms in
  specifications, Beads, tests, and user-facing discussions.
- **`docs/feature-specs/<feature>.md`** — read the relevant feature spec before
  changing behavior it covers. The spec is the intended truth; its divergence
  table describes any known gap with the code.
- **`docs/adr/`** — when this directory exists, read ADRs that concern the area
  before revisiting an architectural choice.

If no relevant feature spec or ADR exists, continue without creating one. The
`domain-modeling` skill creates `CONTEXT.md` entries and ADRs only when a term
or a consequential decision has actually been resolved.

## When this does not apply

Skip these documents for mechanical changes that do not alter product behavior
or domain language, such as formatting, a dependency pin, or CI-only plumbing.

## Conflicts

Use the glossary's vocabulary rather than synonyms. If proposed behavior
contradicts a feature spec or ADR, surface the conflict for a decision instead
of silently overriding it.
