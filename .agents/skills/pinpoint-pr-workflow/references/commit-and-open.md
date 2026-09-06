# Commit and open

## Commit

Branch rules (never on `main`, never rebase, verify `git branch -vv` tracks your branch)
are in `AGENTS.md` §5 "Branches". The required pre-commit gate is in `AGENTS.md` §2.2
"Process rules" and the §5 key-command and test-selection tables. Those sources are
canonical.

Use a conventional commit message: `<type>(<scope>): <description>`. No commit hook
enforces this.

- Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `style`.
- Choose the most-affected PinPoint scope, such as `issues`, `machines`, `auth`, `ui`,
  `db`, `e2e`, `agents`, `workflow`, `hooks`, `forms`, or `notifications`.

## Open the PR

Prefer MCP `create_pull_request` for typed arguments, or `gh pr create` from the shell.
Open every agent-created PR as a **GitHub draft**, regardless of size. Draft/ready state
controls eligibility for the later manual Codex review request; it is separate from the
PinPoint `ready-for-review` label applied only after review is complete.

### Agent origin

Every agent-opened PR carries exactly one origin label and a visible signature. These
identify the implementing session; they are not review, readiness, CI, or merge signals.

1. End the PR description with the full registered Huddle name: `—<huddle-name>`.
2. Add the implementing harness label:
   - `Claude-*` → `Claude`
   - `Codex-*` → `Codex`
   - `Antigravity-*` or `AGY-*` → `Agy`

Preserve other labels and description content. Preserve another agent's origin label
and signature when updating its PR.

### Adopt an `ownerless` PR

`ownerless` marks an open issue or PR created by an unattended bot with no session
driving its lifecycle. `gh pr list --label ownerless` is the unowned queue.

Adopting one means taking the full CI-and-review obligation. Remove `ownerless` in the
same step with `gh pr edit <PR> --remove-label ownerless`. An interactive agent never
adds `ownerless` to its own PR.

### Description template

```markdown
## Summary

- [1-3 bullets summarizing what changed and why]

## Test Plan

- [ ] [bulleted markdown checklist of TODOs for testing the PR]

## Related Issues

Closes #N (if applicable)

—<YourFullRegisteredHuddleName>
```

After opening the draft, read [CI and review](ci-and-review.md).
