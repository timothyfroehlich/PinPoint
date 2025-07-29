# Row Level Security (RLS) Developer Guide

Row Level Security is PostgreSQL's built-in feature that enforces data access rules at the database level. Instead of filtering data in application code, the database automatically applies security policies to every query. This provides bulletproof multi-tenant isolation.

RLS is the cornerstone of PinPoint's security architecture, ensuring that organizations can never access each other's data, even if application code has bugs.

## Guides

- [Policy Implementation](./policy-implementation.md) - Creating and managing RLS policies
- [Testing Patterns](./testing-patterns.md) - Validating RLS security in tests
