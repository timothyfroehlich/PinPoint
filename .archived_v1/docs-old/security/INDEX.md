# Security Documentation

Security patterns and guidelines for PinPoint.

## Current Stack (Being Replaced)

- Application-level multi-tenant filtering
- Manual organizationId validation
- Complex permission checks in code

## Migration Target

- Database-level Row Level Security (RLS)
- Automatic tenant isolation via PostgreSQL
- JWT-based permission claims

## Contents

- **[api-security.md](./api-security.md)** - API security guidelines and tRPC patterns
- **[environment-specific-auth.md](./environment-specific-auth.md)** - Environment-based auth strategies
- **[audit-findings.md](./audit-findings.md)** - Security audit results and mitigations
- **[system-audit.md](./system-audit.md)** - Complete system security assessment
- **[SARIF Code Scanning](../developer-guides/sarif-integration.md)** - Static analysis results integration with GitHub Security
- **[RLS Testing](../developer-guides/row-level-security/testing-patterns.md)** - Security validation patterns
