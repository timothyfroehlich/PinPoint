# PinPoint Development Instructions (Claude Code)

@AGENTS.md

## Agent skills

### Issue tracker

PinPoint tracks durable project work in Beads. See `docs/agents/issue-tracker.md`.

### Domain docs

PinPoint uses single-context domain documentation. See `docs/agents/domain.md`.

## Claude Code-Specific

### Code review

`REVIEW.md` at the repo root is the canonical review rubric. Read it before launching the code-review skill.

Codex reviews every eligible PR update automatically. Author-side draft/CI/review ownership, the 51-line re-draft threshold, and explicit-request-only manual review paths are canonical in `pinpoint-pr-workflow` Phase 3.

### Sandbox network isolation

- `gh` CLI TLS errors are fixed by `enableWeakerNetworkIsolation: true` in `.claude/settings.local.json`.

### Working Style

- If you've spent more than 3 tool calls on environment setup without reproducing
  the actual issue, stop and ask the user for guidance.

### Status Vocabulary

- **"Shipped" means the change is live in production — deployed, nothing less.** Never call work "shipped" at an earlier stage. Use precise words for the rungs below it: _implemented_ (code written, local checks green), _PR opened / in review_ (pushed, PR exists, CI pending), _merged_ (on `main`). Match the word to the actual rung — don't let an earlier stage borrow a later word.

### Session Completion (Claude Code specifics)

The "Landing the plane" checklist (`pinpoint-pr-workflow` skill, Phases 4–5) applies to the lead agent and solo sessions.
