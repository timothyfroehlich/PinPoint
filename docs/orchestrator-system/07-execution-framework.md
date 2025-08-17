# Task-Based Execution Framework

## Philosophy: Natural Flow Development

This framework enables sustainable development through natural work sessions and energy management. Focus on completing logical units of work rather than artificial time constraints.

## Work Session Management

### Session Startup Procedures

**Pre-work Environment Validation:**

```bash
# Validate development environment
npm run validate-env
git status
git log --oneline -5

# Sync with latest changes
git fetch origin
git status -uno

# Quick health check
npm run typecheck --quiet
```

**Focus State Preparation:**

1. **Clear workspace state** - commit or stash any pending work
2. **Identify session goal** - specific task or feature to complete
3. **Gather context** - relevant documentation, previous decisions
4. **Set boundaries** - scope for this session to maintain focus

### Task Initiation Workflow

**Branch and Environment Setup:**

```bash
# Create focused branch for task
git checkout -b task/$(basename "$PWD")-$(date +%s)

# Verify clean state
git status
npm run validate

# Document session goal
echo "Session Goal: [specific objective]" >> .session-notes.md
```

**Context Loading:**

```bash
# Load relevant documentation
code docs/quick-reference/
code docs/migration/

# Open related files based on task type
case "$TASK_TYPE" in
  "router-conversion")
    code src/server/api/routers/
    ;;
  "service-migration")
    code src/server/services/
    ;;
  "test-updates")
    code src/**/*.test.ts
    ;;
esac
```

## Natural Checkpoint Creation

### Continuous Quality Gates

**After Each Logical Change:**

```bash
# Immediate feedback loop
npm run validate-file "$CURRENT_FILE"
npm run typecheck

# If working on tests
npm run test "$TEST_PATTERN" --run
```

**Checkpoint Validation:**

```bash
# Full system validation
npm run validate

# Integration test validation (when applicable)
npm run test:integration

# Manual smoke test
npm run dev &
curl -f http://localhost:3000/health || echo "Health check failed"
pkill -f "npm run dev"
```

### Incremental Progress Commits

**Commit Strategy:**

```bash
# Stage specific changes
git add -p  # Interactive staging for precision

# Commit with context
git commit -m "$(cat <<EOF
[component]: [specific change]

- Concrete change description
- Impact on system behavior
- Any breaking changes noted

Part of: [overall task goal]
EOF
)"
```

**Progress Documentation:**

```bash
# Update session notes
echo "✓ [timestamp]: [accomplishment]" >> .session-notes.md
echo "⚠ [timestamp]: [issue encountered]" >> .session-notes.md
echo "📝 [timestamp]: [decision made]" >> .session-notes.md
```

## Energy State Management

### High Energy Focus Sessions

**Optimal for:**

- Complex router conversions
- Architecture decisions
- New feature implementation
- Critical bug resolution

**Session Structure:**

1. **Deep focus period** - single task, minimal context switching
2. **Implementation sprint** - write/convert/test cycle
3. **Validation checkpoint** - verify quality gates pass
4. **Progress commit** - document accomplishment

### Medium Energy Maintenance Sessions

**Optimal for:**

- Test updates and mock conversions
- Documentation improvements
- Code cleanup and refactoring
- Dependency management

**Session Structure:**

1. **Task selection** - choose manageable scope
2. **Iterative improvement** - small, verifiable changes
3. **Continuous validation** - frequent quality checks
4. **Incremental commits** - regular progress saves

### Low Energy Exploration Sessions

**Optimal for:**

- Research and documentation reading
- Planning and task decomposition
- Code review and analysis
- Environment setup and tooling

**Session Structure:**

1. **Information gathering** - read, analyze, understand
2. **Note taking** - capture insights and decisions
3. **Planning** - organize future work sessions
4. **Light maintenance** - simple, low-risk improvements

## Task Completion Validation

### Functional Verification

**Core Functionality Tests:**

```bash
# Application-level validation
npm run validate

# Feature-specific validation
npm run test:feature "$FEATURE_NAME"

# End-to-end smoke test
npm run test:e2e:smoke
```

**Manual Flow Verification:**

1. **Authentication flows** - login, session management
2. **Core user journeys** - primary application workflows
3. **Data integrity** - database operations work correctly
4. **Error handling** - graceful failure modes

### Integration Readiness Check

**Pre-merge Validation:**

