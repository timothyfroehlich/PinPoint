# Agent Task File Documentation

## Overview

PinPoint uses a standardized single task file approach for all orchestrator workflows.

## Standardized Task File

### Location

- **File**: `AGENT_TASK.md` in worktree root directory
- **Created by**: All orchestrator variants (`orchestrator-feature`, `orchestrator-bugfix`, `orchestrator-checkout`)
- **Lifecycle**: Checked into feature branches, auto-cleaned from main after merge

### File Structure

```
worktree-root/
├── AGENT_TASK.md           # Single standardized task file
├── src/                    # Project source code
├── docs/                   # Project documentation
└── ... (other project files)
```

## Task File Content

### Standard Template

```markdown
# Task: <Task Name>

## Mission Statement

[Clear description of what needs to be accomplished]

## Context

[Background information, constraints, and architectural context]

## Implementation Steps

[Detailed step-by-step instructions for the agent]

## Quality Requirements

- All tests must pass: `npm run test`
- TypeScript must compile: `npm run typecheck`
- Pre-commit hooks must pass: `npm run validate`
- Code must follow project conventions

## Success Criteria

[Specific criteria that define task completion]

## Completion Instructions

When your task is complete:

1. Ensure all quality requirements are met
2. Commit your changes with descriptive messages
3. Notify the orchestrator - DO NOT clean up the worktree yourself
4. The orchestrator will handle worktree cleanup after confirmation
```

## Orchestrator-Specific Variations

### Feature Development (`orchestrator-feature`)

- Collaborative design phase documented
- Complete implementation specifications
- Handoff instructions for specialized agents

### Bug Fixing (`orchestrator-bugfix`)

- Bug reproduction steps
- Root cause analysis
- Autonomous fix implementation plan
- Comprehensive testing requirements

### Environment Setup (`orchestrator-checkout`)

- Source PR/branch information
- Environment setup verification
- Current state assessment
- Ready-for-agent-work confirmation

## Scripts Integration

### Worktree Creation

`scripts/create-and-setup-worktree.sh`:

- Creates `AGENT_TASK.md` template in worktree root
- No subdirectories needed

### Worktree Management

`scripts/list-worktrees.sh`:

- Checks for `AGENT_TASK.md` in worktree root
- Reports task file status for each worktree

## Lifecycle Management

1. **Creation**: Orchestrator creates task file during worktree setup
2. **Development**: Task file is committed to feature branch
3. **Completion**: Task file travels with branch through PR process
4. **Cleanup**: GitHub Actions automatically removes from main after merge

## Benefits

1. **Simplicity**: Single file per worktree, no directory structure needed
2. **Visibility**: Task file visible at root level, easy to find
3. **Standardization**: Consistent format across all orchestrator types
4. **Clean Main**: Automatic cleanup ensures main branch stays clean
5. **Version Control**: Task context preserved in branch history
