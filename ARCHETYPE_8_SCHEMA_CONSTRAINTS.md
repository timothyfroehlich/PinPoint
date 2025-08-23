# Archetype 8: Schema/Database Constraint Tests

## Summary

- Total failing tests identified: 18
- Common failure patterns: Foreign key constraint violations, Schema setup issues, NOT NULL violations
- Security boundary violations: 4 tests with constraint-based security bypass attempts
- RLS context issues: 2 tests requiring RLS integration with constraints
- Fix complexity assessment: moderate - mostly schema configuration and constraint setup

## Security Issues Identified

- **Cross-Org Access Violations**: 2 tests with foreign key constraints not respecting organizational boundaries
- **Role Permission Failures**: 1 test with role constraint validation
- **RLS Policy Failures**: 2 tests with RLS-constraint interaction failures
- **Schema Constraint Issues**: 13 tests with database integrity constraint violations

## Failing Tests Analysis

### src/integration-tests/schema-migration-validation.integration.test.ts

**Tests Failing**: 4/9 tests  
**Security Focus**: Database schema integrity and foreign key relationship validation
**Failure Type**: Missing SEED_TEST_IDS definition and foreign key constraint setup
**Error Message**: "SEED_TEST_IDS is not defined"
**Security Risk**: Schema validation not working - could allow referential integrity bypasses
**Fix Assessment**: Schema setup needs proper test constants and foreign key validation
**Priority**: HIGH - Database integrity foundation

### src/integration-tests/schema-data-integrity.integration.test.ts

**Tests Failing**: 1/8 tests
**Security Focus**: Cascading deletes and referential integrity across organizational boundaries  
**Failure Type**: Foreign key cascades not properly scoped to organizational boundaries
**Error Message**: Schema data integrity issues with cascading operations
**Security Risk**: Data deletion cascades could affect other organizations' data
**Fix Assessment**: Ensure foreign key constraints respect organizational scoping
**Priority**: HIGH - Cross-organizational data integrity

### src/integration-tests/notification.schema.test.ts

**Tests Failing**: 3/5 tests
**Security Focus**: Notification schema constraints and organizational scoping
**Failure Type**: NOT NULL constraint violations on organizationId
**Error Message**: "Failed query: insert into 'notifications' ... organizationId default default"
**Security Risk**: Notifications could be created without organizational context
**Fix Assessment**: Notification schema needs proper organizational constraint setup
**Priority**: MEDIUM - Notification security scoping

### Machine Owner Constraint Integration

**Tests Failing**: Referenced in machine.owner.integration.test.ts
**Security Focus**: Machine ownership constraints and referential integrity
**Failure Type**: "withIsolatedTest(...).returning is not a function"
**Error Message**: Database operation constraint errors
**Security Risk**: Machine ownership constraints not properly validated
**Fix Assessment**: Database constraint integration with test isolation patterns
**Priority**: MEDIUM - Ownership constraint validation

### Cross-Organization Audit Security Constraints

**Tests Failing**: Multiple in cross-org-isolation.test.ts
**Security Focus**: Database constraints preventing cross-organizational access
**Failure Type**: NOT NULL constraint violation on modelId in audit tests
**Error Message**: "null value in column 'modelId' of relation 'machines' violates not-null constraint"
**Security Risk**: Audit test data creation bypassing required constraints
**Fix Assessment**: Audit test data must respect all database constraints
**Priority**: MEDIUM - Audit data integrity

### Location Router Schema Constraint Tests

**Tests Failing**: Tests in location integration requiring schema validation
**Security Focus**: Location-organization relationship constraints
**Failure Type**: Schema constraint validation with organizational scoping
**Error Message**: Schema validation errors with organizational boundaries
**Security Risk**: Location data could be created outside organizational boundaries
**Fix Assessment**: Location schema constraints need organizational validation
**Priority**: MEDIUM - Location data boundary enforcement

## Security Patterns and Recommendations

