---
trigger: always_on
---

# Antigravity CLI Agent Context

This file provides workspace rules and context exclusive to the Google Antigravity CLI agent.

## Core Mandates

- **Read AGENTS.md**: Immediately read @AGENTS.md before following any user instructions. It contains the critical, non-negotiable guidelines for the PinPoint codebase.

## Executing agy-ready Beads

If Tim asks you to work an `agy-ready` bead — or to "find an agy-ready bead and take it to review" — follow `.agents/skills/pinpoint-agy-execute/SKILL.md` end-to-end. Do not skip steps. The skill covers environment verification, bead claim, implementation, verification, commit, push, PR open, CI watch, Copilot review, ready-for-review labeling, and handoff.

UI beads tagged `agy-ui` require `/browser` verification at Steps 5 and 11 of the execute skill. Start Supabase and the dev server first — `/browser` grants Chrome access only, it does not start the stack.
