---
name: pinpoint-prototype-mode
description: Opt-in rapid-iteration mode for design/idea exploration. Relaxes test/lint/type rigor in favor of speed while tracking the resulting debt. Use when the user says "prototype mode", "rapid iteration", "vibe", or asks to explore an idea quickly without worrying about tests passing. Also read this to EXIT the mode.
---

# PinPoint Prototype Mode

A deliberately-entered, deliberately-exited mode for iterating on designs and
ideas fast — without stopping to make tests, lint, and types green at every
step. The work is **not** done when prototype mode ends; the mode tracks
exactly what rigor was skipped so it can be repaid.

## When to use

Enter **only** when the user explicitly asks: "prototype mode", "rapid
iteration", "let's just explore", "vibe on this", "don't worry about tests for
now", or similar. **Never self-elect into this mode.** Full rigor (AGENTS.md
§2) is always the default.

## Entering the mode

1. Announce: "⚡ Entering prototype mode — rigor relaxed, debt tracked."
2. Create the marker file `.prototype-mode` at the worktree root (it is
   gitignored). Seed it with the ledger template below.
3. From here on, follow the relaxed rules and append to the ledger as you skip
   things.

Marker file template:

```markdown
# Prototype mode — entered <ISO date/time>

Goal: <one line: what are we exploring?>

## Debt ledger (repay before this work is "real")

- [ ] (nothing skipped yet)
```

## What is RELAXED in prototype mode

- **Don't run `preflight`/`check`/tests before showing work.** Show the change
  and move on. Iterate on the idea, not the gates.
- **Don't fix every lint / type-strictness error mid-flight.** A red squiggle
  is fine while exploring. Log it in the ledger.
- **Don't write test coverage yet.** Log "needs tests: <what>" in the ledger.
- **Don't polish for DRY / architecture / Rule-of-Three.** Duplicate freely;
  note it for later.
- **Don't spawn review subagents or worry about Copilot/CI.**

Every time you skip one of these, add a concrete line to the ledger. "Later"
must be a real checklist, not an implied promise.

## What is NEVER relaxed (even in prototype mode)

These are cheap and keep "fast" from becoming "unusable" or "dangerous":

- **No commit, no push, no PR.** Prototype work stays in the working tree. (If
  you do commit, pre-commit/preflight hooks still run and will block — that's
  expected; the point of this mode is you're _not_ committing yet.)
- **Never touch production** (no prod DB, no prod deploy, no prod secrets).
- **Never delete or weaken existing tests** to make something pass.
- **Auth, permissions, and data-privacy rules still apply** (AGENTS.md §2.1 #5
  Supabase SSR, #10 email privacy, #11 permissions matrix) — a prototype that
  leaks data or bypasses a permission check isn't a prototype, it's a bug.
- **`localhost` not `127.0.0.1`** (#14) — breaking this wastes iteration time
  on auth failures, so keep it.

## Exiting the mode

Triggered when the user says "exit prototype mode", "make this real", "let's
land it", or starts asking for tests/PR/commit.

1. Read `.prototype-mode` and present the debt ledger as a checklist of what
   must now happen: tests to write, lint/type errors to fix, `preflight` to
   green, DRY cleanup.
2. Delete the marker file.
3. Announce: "✅ Exited prototype mode. Repaying debt:" followed by the
   checklist. Then resume full AGENTS.md §2 rigor.

Do not silently drop the ledger. If the user wants to abandon the prototype
entirely, confirm before deleting the marker without repaying.