- **RLS Context Requirements**: 2 files needing RLS integration with database constraints
- **Multi-Tenant Boundaries**: 4 files needing constraint-based organizational scoping
- **Permission Matrix Validation**: 1 file needing role-constraint integration
- **Schema Integrity**: 13 files needing proper database constraint setup

## Security Fix Priority Matrix

**Critical Priority (Data Integrity)**:

- Foreign key cascades respecting organizational boundaries to prevent cross-org data deletion
- Schema migration validation ensuring proper constraint setup

**High Priority (Constraint Security)**:

- **src/integration-tests/schema-migration-validation.integration.test.ts**: Foundation schema integrity
- **src/integration-tests/schema-data-integrity.integration.test.ts**: Cross-organizational data integrity
- Database constraints preventing unauthorized cross-organizational references

**Medium Priority (Schema Validation)**:

- **src/integration-tests/notification.schema.test.ts**: Notification organizational scoping constraints
- Machine ownership constraint validation and enforcement
- Location schema constraint organizational validation

**Low Priority (Test Infrastructure)**:

- Schema test data setup and constraint validation patterns
- Integration test isolation with proper constraint handling
- Audit test data creation with full constraint compliance

## Critical Schema Security Issues

### **Database Constraint Security Integration**

1. **Foreign Key Organizational Scoping**: Foreign keys must respect organizational boundaries
2. **Cascade Operation Security**: DELETE and UPDATE cascades must not cross organizational limits
3. **Constraint-RLS Integration**: Database constraints must work with RLS policies
4. **NOT NULL Security**: Required fields enforcing organizational context

### **Schema-Level Security Validation**

```sql
-- Example: Organizational constraint validation needed
ALTER TABLE machines
ADD CONSTRAINT machines_org_model_fk
FOREIGN KEY (organizationId, modelId)
REFERENCES models(organizationId, id);

-- Ensure cascades respect organizational boundaries
ALTER TABLE notifications
ADD CONSTRAINT notifications_org_user_fk
FOREIGN KEY (organizationId, userId)
REFERENCES memberships(organizationId, userId)
ON DELETE CASCADE;
```

### **Constraint-Based Security Patterns**

1. **Multi-Column Foreign Keys**: Include organizationId in foreign key relationships
2. **Check Constraints**: Validate data integrity with organizational scoping
3. **Trigger Security**: Database triggers respecting RLS context
4. **Unique Constraints**: Organizational scoping in uniqueness validation

### **Schema Migration Security**

- Migration scripts must establish proper organizational constraints
- Schema validation must test cross-organizational boundary enforcement
- Foreign key relationships must include organizational context
- Default values must not violate organizational scoping

## Immediate Schema Security Remediation Required

1. **Fix Schema Test Constants**:
   - Ensure SEED_TEST_IDS available in all schema tests
   - Proper test data setup with organizational context
   - Foreign key relationship validation

2. **Organizational Constraint Integration**:
   - Multi-column foreign keys including organizationId
   - Cascade operations respecting organizational boundaries
   - NOT NULL constraints on organizational context fields

3. **Constraint-RLS Coordination**:
   - Database constraints working with RLS policies
   - Trigger security with proper session context
   - Schema-level validation complementing RLS enforcement

4. **Schema Security Validation**:
   - Comprehensive constraint testing across organizational boundaries
   - Performance validation of constraint enforcement
   - Integration testing with business logic constraints

## Security Risk Assessment

**Data Integrity Impact**: MEDIUM to HIGH

- Schema constraints are the last line of defense for data integrity
- Cross-organizational constraint violations could lead to data corruption
- Cascade operations crossing organizational boundaries create security risks

**Production Impact**: MEDIUM

- Schema constraint failures primarily affect development and testing
- Production database likely has proper constraints already established
- Test failures indicate potential gaps in constraint coverage

**Compliance Implications**: MEDIUM

- Database constraints support GDPR organizational boundary enforcement
- Referential integrity important for audit trail compliance
- Schema-level validation complements application-level security

This archetype represents important infrastructure security but is lower priority than permission/auth and RLS policy failures due to the database-level enforcement providing backup security even if application constraints fail.
