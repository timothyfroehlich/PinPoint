# Index of docs/lessons-learned

This directory contains documentation about lessons learned during the development of the PinPoint application. These documents capture insights, solutions to complex problems, and best practices derived from real-world development experiences.

**Note**: Core lessons learned have been integrated into the main `CLAUDE.md` file, testing documentation at `@docs/testing/vitest-guide.md`, and architecture documentation for easier agent reference.

**Status**: ✅ **Major consolidation completed** - Key lesson files have been integrated into permanent documentation:

- `issue-list-testing-patterns.md` → `@docs/testing/vitest-guide.md`
- `typescript-migration-completed.md` → `@docs/developer-guides/typescript-guide.md`
- `unified-dashboard-architecture.md` → `@docs/architecture/current-state.md` + `@docs/security/api-security.md`

## Remaining Lessons Learned

- **[completed-task-consolidation.md](./completed-task-consolidation.md)**: Comprehensive lessons learned from task consolidation and cleanup across the PinPoint repository, covering task management best practices, technical implementation insights, and development process improvements. Captures counter-intuitive discoveries from security-first architecture, testing strategy evolution, and successful TypeScript/Vitest migrations.
- **[public-api-endpoints.md](./public-api-endpoints.md)**: Documents the implementation and validation of public API endpoints for unauthenticated access, covering security boundary testing, mock data accuracy challenges, and comprehensive test coverage strategies. Demonstrates counter-intuitive insights about multi-tenant scoping in public endpoints and the critical importance of mock data accuracy in testing.
- **[migration-reports/](./migration-reports/)**: Detailed Jest to Vitest migration reports from the completed framework migration. Contains performance benchmarks (18.5x overall improvement), established patterns like VitestMockContext and vi.hoisted(), and architecture insights discovered during authentication system migration. Valuable reference for understanding migration complexity and established testing patterns. **Note**: Dated reports moved to `archive/` subdirectory.
