---
paths:
  - ".claude/rules/**"
---

# How this directory works

Each file here states rules in authoring voice and cites their canonical
`CORE-*` IDs. **`docs/NON_NEGOTIABLES.md` is the catalog** — severity,
rationale, and full do/don't live there and nowhere else. These files are an
index that arrives at the right moment, not a second copy of the catalog.

Claude Code loads a file here by its frontmatter:

- **No `paths:` field** → loaded at launch, for every session. Only
  `always.md` qualifies: rules that apply to every file in the repo, plus the
  two that follow a call (`checkPermission`, `db.transaction`) scattered widely
  enough that any honest glob set would cover most of `src/`.
- **A `paths:` list** → loaded on demand, the first time Claude reads a file
  matching any glob in the list.

That split is the whole point. Before this directory existed the same 20 rules
sat in one numbered list in `AGENTS.md` and were loaded on every session
regardless of what the session was doing — the responsive-layout rules were in
context for a migration, the migration rule was in context for a CSS change.
Now six rules load always and fourteen load when they are relevant.

## Adding or changing a rule

1. **State it in `docs/NON_NEGOTIABLES.md` first.** A rule with no `CORE-*` ID
   does not belong here. `scripts/check_rule_ids.py` (wired into
   `pnpm run check`) fails the build on a `CORE-*` citation in this directory
   that the catalog does not define, so a typo or a renamed rule is caught.
2. **Put it in the file whose `paths:` already match where it applies.** Adding
   a rule to an existing group is free; a new file means a new glob set, and a
   glob that matches two-thirds of the tree is an always-loaded rule wearing a
   costume — put it in `always.md` and say so.
3. **Keep the summary one or two sentences.** The catalog is the place for
   depth. Anything longer here gets skimmed, and it is a second copy that will
   drift.

## Globs

Patterns are repo-relative and match the same way everywhere else
(`**` spans directories, `*` does not). Route-group parentheses are literal —
`src/app/**` covers `src/app/(app)/…` without needing to escape anything, so
prefer it over spelling the group out.

One glob set is load-bearing beyond this directory. `server-actions.md` matches
action modules by **filename**, because a Server Action is marked by a
`"use server"` directive and a glob cannot read one. `pinpoint/server-action-file-naming`
in `eslint.config.mjs` is what keeps filenames and globs agreeing; without it a
new action named `foo.ts` would drop out of these rules silently.
