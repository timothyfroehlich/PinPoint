# Wave 0: Baseline & Guard Rails - Task Coordination Index

**Status**: READY FOR PARALLEL EXECUTION  
**Target Duration**: 1-2 days  
**Last Updated**: 2025-01-04  

## Mission Overview

Create an immutable baseline and enforcement infrastructure before high-volume authentication migrations begin. Four specialized agents working in parallel to establish inventories, enhanced ESLint rules, codemod harness, and performance metrics baselines.

## Lane Assignments

| Lane | Focus Area | Agent | Primary Deliverables | Dependencies |
|------|------------|--------|---------------------|--------------|
| **A** | [Inventory & Snapshots](./lane-a-inventory-snapshots.md) | Inventory Specialist | 4 JSON baselines (auth functions, fetchers, role conditionals, org-scoped functions) | None - Can start immediately |
| **B** | [Enforcement (ESLint/CI)](./lane-b-enforcement-eslint-ci.md) | ESLint Specialist | 4+ custom rules, enhanced config, CI integration | Lane A output for function targeting |
| **C** | [Codemod Harness](./lane-c-codemod-harness.md) | Transformation Specialist | Robust runner, dry-run system, rollback mechanisms, AST utilities | None - Infrastructure focused |
| **D** | [Metrics Baseline](./lane-d-metrics-baseline.md) | Performance Specialist | Enhanced instrumentation, baseline measurements, monitoring alerts | None - Can start immediately |

## Coordination Points

### Data Flow Dependencies
```
Lane A (Inventory) → Lane B (ESLint Rules)
  ↓ Function lists      ↓ Rule targeting
  
Lane C (Codemod) ← Lane D (Metrics)
  ↓ Infrastructure    ↓ Baseline data
```

### Shared Resources
- **Development Server**: All lanes need `npm run dev` running
- **Git Repository**: Clean working directory required for safety
- **TypeScript Compilation**: All changes must pass `npm run typecheck`
- **ESLint Baseline**: Current lint status must be clean before enhancement

### Communication Protocol
1. **Daily Standup**: Progress check, blocker resolution, data sharing
2. **Lane A → Lane B**: Share function inventory as soon as generated
3. **Lane C → All**: Notify before any test transformations that might affect other work
4. **Lane D → All**: Share performance issues that might indicate problems in other lanes

## Shared Technical Context

### Current Authentication Architecture
**Canonical Pattern (Target)**:
```typescript
// NEW - Target pattern for all migrations
import { getRequestAuthContext } from '~/server/auth/context';

const ctx = await getRequestAuthContext();
if (ctx.kind === 'authorized') {
  const { user, org, membership } = ctx;
  // ... logic
}
```

**Legacy Patterns (Migration Sources)**:
```typescript
// OLD - High usage, needs migration
const { user, organization, membership } = await requireMemberAccess();

// OLD - Context without throwing
const ctx = await getOrganizationContext();

// OLD - DAL-specific pattern  
return ensureOrgContextAndBindRLS(async (tx, context) => {
  // ... database operations
});
```

### Key File Locations
- **Actions**: `src/lib/actions/*.ts` (12 files, heavy auth usage)
- **DAL**: `src/lib/dal/*.ts` (15 files, org-scoped functions)
- **Components**: `src/app/**/page.tsx` (25+ server components)
- **Auth Infrastructure**: `src/server/auth/context.ts`, `src/lib/organization-context.ts`

### Performance Targets (Wave 0 Goals)
- **`auth_resolutions_per_request = 1.0`** (currently ~2.3)
- **Duplicate query detection = 0** (currently ~12 per 100 requests)
- **Cache hit rate > 80%** (currently ~45-70%)

## Quality Gates & Validation

### Individual Lane Success Criteria
- **Lane A**: 4 complete JSON inventories with non-zero counts
- **Lane B**: 4+ new ESLint rules active with zero false positives on current code
- **Lane C**: Codemod harness can execute existing DAL transformation safely
- **Lane D**: Enhanced metrics system capturing baseline data from core routes

### Collective Wave 0 Exit Criteria
✅ **All baseline JSON files present** in `docs/baseline/`  
✅ **ESLint rules active** and catching forbidden patterns  
✅ **Codemod harness operational** with dry-run and rollback capability  
✅ **Metrics baseline captured** with performance analysis complete  
✅ **No regressions introduced** - all existing tests and lints pass  
✅ **Documentation updated** - methodology and assumptions documented  

