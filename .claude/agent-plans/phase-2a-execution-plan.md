# Phase 2A: Execution Plan & Decision Log

**Date**: August 2, 2025  
**Status**: Ready to Execute  
**Issue**: #208 - Phase 2A Drizzle Foundation

## Decisions Made ✅

### 1. Users & Permissions Strategy
**Decision**: Junction table approach (Option A) for exact Prisma parity  
**Follow-up**: Immediate Phase 2B task to simplify to JSON array (Option B)  
**Rationale**: Conservative migration first, optimization second

### 2. Type Migration Strategy  
**Decision**: Gradual router-by-router conversion  
**Approach**: Keep Prisma types initially, update in Phase 2C-2E  
**Reference**: Detailed in Issue #200 parent epic

### 3. Validation Approach
**Decision**: Light validation, rely on tests  
**Implementation**: Basic query comparison in development only  
**Rationale**: Don't need exact match paranoia, trust test coverage

### 4. Schema Organization
**Decision**: Modular domain-based structure confirmed  
**Structure**: auth.ts, organizations.ts, machines.ts, issues.ts, collections.ts  
**Approach**: 1:1 Prisma parity with JSON fields preserved

### 5. JSONB Optimizations
**Decision**: Deferred to Phase 2B (#246)  
**Timeline**: After foundation stability proven  
**Scope**: Role permissions, issue activity, collection filters

## Open Decisions 🤔

### Database Connection Strategy
**Status**: User thinking on approach  
**Options**:
- Singleton pattern for dev hot-reload
- Shared vs separate connection pools
- DatabaseProvider integration pattern

**Impact**: Can proceed with basic setup while this is decided

## Execution Plan

### Phase 2A.1: Foundation Setup
1. **Install Drizzle dependencies**
   - `drizzle-orm`, `drizzle-kit`, `postgres`, `@types/pg`
   - Update package.json and verify installation

2. **Create Drizzle configuration**
   - `drizzle.config.ts` with Supabase connection
   - Basic schema path and output configuration
   - TypeScript integration setup

3. **Verify basic connectivity**
   - Test Drizzle can connect to existing Supabase database
   - Confirm no conflicts with existing Prisma connection

### Phase 2A.2: Modular Schema Implementation
4. **Create schema directory structure**
   - `src/server/db/schema/` directory
   - Individual domain files (auth, organizations, machines, issues, collections)
   - Barrel export index file

5. **Implement domain schemas (1:1 Prisma parity)**
   - **auth.ts**: User, Account, Session, VerificationToken
   - **organizations.ts**: Organization, Membership, Role, Permission (junction table)
   - **machines.ts**: Location, Model, Machine (QR code system)
   - **issues.ts**: Issue workflow (complex relationships)
   - **collections.ts**: Collections, Notifications, PinballMapConfig

6. **Set up relations and exports**
   - Define Drizzle relations in index.ts
   - Verify TypeScript type generation
   - Ensure all exports work correctly

### Phase 2A.3: Database Client Integration
7. **Create Drizzle database client**
   - `src/server/db/drizzle.ts` with Supabase configuration
   - Connection pooling strategy (TBD based on user decision)
   - Development vs production optimization

8. **Extend DatabaseProvider** (or create new pattern)
   - Add Drizzle client support
   - Maintain existing Prisma functionality
   - Update for dual-ORM during migration

9. **Update tRPC context**
   - Add Drizzle client to context
   - Preserve existing Prisma context
   - Type updates for dual-ORM support

### Phase 2A.4: Essential Indexes & Validation
10. **Create essential performance indexes**
    - Multi-tenant organizationId combinations
    - QR code scanning optimization
    - Permission system indexes

11. **Set up light validation infrastructure**
    - Basic query comparison utilities
    - Development-only validation
    - Simple logging of differences

12. **Verification & testing**
    - Confirm all schemas compile correctly
    - Test database connectivity and basic queries
    - Validate essential indexes are created

## Implementation Order

### Immediate (Can Start Now)
- Dependencies installation
- Drizzle config creation  
- Schema directory setup
- Basic schema implementation

### Pending Connection Decision
- Database client implementation
- DatabaseProvider integration
- tRPC context updates

### Final Steps
- Index creation
- Validation setup
- Complete testing

## Risk Mitigation

### High-Risk Areas
- **Permission system**: Junction table complexity
- **tRPC integration**: Type compatibility during dual-ORM
- **Connection pooling**: Supabase connection limits

### Rollback Strategy
- Keep all Prisma code unchanged
- Drizzle is purely additive during Phase 2A
- Can remove Drizzle dependencies cleanly if needed

## Success Criteria

- [ ] All Drizzle dependencies installed and configured
- [ ] Complete modular schema structure with 1:1 Prisma parity
- [ ] Database client connects successfully to Supabase
- [ ] TypeScript compilation successful with generated types
- [ ] Essential indexes created without performance degradation
- [ ] Light validation infrastructure operational
- [ ] Foundation ready for Phase 2B router migrations

## Timeline

**Estimated**: 2 days sequential work  
**Current Status**: Ready to begin Phase 2A.1  
**Blocking**: Database connection strategy decision (can work around initially)

## Next Steps

1. **Start immediately**: Dependencies and basic configuration
2. **User decision**: Database connection approach  
3. **Continue**: Schema implementation and integration
4. **Complete**: Validation and testing

Ready to execute! 🚀