---
name: pinpoint-agy-dispatch
description: Run in Claude Code to hand a specific bead to Antigravity. Emits a copy-paste prompt for the Antigravity 2.0 agent manager. Does NOT create branches or worktrees — the agent manager does that from the prompt text.
---

# pinpoint-agy-dispatch

**When to invoke:** Tim says "dispatch this to Antigravity", "hand PP-xxx to agy", or "pick an agy-ready bead and send it to Antigravity."

Run **in Claude Code** (not in Antigravity). The output is a copy-paste prompt for the Antigravity 2.0 agent manager.

---

## Why this skill exists

The Antigravity 2.0 agent manager derives the worktree name and branch name from the **initial prompt text**. A generic opening like "find an agy-ready bead and take it to review" produces a generic branch (e.g., `agent-find-an-agy-ready`). A specific imperative naming the bead produces a well-named branch (e.g., `implement-pp-xxxx-fix-email-field`).

This skill's primary job is to ensure the first line of the emitted prompt is always a specific imperative naming the bead.

---

## Step 1 — Resolve the bead

**If Tim gives you a bead ID:** use it directly.

**If no bead ID is given:** run:

```sh
bd query "label=agy-ready AND status=open" --priority-max=2
```

Pick the top result by priority, then by ID (lexicographic tiebreak).

---

## Step 2 — Read the bead

```sh
bd show <id>
```

Read: title, description, acceptance criteria, labels, all comments.

**Verify `agy-ready` is present.** If it is absent, stop and tell Tim:

> "PP-xxx does not have the `agy-ready` label. Run the `pinpoint-agy-triage` skill to evaluate it before dispatching."

**Detect `agy-ui`.** Note whether the `agy-ui` label is present — this controls whether the UI-verification block is included in the emitted prompt.

---

## Step 3 — Emit the copy-paste prompt

Output the following fenced block for Tim to paste into the Antigravity 2.0 agent manager.

**Critical formatting rule:** the very first line must be a specific imperative naming the bead ID and a concise title. The agent manager uses this line to name the worktree and branch. Do not open with "find a bead", "work on an issue", or any generic sentence.

---

**Prompt template (non-UI bead):**

````
```
Implement <id>: <concise title from bead>

Bead: <id> — <full bead title>

Goal: <1–3 sentences in plain language describing what needs to change and why, derived from the bead description. No jargon. Write as if explaining to someone who hasn't read the bead.>

Follow the `pinpoint-agy-execute` skill starting at Step 1 — the bead ID is already specified, so skip the discovery query, but still run the Step 1 label-verification (`agy-ready`) and `agy-ui` detection. Then continue end-to-end (Step 2 claim onward).

Verification command: <exact command from the bead, e.g. `pnpm run check` or `pnpm exec playwright test e2e/foo.spec.ts --project=chromium`>
```
````

---

**Prompt template (UI bead — `agy-ui` label present):**

````
```
Implement <id>: <concise title from bead>

Bead: <id> — <full bead title>

Goal: <1–3 sentences in plain language describing what needs to change and why, derived from the bead description.>

Follow the `pinpoint-agy-execute` skill starting at Step 1 — the bead ID is already specified, so skip the discovery query, but still run the Step 1 label-verification (`agy-ready`) and `agy-ui` detection. Then continue end-to-end (Step 2 claim onward).

Verification command: <exact command from the bead>

UI verification (this is an `agy-ui` bead):

Before opening the PR (after Step 5, before Step 8): start Supabase (`supabase start`) and the dev server (`pnpm dev`) for this worktree. The assigned port is in `.env.local` and `.claude/launch.json`. Use `/browser` to open the app at that port and confirm: <paste acceptance criteria verbatim>.

After addressing Copilot review (after Step 10, before Step 11): re-run `/browser` to confirm the review changes did not break the UI.

Note: `/browser` grants Chrome access only. You must start the stack manually before using it.
```
````

---

After the fenced block, add exactly one line:

> Paste this into the Antigravity 2.0 agent manager to spawn a new agent. The branch name is derived from the first line.

---

## What this skill does NOT do

- Does not create a branch or worktree (the agent manager does that).
- Does not claim the bead or update its status (Antigravity does that at Step 2 of agy-execute).
- Does not modify any files.
- Does not run any tests.

If Tim asks you to also triage the bead first, load the `pinpoint-agy-triage` skill.
