# Multi-Agent TDD Workflow Guide

## Overview

This guide describes the Test-Driven Development workflow for coordinated multi-agent development using git worktrees.

## Agent Roles

1. **Orchestrator**: Analyzes requests, creates environments, coordinates workflow
2. **Test Agent**: Creates comprehensive tests covering Critical User Journeys (CUJs)
3. **Implementation Agent**: Implements features to satisfy tests
4. **Review Agent**: Reviews code quality and manages PR merge process

## Workflow Sequence

```
User Request → Orchestrator → Test Agent → Implementation Agent → Review Agent → Merge
```

## Environment Management

- **Worktrees**: Isolated development environments per task
- **Shared Database**: Agents share database but scope by project requirements
- **Branch Strategy**: Feature branches from main development branch

## Quality Gates

- All tests must pass
- Code quality standards must be met
- Pre-commit hooks must pass
- CI/CD pipeline must succeed

## Task Coordination

1. **Dependencies**: Check task dependencies before starting
2. **Conflicts**: Resolve schema/code conflicts between parallel work
3. **Sync**: Keep environments updated with main branch
4. **Documentation**: Update architecture maps and close relevant issues

## Success Criteria

- Features implemented according to test specifications
- No regressions in existing functionality
- Quality standards maintained
- Documentation updated to reflect changes
