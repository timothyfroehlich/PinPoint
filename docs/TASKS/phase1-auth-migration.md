# Phase 1 Auth Migration Checklist

## Current Legacy Import Inventory

### requireMemberAccess Usage
- src/lib/actions/admin-actions.ts
- src/lib/actions/shared.ts  
- src/lib/organization-context.ts (adapter export)

### requireOrganizationContext Usage
- src/lib/organization-context.ts (adapter export)

### getOrganizationContext Usage  
- src/lib/organization-context.ts (adapter export)

### getServerAuthContext Usage
- src/lib/actions/shared.ts (alias to getActionAuthContext)

## Migration Progress

### ✅ Completed
- [x] Canonical resolver created in src/server/auth/context.ts
- [x] Legacy adapters created with instrumentation
- [x] Type system unified (role structure, optional properties)
- [x] generateMetadata functions cleared of auth calls
- [x] Basic cleanup of unused variables

### 🔄 In Progress (Phase 1 Completion)
- [ ] Remove duplicate resolver in organization-context.ts
- [ ] Migrate high-frequency call sites to canonical resolver
- [ ] Replace ensureOrgContextAndBindRLS calls
- [ ] Add ESLint guardrails against legacy imports
- [ ] Enable AUTH_ADAPTER_STRICT=1 validation
- [ ] Capture final metrics

## Target Metrics
- authResolutionsPerRequest: ≤ 1.2 (currently >2.0)
- Legacy imports outside adapters: 0
- AUTH_ADAPTER_STRICT=1: no errors

## Files Requiring Migration
1. src/app/dashboard/page.tsx - ✅ Uses canonical resolver
2. src/app/issues/page.tsx - ⚠️ Still has auth race conditions  
3. src/app/machines/page.tsx - ✅ Uses canonical resolver
4. src/components/issues/issues-list-server.tsx - ✅ Uses canonical resolver
5. src/lib/actions/admin-actions.ts - ⚠️ Uses legacy adapter
6. src/lib/actions/shared.ts - ⚠️ Mixed legacy patterns

## Success Criteria
- [ ] Single canonical resolver source
- [ ] Zero legacy imports outside allowlist
- [ ] Metrics show ≤1.2 auth resolutions per request
- [ ] AUTH_ADAPTER_STRICT=1 passes
- [ ] All metadata functions auth-free