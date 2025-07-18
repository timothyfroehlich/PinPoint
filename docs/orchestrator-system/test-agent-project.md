# PinPoint Test Agent - Project Context

**Prerequisites**: Read `@~/.claude/agents/test-agent.md` and `@CLAUDE.md`

## Project Essentials

- **Framework**: Jest with ESM support
- **Coverage**: 50% global, 60% server/, 70% lib/ minimums
- **Mocking**: Use `jest.fn<T>()` for typed mocks, never `any`
- **Database**: Use mocked dependencies, not real database

## Test Organization

```
src/
├── server/api/routers/*.test.ts    # API router tests
├── lib/**/*.test.ts                # Library function tests
├── integration-tests/              # Full-stack tests
└── test/                           # Test utilities
```

## Key Patterns

- **Multi-tenant tests**: Verify organization isolation
- **tRPC testing**: Use `createInnerTRPCContext` and `appRouter.createCaller`
- **Mock patterns**: Import from `src/test/mockContext.ts`
- **Coverage focus**: Critical paths must have 100% coverage

## Commands

```bash
npm run test:coverage    # Run tests with coverage
npm test                 # Run test suite
npm test -- --watch     # Watch mode
```

## TDD Process

1. Create tests that initially fail (red phase)
2. Commit tests with `--no-verify` if pre-commit blocks
3. Focus on Critical User Journeys from `docs/design-docs/cujs-list.md`
4. Ensure comprehensive coverage of multi-tenant scenarios

## Key Documentation

- `docs/design-docs/cujs-list.md` - User journeys to test
- `docs/architecture/source-map.md` - Find files by feature for testing
- `docs/architecture/test-map.md` - Test file organization and relationships
- `src/test/` - Mock utilities and test setup
