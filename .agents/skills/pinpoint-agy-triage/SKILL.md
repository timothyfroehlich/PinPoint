---
name: pinpoint-agy-triage
description: Grooming skill for deciding whether to tag a bead agy-ready (and optionally agy-ui). Use during grooming sessions when evaluating whether a bead is suitable for Antigravity to execute autonomously.
---

# pinpoint-agy-triage

**When to invoke:** During grooming, when Tim asks "is this agy-ready?" or "which beads can Antigravity work on?", or when running a batch triage of open work.

---

## What is Antigravity?

Antigravity is Google's CLI agent harness (currently Gemini-based) with full local environment access — Supabase, dev server, browser via Chrome. It is **less inquisitive** than Claude Sonnet: it will not stop mid-task to ask clarifying questions. Every bead it executes must be decision-closed before it starts.

Use the `agy-ready` label to mark candidates. Use the `agy-ui` label additionally for beads where acceptance requires visual or interaction verification in a running browser.

---

## Triage Gates

**ALL six gates must pass** before tagging `agy-ready`. Failing even one gate means the bead is not ready — do not tag.

### Gate 1 — Decision-closed (load-bearing)

No "discuss with user", no architectural forks, no TBDs. Every interpretive choice has a written answer in the bead description, acceptance criteria, or a linked decision bead.

If the bead has "Option A / Option B / Option C" branches with no chosen winner, it is NOT ready. Antigravity will pick the first plausible option and ship it.

### Gate 2 — Scope-pinned

Specific files, or an unambiguous "do X wherever pattern Y appears" instruction. Acceptance criteria must be writable as concrete test assertions.

### Gate 3 — Concrete acceptance

End-state is testable with objective evidence:

- "X test passes"
- "Y string no longer in repo"
- "form has `type=email autocomplete=email`"
- "DB constraint rejects bad insert"
- "component renders `<element>` at viewport ≥ md"

NOT acceptable: "improve UX", "make it cleaner", "looks better."

### Gate 4 — Concrete verification plan

The bead names the exact command(s) to run:

- `pnpm run check`
- `pnpm run preflight`
- `pnpm exec playwright test e2e/path/file.spec.ts --project=chromium`

If verification requires CI (e.g., a Supabase branch DB), say so explicitly in the bead.

### Gate 5 — UI eligibility

UI beads **are** eligible for Antigravity. Antigravity can drive a Chrome browser to verify visual changes.

**Tag `agy-ui` when:** the bead changes rendered output (component, page, layout, styling, or interaction) and the acceptance criteria are only confirmable by looking at or interacting with the running UI.

**Do NOT tag `agy-ui` for:** pure logic, scripts, tests, docs, or changes whose acceptance is fully captured by a passing test or absent string.

Gates 1–3 still apply to UI beads. "Does this look right?" beads fail Gate 3 (no concrete acceptance). Pre-approved mockups with exact dimensions or a linked design-bible section satisfy Gate 1 + Gate 3 together.

### Gate 6 — Self-contained

No dependency on an open PR, no cross-bead coordination, no waiting on a teammate.

---

## Workflow

### Tagging

When all gates pass:

```sh
bd label add agy-ready <id>
```

If the bead also satisfies the `agy-ui` condition (Gate 5):

```sh
bd label add agy-ui <id>
```

Append a one-line fit note explaining why it passes — this helps the next grooming pass confirm the tag is still valid:

```sh
bd comment <id> 'agy-ready: <one-line fit note>'
# e.g.: 'agy-ready: scope-pinned to auth form fields; pnpm run check verification; no open decisions'
# e.g.: 'agy-ready + agy-ui: icon swap in MachineCard; visual confirmation needed; exact target is the wrench icon → cog icon per design-bible §12'
```

### When a gate fails but is fixable

If a gate fails due to a missing verification plan, an undecided UI detail, or an open Option A/B fork, leave a comment describing the gap instead of tagging:

```sh
bd comment <id> 'agy-candidate but not ready: missing verification command. Add the exact pnpm command to run after implementation.'
```

Do not tag `agy-ready` — surface for refinement.

### Discovering candidates

```sh
bd query "label=agy-ready AND status=open" --priority-max=2
```

The `--priority-max=2` filter is a heuristic — P1/P2 beads first. Remove it to see all priorities.

### Post-execution

After Antigravity ships a PR, treat it like any other agent PR: Copilot review, CI, ready-for-review label, then Tim merges. No special handling needed.

---

## When in doubt, default to FAIL

Under-tagging is safe — Antigravity just has fewer candidates to pick from.

Over-tagging causes Antigravity to make judgment calls it was never meant to make, silently shipping wrong choices.

If a gate is ambiguous, leave a `bd comment` describing the gap and skip the tag.
