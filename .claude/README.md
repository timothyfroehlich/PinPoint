# PinPoint Claude Development Tools

All Claude agent development tools and orchestration infrastructure for the PinPoint project.

## Consolidated Structure

This directory contains ALL Claude development tools, consolidated from the global `~/.claude/` directory for complete project self-containment.

```
.claude/
├── commands/                  # Slash commands for Claude Code
│   ├── orchestrator-bugfix.md
│   ├── orchestrator-checkout.md
│   ├── orchestrator-cleanup.md
│   ├── orchestrator-feature.md
│   ├── ship-it.md
│   └── smart-rebase.md
├── orchestrator-system/       # Multi-agent workflow documentation
│   ├── INDEX.md               # Complete system overview
│   ├── ORCHESTRATOR_SYSTEM_PROMPT.md
│   └── (workflow and agent docs)
├── worktrees/                 # Unified worktree management
│   ├── manage-worktree.py     # Single tool replacing 5 bash scripts
│   └── docs/                  # Worktree system documentation
├── agents/                    # Specialized agent definitions
├── hooks/                     # Git hooks and validation
└── settings.json              # Claude Code configuration
```

## Quick Start

### Worktree Management

```bash
# Create new worktree with full Supabase setup
./.claude/worktrees/manage-worktree.py create fix-auth-bug

# Check environment health
./.claude/worktrees/manage-worktree.py status fix-auth-bug

# List all worktrees with recommendations
./.claude/worktrees/manage-worktree.py list

# Clean up when done
./.claude/worktrees/manage-worktree.py cleanup fix-auth-bug
```

### Orchestrator Commands

Use Claude Code slash commands:

- `/orchestrator-bugfix` - Autonomous bug fixing workflow
- `/orchestrator-feature` - Collaborative feature development
- `/orchestrator-checkout` - Setup existing branches/PRs
- `/orchestrator-cleanup` - Intelligent environment cleanup
- `/ship-it` - Automated shipping of safe meta changes

## Integration with Project

### CLAUDE.md References

The main project `CLAUDE.md` references these tools:

- Worktree commands use `./.claude/worktrees/manage-worktree.py`
- Documentation references use `@.claude/orchestrator-system/`

### package.json Integration

```json
{
  "scripts": {
    "setup:worktree": "python3 ./.claude/worktrees/manage-worktree.py create"
  }
}
```

### Git Integration

- `.gitignore` patterns prevent worktree-specific files from being committed
- All `.claude/` contents are checked into the repository
- Team members get complete orchestrator infrastructure when cloning

## Benefits of Consolidation

### ✅ Project Self-Containment

- **Complete toolkit**: Everything needed for Claude development with PinPoint
- **Version controlled**: All orchestrator evolution tracked with project
- **Team consistency**: Everyone gets identical Claude development environment
- **No global dependencies**: Project works without global Claude setup

### ✅ PinPoint-Specific Customization

- **Supabase integration**: Worktree tools understand PinPoint's Supabase setup
- **Port management**: Smart unique port assignment for parallel development
- **Database awareness**: Shared development database configuration
- **Project patterns**: Orchestrator commands understand PinPoint architecture

### ✅ Simplified Maintenance

- **Single source**: All Claude tools in one place
- **Clear ownership**: Project-specific tools stay with project
- **Easy updates**: Changes to orchestrator workflows tracked in project history
- **Documentation co-location**: Workflow docs next to the tools they describe

## Migration History

- **Previously**: Split between global `~/.claude/` and project `docs/orchestrator-system/`
- **Now**: Fully consolidated in project `./.claude/` directory
- **Benefits**: Self-contained, version-controlled, team-consistent Claude development environment

See `orchestrator-system/INDEX.md` for detailed multi-agent workflow documentation.
