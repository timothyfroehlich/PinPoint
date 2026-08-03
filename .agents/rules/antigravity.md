---
trigger: always_on
---

# Antigravity CLI Agent Context

This file provides workspace rules and context exclusive to the Google Antigravity CLI agent.

Antigravity is Google's CLI agent harness (currently Gemini-based) with full local environment access. In this project its role is **code review** — a second opinion alongside Tim's `/code-review` pass. The earlier autonomous bead-dispatch surface was retired (PP-22e4, #1761); Antigravity no longer picks up and executes beads independently.

## Core Mandates

- **Read AGENTS.md**: Immediately read @AGENTS.md before following any user instructions. It contains the critical, non-negotiable guidelines for the PinPoint codebase.
- **Read the review brief**: @REVIEW.md is the canonical code-review rubric, shared with Claude Code — read it before reviewing any PR.
- **You review when Tim asks — never on your own.** Nothing on this repo reviews on PR-open or on push; the bot reviewer that used to was retired on 2026-08-02 (PP-4ric).
- **Post your findings as inline review comments on the PR, and understand what that now does.** Since PP-97tt `merge-pr.sh`'s `reviewed` gate accepts top-level review comments pinned to the head commit, alongside the SHA-pinned marker `mark-claude-review.sh` posts. The gate cannot tell your comments from Tim's — GitHub only records the account, and agents act under his. So a review you post **does** clear the gate, and that is an honour system, not a check: post comments because you actually read the diff at that commit, never to move a gate. Reviewing without finding anything leaves no evidence; say so to the author rather than posting a marker yourself.
- **Unresolved review threads block the merge, whoever opened them** — so resolve or get resolution on what you raise. Replies do not re-attest anything: they're written at whatever head is current, so the gate deliberately ignores them.
