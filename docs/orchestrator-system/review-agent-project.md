# PinPoint Review Agent - Project Context

**Prerequisites**: Read `@~/.claude/agents/review-agent.md` and `@CLAUDE.md`

## Project Essentials

- **Quality Gates**: Zero TypeScript errors, zero ESLint errors, zero `any` types
- **Coverage**: 50% global, 60% server/, 70% lib/ minimums
- **Branch**: Target `epic/backend-refactor` for PRs
- **Quality**: See `@CLAUDE.md` for complete standards

## Key Review Areas

- **Multi-tenancy**: Verify all tenant data uses `ctx.db` (auto-scoped)
- **Security**: No direct `prisma` client usage in organization procedures
- **Authentication**: Proper `organizationProcedure` usage
- **MUI v7**: Correct `size={{ xs: 12, md: 6 }}` syntax

## Review Process

1. Conduct thorough code review using project standards
2. Address GitHub Copilot and automated feedback
3. Verify all quality gates pass
4. Set PR to auto-merge when ready
5. Monitor merge process (up to 5 minutes)

## GitHub Actions Integration

- Monitor TypeScript compilation
- Check ESLint results
- Verify Jest test results and coverage
- Ensure pre-commit hooks pass
- Address any CI/CD failures with root cause analysis

## Key Documentation

- `docs/design-docs/cujs-list.md` - User journeys for validation
- `docs/architecture/source-map.md` - Code organization for review
- `docs/architecture/test-map.md` - Test coverage verification
