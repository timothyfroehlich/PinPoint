# Claude Agent Experiment Results

## Problem We Were Investigating

Our test-architect agent was consistently ignoring detailed logging requirements in its `.claude/agents/test-architect.md` configuration file, despite doing excellent technical work.

## Experiment Design

To test both **CLAUDE.md inheritance** and **logging compliance**, we:

1. **Modified CLAUDE.md** to require "generous amounts of emojis" in all markdown files
2. **Created a custom agent** (`readme-evaluator`) with detailed logging protocols
3. **Tested both approaches** using different agent types

## What We Tried

### Attempt 1: Custom Agent

- Created `.claude/agents/readme-evaluator.md` with detailed logging instructions
- **Result**: Agent not recognized by Claude Code system
- **Discovery**: Only pre-defined agent types work (`general-purpose`, `researcher`, `test-architect`, etc.)

### Attempt 2: General-Purpose Agent with Explicit Instructions

- Used `general-purpose` agent with detailed Task prompt including:
  - Explicit logging requirements in the prompt
  - Reference to the CLAUDE.md emoji requirement
  - Clear deliverables (evaluation file + log file)

## Key Findings

### ✅ **CLAUDE.md Inheritance: CONFIRMED**

- **Evidence**: Agent detected and applied emoji requirement from CLAUDE.md
- **Result**: Created evaluation with 50+ emojis, explicitly citing "CLAUDE.md experimental requirements"
- **Conclusion**: Subagents DO inherit CLAUDE.md context

### ✅ **Logging Success When Explicit in Task Prompt**

- **Evidence**: Perfect 50-line timestamped log file created
- **Result**: Every file read, decision, and action documented
- **Conclusion**: Agents reliably follow explicit Task prompt requirements

### ❌ **Custom Agent Limitations**

- Custom `.claude/agents/*.md` files aren't automatically recognized
- Only pre-defined agent types are available in the system

## Root Cause Analysis

**Why test-architect logging failed:**

- The agent received logging instructions through its `.md` file configuration
- But agents more reliably follow **explicit Task prompt requirements** than internal configuration protocols
- The logging requirements were "suggestions" in the agent config, not "commands" in the Task call

## Solution Identified

Instead of relying on internal agent protocols, include logging requirements directly in each Task prompt:

```
Task prompt: "Transform fragile assertions AND create detailed log at .claude/sub-agent-logs/..."
```

## Confidence Level

**High confidence** - The experiment provided clear, verifiable evidence for both CLAUDE.md inheritance and the effectiveness of explicit Task prompt requirements vs. internal agent configuration protocols.
