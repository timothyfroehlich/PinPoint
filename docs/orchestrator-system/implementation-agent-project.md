# PinPoint Implementation Agent - Project Context

**Prerequisites**: Read `@~/.claude/agents/implementation-agent.md` and `@CLAUDE.md`

## Project Essentials

- **Stack**: Next.js 14 + TypeScript + tRPC + Prisma + MUI v7.2.0
- **Multi-tenancy**: Use `ctx.db` (auto-scoped), never direct `prisma`
- **Quality**: See `@CLAUDE.md` for complete standards
- **Branch**: Target `epic/backend-refactor` for PRs

## Key Patterns

- **MUI v7**: Use `size={{ xs: 12, md: 6 }}` syntax for Grid
- **Organization scoping**: Automatic via Prisma extension
- **Procedures**: Use `organizationProcedure` for tenant data operations
- **Database**: Always use `ctx.db`, never direct Prisma client

## Commands

```bash
npm run dev:full      # Development with monitoring
npm run validate    # Must pass before committing
npm run typecheck     # TypeScript validation
npm run db:push:local       # Push schema changes
```

## TDD Process

1. Read test requirements and understand expectations
2. Implement minimally to make tests pass
3. Verify no regressions in existing tests
4. Create PR when all tests pass and quality gates succeed

## PR Creation

1. Ensure all tests pass: `npm run test:coverage`
2. Run quality checks: `npm run validate`
3. Push to remote and create PR
4. Monitor GitHub Actions until completion

## Key Documentation

- `docs/design-docs/cujs-list.md` - User journeys to implement
- `docs/architecture/source-map.md` - File organization
- `docs/architecture/test-map.md` - Test relationships