```bash
# Sync with latest changes
git fetch origin
git rebase origin/main

# Full validation suite
npm run validate
npm run test

# Build verification
npm run build

# Security and type safety
npm run audit
npm run typecheck --strict
```

**Quality Standards:**

- All TypeScript compilation passes
- Test suite passes completely
- No linting or formatting issues
- Manual verification of key flows
- Documentation updated if needed

## Work Session Completion

### Session Wrap-up Procedures

**Code State Management:**

```bash
# Ensure clean commit state
git status
git diff --name-only

# Final validation
npm run validate

# Push progress if ready
git push origin HEAD
```

**Knowledge Capture:**

```bash
# Session summary
cat >> .session-notes.md <<EOF

## Session Summary
**Goal:** [original session goal]
**Accomplished:** [what was completed]
**Blocked on:** [any obstacles encountered]
**Next steps:** [clear actions for future sessions]
**Insights:** [learnings or decisions made]
EOF
```

**Environment Cleanup:**

```bash
# Stop running processes
pkill -f "npm run dev"
pkill -f "vitest"

# Clean temporary files
npm run clean

# Organize workspace
git stash push -u -m "WIP: session end cleanup"
```

### Progress Transition Management

**Between Related Sessions:**

1. **Context handoff** - clear notes for continuation
2. **Dependency marking** - identify blockers for next session
3. **Scope adjustment** - refine goals based on progress
4. **Energy planning** - match next session type to remaining work

**Between Different Work Areas:**

1. **Context switching prep** - save current mental model
2. **Clean workspace** - remove irrelevant files/tabs
3. **Fresh environment** - reset for new problem domain
4. **Goal recalibration** - align expectations with energy state

## Rollback and Recovery Procedures

### Quick Recovery Patterns

**When Build Breaks:**

```bash
# Immediate rollback
git reset --hard HEAD~1

# Validate recovery
npm run validate

# Analyze failure
git show HEAD@{1} --name-only
```

**When Tests Fail:**

```bash
# Isolate the issue
npm run test:verbose -- --reporter=verbose

# Targeted debugging
npm run test:debug "$FAILING_TEST"

# Rollback if needed
git checkout HEAD~1 -- "$PROBLEMATIC_FILE"
```

### Session Recovery Strategies

**When Stuck or Blocked:**

1. **Step back** - commit current progress, even if incomplete
2. **Context switch** - work on different task type
3. **Research mode** - gather information rather than implement
4. **Break down scope** - identify smaller, achievable goals

**When Energy is Low:**

1. **Maintenance tasks** - low-cognitive-load improvements
2. **Documentation** - organize knowledge and insights
3. **Environment cleanup** - organize workspace and tools
4. **Planning** - prepare for higher-energy sessions

## Dependency Gate Management

### Cross-Task Dependencies

**Before Starting Dependent Task:**

```bash
# Verify prerequisites completed
git log --oneline --grep="$PREREQUISITE_TASK"

# Check for required changes
git diff origin/main --name-only | grep -E "(schema|types|interfaces)"

# Validate dependency state
npm run validate
```

**Coordination Points:**

- Schema changes require explicit handoff
- Shared service modifications need validation
- Infrastructure changes require system-wide testing
- Authentication changes require integration testing

### Quality Dependencies

**Never Compromise Standards:**

- TypeScript compilation must pass
- Test suite must pass completely
- Security patterns must be maintained
- Performance regressions must be addressed

**Escalation Triggers:**

- Quality gates consistently failing
- Architectural decisions needed
- Breaking changes from external dependencies
- Complex conflicts requiring design decisions

## Success Metrics

### Session-Level Success

- **Goal Achievement**: Completed intended logical unit of work
- **Quality Maintenance**: All validation gates pass
- **Progress Documentation**: Clear notes for future sessions
- **Clean State**: Ready for next session or different work area

### Task-Level Success

- **Functional Completeness**: Feature works as intended
- **Integration Readiness**: Passes all quality gates
- **Documentation Currency**: Updates reflect changes made
- **Knowledge Transfer**: Clear handoff or completion notes

### Project-Level Success

- **Velocity Sustainability**: Consistent progress without burnout
- **Quality Consistency**: Maintainable code quality standards
- **Knowledge Retention**: Decisions and insights captured
- **Adaptability**: Framework supports changing project needs

This framework prioritizes sustainable development through natural work patterns while maintaining high quality standards and clear progress tracking.
