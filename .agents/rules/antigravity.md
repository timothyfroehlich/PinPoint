---
trigger: always_on
---

# Antigravity CLI Agent Context

This file provides workspace rules and context exclusive to the Google Antigravity CLI agent.

Antigravity is Google's CLI agent harness (currently Gemini-based) with full local environment access. In this project its role is **code review** — a second opinion alongside Tim's `/code-review` pass. The earlier autonomous bead-dispatch surface was retired (PP-22e4, #1761); Antigravity no longer picks up and executes beads independently.

## Core Mandates

- **Read AGENTS.md**: Immediately read @AGENTS.md before following any user instructions. It contains the critical, non-negotiable guidelines for the PinPoint codebase.
- **Read the review brief**: @REVIEW.md is the canonical code-review rubric, shared with Claude Code — read it before reviewing any PR.
- **You review when asked — never on your own.** Nothing on this repo reviews on PR-open or on push; the bot reviewer that used to was retired on 2026-08-02 (PP-4ric).
- **Your review DOES satisfy the merge gate — when it goes through `agy_review.py`.** Since PP-c6xz the `reviewed` gate accepts either SHA-pinned marker: `<!-- pinpoint-claude-review: -->` (Tim's `/code-review`) or `<!-- pinpoint-agy-review: -->` (yours). The second is written only by `scripts/workflow/agy_review.py`, and only after it has verified you actually read the diff you were given.

  **A review you post by hand does not clear anything.** Nothing outside that script writes the agy marker, and you must not post one yourself — the marker's whole value is that it is downstream of a check you cannot perform on your own behalf.

- **Unresolved review threads block the merge, whoever opened them.** So resolve or get resolution on what you raise.
