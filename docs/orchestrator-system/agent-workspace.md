# GitHub Issues for Agent Task Management

## Overview

PinPoint uses GitHub issues for all orchestrator task coordination and agent dispatch.

## GitHub Issues Approach

### Issue Creation

- **Created by**: All orchestrator variants (`orchestrator-feature`, `orchestrator-bugfix`, `orchestrator-checkout`)
- **Repository**: Issues created in the main PinPoint repository
- **Labels**: Consistent labeling for categorization and tracking

### Issue Structure

```
Repository Issues:
├── #123 (orchestrator-task, feature) - Feature implementation task
├── #124 (orchestrator-task, bug, fixed) - Bug fix task
├── #125 (orchestrator-checkout, environment-setup) - Environment setup
└── ... (other project issues)
```

## Issue Content

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
3. Create PR and link it to this issue
4. Update issue status and close when PR is merged
```

## Orchestrator-Specific Variations

### Feature Development (`orchestrator-feature`)

- **Labels**: `orchestrator-task`, `feature`
- Collaborative design phase documented
- Complete implementation specifications
- Agent dispatch instructions

### Bug Fixing (`orchestrator-bugfix`)

- **Labels**: `orchestrator-task`, `bug`, `fixed`
- Bug reproduction steps
- Root cause analysis
- Autonomous fix implementation plan
- Comprehensive testing requirements

### Environment Setup (`orchestrator-checkout`)

- **Labels**: `orchestrator-checkout`, `environment-setup`
- Source PR/branch information
- Environment setup verification
- Current state assessment
- Ready-for-agent-work confirmation

## Agent Dispatch Protocol

### Issue-Based Dispatch

1. **Orchestrator creates issue**: Comprehensive task specification
2. **Issue number provided**: "Your task is issue #X"
3. **Agent references issue**: Direct GitHub integration
4. **Progress tracking**: Built-in GitHub issue features

### GitHub Integration Benefits

1. **Visibility**: Issues are visible to all project participants
2. **Tracking**: Built-in progress tracking and status updates
3. **Linking**: Easy linking between issues, PRs, and commits
4. **History**: Permanent record of task context and decisions
5. **Collaboration**: Comments and updates from multiple participants

## Lifecycle Management

1. **Creation**: Orchestrator creates GitHub issue during task setup
2. **Assignment**: Agent receives issue number for task work
3. **Development**: Agent updates issue status and links PR
4. **Completion**: Issue closed when PR is merged
5. **Tracking**: Issue remains for historical reference

## Label Organization

### Core Labels

- `orchestrator-task` - Tasks created by orchestrator system
- `orchestrator-checkout` - Environment setup tasks
- `feature` - Feature development work
- `bug` - Bug fix work
- `fixed` - Bug has been resolved
- `environment-setup` - Environment configuration tasks

### Benefits

1. **Integration**: Native GitHub workflow integration
2. **Visibility**: Clear task tracking across the project
3. **Collaboration**: Multiple participants can comment and update
4. **Persistence**: Issues provide permanent task history
5. **Automation**: Easy integration with GitHub Actions and workflows
