---
trigger: always_on
---

# Antigravity CLI Agent Context

This file provides workspace rules and context exclusive to the Google Antigravity CLI agent.

Antigravity is Google's CLI agent harness (currently Gemini-based) with full local environment access. In this project its role is **code review** — a second opinion alongside the primary Codex review Tim runs. The earlier autonomous bead-dispatch surface was retired (PP-22e4, #1761); Antigravity no longer picks up and executes beads independently.

## Core Mandates

- **Read AGENTS.md**: Immediately read @AGENTS.md before following any user instructions. It carries the process rules, environment, and workflow. The implementation non-negotiables are **not** in it — `docs/NON_NEGOTIABLES.md` is the catalog, and §2.1 is now only a pointer to it (PP-22e4.4 moved the per-rule summaries into `.claude/rules/`, which only Claude Code loads). Read the catalog directly.
- **Read the review brief**: @REVIEW.md is the canonical code-review rubric, shared with Claude Code — read it before reviewing any PR.
- **You review when Tim asks — never on your own.** Nothing on this repo reviews on PR-open or on push; the bot reviewer that used to was retired on 2026-08-02 (PP-4ric).
- **Your review does not satisfy the merge gate.** `merge-pr.sh`'s `reviewed` gate requires the SHA-pinned `mark-review.sh` record of a completed `/codex:review --base main` (or the narrow trivial-change exception). Post your findings as review comments; don't treat having reviewed as clearing the gate. Note that unresolved review threads DO block the merge now, whoever opened them — so resolve or get resolution on what you raise.
