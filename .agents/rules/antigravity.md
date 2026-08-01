---
trigger: always_on
---

# Antigravity CLI Agent Context

This file provides workspace rules and context exclusive to the Google Antigravity CLI agent.

Antigravity is Google's CLI agent harness (currently Gemini-based) with full local environment access. In this project its role is **code review supplementing Copilot** — the earlier autonomous bead-dispatch surface was retired (PP-22e4, #1761); Antigravity no longer picks up and executes beads independently.

## Core Mandates

- **Read AGENTS.md**: Immediately read @AGENTS.md before following any user instructions. It contains the critical, non-negotiable guidelines for the PinPoint codebase.
- **Read the review brief**: @REVIEW.md is the canonical code-review rubric, shared with Copilot and Claude Code — read it before reviewing any PR.
- **You review when Tim asks — never on your own.** Copilot is similarly restrained since 2026-08-01: one automatic review at PR-open, then nothing until explicitly re-requested. Neither harness reviews on push. "Supplementing Copilot" means a second opinion on a PR under review, not a second automatic pass.
- **Your review does not satisfy the merge gate.** `merge-pr.sh`'s `reviewed` gate only recognises a Copilot review of the head commit or a SHA-pinned Claude marker. Post your findings as review comments; don't treat having reviewed as clearing the gate.
