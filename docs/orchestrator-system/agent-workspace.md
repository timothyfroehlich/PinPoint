# Agent Workspace Documentation

## Overview

The agent workspace is a standardized directory structure for organizing task files and agent-specific resources in worktrees.

## Directory Structure

```
worktree-root/
├── agent_workspace/          # Agent task files and resources
│   ├── SUBAGENT_TASK.md     # Main task file (created by worktree script)
│   ├── test-agent-task.md   # Test agent specific instructions
│   ├── implementation-agent-task.md  # Implementation agent instructions
│   └── review-agent-task.md # Review agent instructions
└── ... (other project files)
```

## Task File Locations

### Automatic Creation

When creating a new worktree using `./scripts/create-and-setup-worktree.sh`:

- Creates `agent_workspace/` directory
- Generates `agent_workspace/SUBAGENT_TASK.md` template

### Agent-Specific Task Files

Orchestrator creates specialized task files for TDD workflow:

1. `test-agent-task.md` - For test creation agent
2. `implementation-agent-task.md` - For implementation agent
3. `review-agent-task.md` - For code review agent

## Usage by Agents

Agents should look for their task files in:

```
/path/to/worktree/agent_workspace/<agent-type>-agent-task.md
```

Example:

```bash
# Test agent reads:
cat agent_workspace/test-agent-task.md

# Implementation agent reads:
cat agent_workspace/implementation-agent-task.md
```

## Benefits

1. **Visibility**: Task files are easily accessible (not hidden in .claude)
2. **Organization**: Clear separation of agent instructions
3. **Flexibility**: Can add additional agent resources as needed
4. **Consistency**: Standard location across all worktrees

## Scripts Updated

The following scripts have been updated to use `agent_workspace`:

- `scripts/create-and-setup-worktree.sh` - Creates directory and template
- `scripts/list-worktrees.sh` - Checks for task file existence

## Migration

For existing worktrees with task files in `.claude/`:

```bash
# Move existing task files
mkdir -p agent_workspace
mv .claude/*-agent-task.md agent_workspace/
```
