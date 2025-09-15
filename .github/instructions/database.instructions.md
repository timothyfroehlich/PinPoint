---
applyTo: "src/server/db/**/*.ts,**/*dal*.ts,**/*schema*.ts"
---

# Database Layer Review Instructions

## Database-Specific Patterns
When reviewing database-related code, enforce these additional requirements:

### RLS Security Patterns
- ALL queries in DAL functions MUST include `eq(table.organizationId, organizationId)`
- Verify containment hierarchy: Organization → Location → Machine → Issue
- Check denormalized `organization_id` fields for RLS performance

### Drizzle ORM Patterns
- Use `DrizzleToCamelCase` conversion at DB→app boundaries
- Keep `Db.*` types in DB modules only, export camelCase types to application
- Prefer `db.query` API over raw SQL when possible
- Use `sql` templates for parameterization, never raw string interpolation

### Schema Compliance
- Database schema is LOCKED - no modifications allowed
- Code must adapt to existing schema structure
- Flag any schema change proposals as CRITICAL violations

### Performance Requirements
- Wrap all server data access with `cache()` for request-level memoization
- Use explicit fetch caching options in Next.js 15
- Monitor connection pooling and query optimization

### Forbidden Database Patterns
- **SQL Injection**: Raw string interpolation in SQL (`sql.raw(\`SET var = '${value}'\`)`)
- **Architectural SQL Misuse**: Using `sql.raw()` when `sql` templates provide safe parameterization
- **Session Variable Abuse**: Application code setting database session variables instead of explicit filtering
- **Per-Test Database Instances**: Memory safety violation, must use worker-scoped PGlite instances

### Type Boundaries (CORE-TS-003)
- Use `import type { Db } from "~/lib/types"` in DB modules/services only
- Convert at boundary with `DrizzleToCamelCase` or `transformKeysToCamelCase`
- Don't export `Db.*` types to routers/components
- Keep snake_case in schema, camelCase in application code

### Organization Scoping Enforcement
- Every multi-tenant query MUST include organization filtering
- Use `eq(table.organizationId, organizationId)` pattern consistently
- Validate organization context is passed down to all DAL functions
- Flag any unscoped queries as CRITICAL security violations