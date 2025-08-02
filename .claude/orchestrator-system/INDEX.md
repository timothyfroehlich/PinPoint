# Claude Development System

Complete Claude agent development workflow, orchestration patterns, and infrastructure.

## Organization

All Claude development files are now consolidated in `./.claude/` within the project for complete self-containment.

## Status

- **Orchestrator System**: Mature multi-agent workflow using GitHub issues
- **Worktree Management**: Unified Python-based infrastructure
- **Command Integration**: All orchestrator commands updated for new tools
- **Migration**: Moved from `docs/orchestrator-system/` to `./.claude/orchestrator-system/`

## Directory Structure

```
PROJECT/.claude/
├── commands/                  # Orchestrator command definitions
├── orchestrator-system/       # Multi-agent workflow docs (this directory)
└── worktrees/                 # Unified worktree management
    ├── manage-worktree.py     # Single tool replacing 5 bash scripts
    └── docs/                  # Worktree system documentation
```

## Core Systems

### Orchestrator Commands (`.claude/commands/`)

- **orchestrator-bugfix.md** - Autonomous bug fixing workflow
- **orchestrator-feature.md** - Collaborative feature development
- **orchestrator-checkout.md** - Environment setup for existing branches
- **orchestrator-cleanup.md** - Intelligent worktree cleanup

### Worktree Management (`.claude/worktrees/`)

- **manage-worktree.py** - Unified tool for all worktree operations
- **create** - Full environment setup with unique ports
- **status** - Comprehensive environment health checks
- **list** - All worktrees with status and recommendations
- **cleanup** - Safe environment teardown

### Multi-Agent Documentation

- **[orchestrator-project.md](./orchestrator-project.md)** - Central coordination system
- **[multi-agent-development-workflow.md](./multi-agent-development-workflow.md)** - Parallel development patterns
- **[agent-workspace.md](./agent-workspace.md)** - Isolated worktree environments
- **[ORCHESTRATOR_SYSTEM_PROMPT.md](./ORCHESTRATOR_SYSTEM_PROMPT.md)** - Core directives
- **Agent Projects** - Implementation, review, and test agent specifications

## Recent Updates

### Unified Worktree Infrastructure

- **Single Tool**: Python-based `manage-worktree.py` replaces 5 bash scripts
- **Clean Git Status**: Proper gitignore patterns prevent outstanding changes
- **Smart Configuration**: Copy base configs and modify (no template maintenance)
- **Orchestrator Integration**: All workflows updated to use new tool paths

### File Organization

- **Clean Separation**: Claude dev files separated from generic project files
- **Consolidated Commands**: All orchestrator operations in one place
- **Updated References**: All documentation and scripts updated

## Legacy Migration

- **Old Location**: `docs/orchestrator-system/` → `./.claude/orchestrator-system/`
- **Old Scripts**: `scripts/*worktree*` → `.claude/worktrees/manage-worktree.py`
- **Backward Compatibility**: Legacy scripts remain during transition
- **Natural Aging**: Old worktrees will be replaced as tasks complete
