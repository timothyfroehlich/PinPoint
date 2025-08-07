# Phase 2A: Final Decisions Log

**Date**: August 2, 2025  
**Status**: Decisions Finalized, Ready for Implementation  
**Issue**: #208 - Phase 2A Drizzle Foundation

## ✅ FINAL DECISIONS MADE

### 1. Users & Permissions Implementation Strategy
**Decision**: Junction table approach (Option A) for exact Prisma parity  
**Implementation**: Create `_RolePermissions` table to match current Prisma behavior  
**Immediate Follow-up**: Phase 2B task to simplify to JSON array approach  
**Rationale**: Conservative migration approach minimizes risk

**Prisma Current State**:
```prisma
Role {
  permissions Permission[] @relation("RolePermissions")
}
Permission {
  roles Role[] @relation("RolePermissions")
}
```

**Drizzle Implementation**:
```typescript
export const rolePermissions = pgTable("_RolePermissions", {
  roleId: text("A").notNull().references(() => roles.id),
  permissionId: text("B").notNull().references(() => permissions.id),
});
```

### 2. Type Migration Strategy
**Decision**: Gradual router-by-router conversion as planned in Issue #200  
**Phases**: 
- Phase 2A: Keep all existing Prisma types
- Phase 2C-2E: Convert types during router migrations
- No immediate type changes required

**Implementation**: tRPC procedures continue using Prisma types until their specific router migration

### 3. Validation Approach
**Decision**: Light validation, rely on existing test coverage  
**Implementation**: Basic query comparison in development only  
**No Paranoia**: Don't require exact query result matching  
**Trust Tests**: Existing test suite will catch functional issues

### 4. Schema Organization Strategy
**Decision**: Modular domain-based structure confirmed  
**File Structure**:
- `auth.ts` - User, Account, Session, VerificationToken
- `organizations.ts` - Organization, Membership, Role, Permission + junction
- `machines.ts` - Location, Model, Machine (QR code system)
- `issues.ts` - Issue workflow system (complex relationships)
- `collections.ts` - Collections, Notifications, PinballMapConfig

**Approach**: 1:1 Prisma parity with JSON fields preserved exactly

### 5. JSONB Optimizations Timing
**Decision**: Deferred to dedicated Phase 2B (#246)  
**Timeline**: After foundation stability is proven  
**Scope**: Role permissions, issue activity history, collection filters  
**Rationale**: Industry best practices favor migration stability over optimization

### 6. Migration Risk Management
**Decision**: Conservative, rollback-safe approach  
**Strategy**: Drizzle is purely additive during Phase 2A  
**Safety**: All Prisma code remains untouched  
**Rollback**: Can cleanly remove Drizzle if issues arise

## 🤔 OPEN DECISIONS

### Database Connection Strategy
**Status**: User still deciding  
**Options Under Consideration**:
- Singleton pattern for development hot-reload
- Shared vs separate connection pools with Prisma
- DatabaseProvider integration pattern

**Current Plan**: Proceed with basic setup, implement connection strategy when decided

**Non-Blocking**: Dependencies, config, and schema work can proceed independently

## 📋 IMPLEMENTATION APPROACH

### Conservative Migration Philosophy
- **1:1 Prisma Parity**: Exact field mapping, no schema improvements
- **JSON Preservation**: Keep all JSON fields as-is initially
- **Type Compatibility**: Maintain existing TypeScript interfaces
- **Test Reliance**: Trust existing test coverage over paranoid validation

### Execution Priority
1. **Foundation First**: Dependencies, config, basic schema
2. **Schema Implementation**: Domain-by-domain with exact parity
3. **Integration**: Database client and provider (when connection strategy decided)
4. **Validation**: Light validation infrastructure
5. **Verification**: Basic connectivity and compilation testing

### Risk Mitigation Strategy
- **Additive Only**: No changes to existing Prisma code
- **Parallel Validation**: Light comparison during development
- **Incremental Progress**: Complete each domain before moving to next
- **Easy Rollback**: Clean removal path if issues arise

## 🎯 SUCCESS CRITERIA

### Technical Requirements
- [ ] All 22 Prisma models replicated exactly in Drizzle
- [ ] Junction table for Role-Permission many-to-many relationship
- [ ] JSON fields preserved with proper TypeScript typing
- [ ] Essential indexes for multi-tenant and QR code performance
- [ ] Database connectivity to existing Supabase infrastructure

### Integration Requirements
- [ ] Dual-ORM support in development environment
- [ ] tRPC context includes both Prisma and Drizzle clients
- [ ] TypeScript compilation successful with generated types
- [ ] Light validation infrastructure operational
- [ ] No impact on existing functionality

### Foundation Requirements
- [ ] Modular schema structure enables future router migrations
- [ ] User/Permission system works identically to current implementation
- [ ] Multi-tenant organizationId filtering preserved
- [ ] QR code scanning performance maintained
- [ ] Ready for Phase 2B router migration work

## 📝 NEXT STEPS

### Immediate Actions (Can Start Now)
1. Install Drizzle dependencies
2. Create basic drizzle.config.ts
3. Set up modular schema directory structure
4. Begin schema implementation with auth.ts

### Pending User Decision
- Database connection strategy and integration pattern
- DatabaseProvider extension vs new pattern

### Follow-up Phases
- **Phase 2B**: JSONB optimizations (#246)
- **Phase 2C-2E**: Router migrations with type conversions
- **Phase 3**: RLS implementation

## 🔒 COMMITMENT TO DECISIONS

These decisions are **FINAL** for Phase 2A implementation. Any changes to this approach should be carefully considered and documented as they may impact:

- Implementation timeline
- Risk assessment
- Integration complexity
- Follow-up phase dependencies

**Implementation Team**: Proceed with confidence based on these finalized decisions.

---

**Decision Authority**: @timothyfroehlich  
**Implementation Lead**: Claude Agent  
**Review Date**: Phase 2A completion  
**Next Decision Point**: Database connection strategy