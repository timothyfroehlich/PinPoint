# Agent Task Dispatcher

## Your Task Location

This file routes you to your specific task instructions. **Do not modify this file** - it's designed to work across all worktrees without conflicts.

## Task File Discovery Protocol

### 1. Check Your Agent Type
Look for task files matching these patterns in the `agent_workspace/` directory:

- **Implementation Agent** → `implement-*-task.md`
- **Test Agent** → `test-*-task.md` 
- **Fix Agent** → `fix-*-task.md`
- **Review Agent** → `review-*-task.md`
- **Refactor Agent** → `refactor-*-task.md`
- **Feature Agent** → `feature-*-task.md`

### 2. Fallback for Simple Tasks
If no specific agent type or no matching file found:
- Look for `simple-task.md` (created by orchestrator for ad-hoc work)

### 3. Task File Priority
1. **First**: Look for files matching your agent type pattern
2. **Second**: If multiple matches, choose the most specific/recent
3. **Third**: Fall back to `simple-task.md` if no type-specific file exists

## Instructions

1. **List available task files**: Check what's in `agent_workspace/`
2. **Find your task**: Use the pattern matching above
3. **Read completely**: Follow ALL instructions in your specific task file
4. **Quality standards**: Maintain project's zero-tolerance quality requirements

## Example Task File Discovery

```bash
# In agent_workspace/, you might find:
implement-zod-prisma-integration-task.md  ← Implementation Agent uses this
test-user-authentication-task.md          ← Test Agent uses this  
fix-typescript-errors-task.md             ← Fix Agent uses this
simple-task.md                            ← Fallback for any agent
```

## Success Criteria

- ✅ Find and read your specific task file completely
- ✅ Follow all implementation steps and quality requirements
- ✅ Complete all testing and validation steps
- ✅ Notify orchestrator when complete (do not clean up worktree)

---

**Note**: This dispatcher eliminates merge conflicts by never changing across worktrees. The orchestrator ensures appropriate task files exist before agent dispatch.