### Integration Testing
```bash
# Cross-lane validation script
npm run wave0:validate-integration

# Should verify:
# - Lane A inventories match Lane D runtime metrics
# - Lane B rules target functions from Lane A inventory  
# - Lane C harness can process Lane A identified transformation targets
# - Lane D metrics show no performance regression from instrumentation
```

## Risk Management

### Shared Risks
| Risk | Impact | Mitigation | Responsible Lanes |
|------|--------|------------|-------------------|
| **Development server instability** | Blocks measurement and testing | Coordinate server restarts, use health checks | All |
| **Git repository conflicts** | Blocks parallel work | Clear branching strategy, frequent communication | All |
| **TypeScript compilation failures** | Blocks validation | Incremental changes, frequent type checking | B, C |
| **Performance impact from instrumentation** | Affects baseline measurements | Lightweight tracking, before/after comparison | D |

### Mitigation Strategies
- **Clean Git Strategy**: Each lane works in feature branches, merge to `wave0/baseline` when complete
- **Server Coordination**: Shared Slack/Discord channel for server restart coordination
- **Incremental Validation**: Run `npm run typecheck` and `npm run lint` frequently
- **Rollback Readiness**: All changes must be easily reversible

## Communication & Coordination

### Daily Check-ins (15 minutes)
1. **Progress Update**: What did you complete yesterday?
2. **Blockers**: What's preventing progress today?
3. **Dependencies**: What do you need from other lanes?
4. **Coordination**: Any shared resource needs?

### Data Sharing Protocol
- **Lane A**: Share function inventories in `docs/baseline/` as generated
- **Lane B**: Test ESLint rules against Lane A findings, provide feedback  
- **Lane C**: Notify before any test runs that modify files
- **Lane D**: Share performance concerns that might indicate architectural issues

### Escalation Path
1. **Lane-to-Lane**: Direct communication for dependencies
2. **Technical Issues**: Escalate to project lead if blocking
3. **Scope Questions**: Reference Wave 0 specification for clarification

## Timeline & Milestones

### Day 1 Target (End of Day)
- **Lane A**: Auth functions and server fetchers inventories complete
- **Lane B**: First 2 custom ESLint rules implemented and tested
- **Lane C**: Core runner infrastructure and AST utilities operational  
- **Lane D**: Enhanced instrumentation deployed and measuring

### Day 2 Target (Wave 0 Complete)
- **Lane A**: All 4 inventories complete with cross-validation
- **Lane B**: All ESLint enhancements active, CI integration complete
- **Lane C**: Full harness with dry-run, rollback, and batch processing tested
- **Lane D**: Baseline metrics captured, analysis complete, monitoring active

### Final Integration (End of Day 2)
- **All Lanes**: Cross-validation testing complete
- **Documentation**: All methodologies and assumptions documented
- **Handoff**: Clean repository state ready for Wave 1 teams

## Next Wave Preparation

Wave 0 deliverables enable:
- **Wave 1**: Request Context & Logging - Mass migration of `requireMemberAccess` calls
- **Wave 2**: Permissions DSL & Migration - Role-based access pattern updates  
- **Wave 3**: Caching, Performance & Security - Optimization and hardening
- **Wave 4**: Testing, Telemetry & Freeze - Comprehensive testing and monitoring

Your baseline and guardrails work provides the safety net for all subsequent authentication modernization efforts.

## Getting Started

### Prerequisites Check
```bash
# Verify development environment
npm run dev # Should start successfully
npm run typecheck # Should pass
npm run lint # Should pass  
git status # Should be clean

# Verify authentication works
curl http://localhost:3000/dashboard # Should redirect or load (depending on auth)
```

### Lane-Specific Startup
1. **Read your lane-specific task file** thoroughly
2. **Set up your development branch**: `git checkout -b wave0/lane-{a|b|c|d}`
3. **Verify your prerequisites** and dependencies
4. **Start execution** according to your task file timeline
5. **Communicate progress** in shared coordination channel

**Let's build the foundation for PinPoint's authentication modernization! 🚀**
