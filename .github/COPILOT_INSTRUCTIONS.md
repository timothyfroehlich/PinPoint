# GitHub Copilot Instructions - Documentation

This document explains the Copilot instruction setup for the PinPoint repository.

## Overview

GitHub Copilot uses instruction files to provide context-aware guidance when generating code, reviewing pull requests, and answering questions. This repository uses a hierarchical instruction system following [GitHub's best practices](https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions).

## File Structure

```
.github/
├── copilot-instructions.md          # Repository-wide instructions
├── COPILOT_INSTRUCTIONS.md          # This documentation file
└── instructions/
    ├── testing.instructions.md      # Test-related files
    ├── database.instructions.md     # Database layer files
    ├── auth.instructions.md         # Authentication files
    ├── components.instructions.md   # React components
    ├── api-routes.instructions.md   # API routes and tRPC
    └── server-actions.instructions.md # Server Actions
```

## How It Works

### Repository-Wide Instructions
The main `.github/copilot-instructions.md` file provides:
- Project overview and technology stack
- Critical architectural patterns
- Development commands reference
- Code quality standards
- Links to comprehensive documentation

This file is automatically loaded by Copilot for all operations in the repository.

### Pattern-Specific Instructions
Files in `.github/instructions/` use YAML frontmatter to target specific file patterns:

```markdown
---
applyTo: "src/app/**/*.tsx,src/components/**/*.tsx"
---

# Component Development Instructions
...
```

When working on files matching the `applyTo` pattern, Copilot will merge both the repository-wide instructions and the pattern-specific instructions.

## Pattern Mappings

| Instruction File | Applies To | Coverage |
|-----------------|------------|----------|
| `testing.instructions.md` | `**/*.test.ts`, `**/*.spec.ts`, `e2e/**/*.ts`, `src/test/**/*.ts` | Test files, test helpers, E2E tests |
| `database.instructions.md` | `src/server/db/**/*.ts`, `**/*dal*.ts`, `**/*schema*.ts` | Database layer, DAL functions, schema |
| `auth.instructions.md` | `**/*auth*.ts`, `**/middleware.ts`, `app/auth/**/*.ts`, `src/lib/supabase/**/*.ts` | Authentication, Supabase integration |
| `components.instructions.md` | `src/app/**/*.tsx`, `src/components/**/*.tsx` | Server Components, Client Components |
| `api-routes.instructions.md` | `src/app/api/**/*.ts`, `src/server/api/**/*.ts` | API routes, tRPC routers |
| `server-actions.instructions.md` | `src/lib/actions/**/*.ts`, `**/*actions*.ts` | Server Actions |

## Instruction Hierarchy

When Copilot generates code or provides guidance, it merges instructions in this order:

1. **Organization-level instructions** (if configured at org level)
2. **Repository-wide instructions** (`.github/copilot-instructions.md`)
3. **Pattern-specific instructions** (matching `.github/instructions/*.instructions.md`)

This allows for:
- General principles to apply everywhere
- Specialized guidance for specific file types
- Overriding of general rules with specific patterns

## Key Patterns Covered

### Security Patterns
- Multi-tenant organization scoping (CRITICAL)
- SQL injection prevention
- Authentication and authorization
- RLS (Row-Level Security) enforcement

### Architecture Patterns
- Server-First development (Server Components by default)
- Type safety boundaries (DB types vs Application types)
- Import patterns (`~/` aliases)
- Error handling and structured errors

### Testing Patterns
- Memory-safe test patterns (worker-scoped PGlite)
- Test type selection (Unit, Integration, E2E, RLS)
- Hardcoded test IDs (SEED_TEST_IDS)
- Mock patterns and fixtures

### Code Quality
- TypeScript strictest mode compliance
- No escape hatches (`any`, `!`, unsafe `as`)
- Proper null safety and type guards
- Explicit return types

## Maintaining Instructions

### When to Update

Update instructions when:
- New architectural patterns are established
- Critical security patterns change
- New forbidden patterns are identified
- Testing strategies evolve
- New file patterns are introduced

### Update Process

1. **Identify the scope**: Determine if the change affects:
   - Repository-wide patterns → Update `.github/copilot-instructions.md`
   - Specific file patterns → Update or create `.github/instructions/*.instructions.md`

2. **Maintain consistency**: Ensure instructions align with:
   - `/docs/CORE/NON_NEGOTIABLES.md` (single source of truth for critical patterns)
   - `/docs/CORE/TYPESCRIPT_STRICTEST_PATTERNS.md`
   - `/docs/CORE/TESTING_GUIDE.md`

3. **Test the changes**: After updating:
   - Ask Copilot to generate code matching the pattern
   - Verify it follows the updated instructions
   - Check that existing patterns still work

4. **Document updates**: Update this file if the structure changes or new patterns are added

### Best Practices

1. **Keep it concise**: Instructions should be actionable and specific
2. **Show examples**: Use ✅ correct and ❌ wrong patterns
3. **Reference documentation**: Link to comprehensive docs for details
4. **Avoid duplication**: Don't repeat `/docs/CORE/NON_NEGOTIABLES.md` content
5. **Use consistent formatting**: Follow the established markdown structure

## Example Usage

### Code Generation
When creating a new React component in `src/components/`:
- Copilot loads repository-wide instructions
- Copilot loads `components.instructions.md` (pattern match)
- Generated code follows Server Component patterns
- Organization context is properly handled

### Code Review
When reviewing a PR with database changes:
- Copilot applies repository-wide security checks
- Copilot applies `database.instructions.md` patterns
- Validates organization scoping in queries
- Checks for SQL injection patterns

### Chat and Debugging
When asking Copilot for help:
- Context from all relevant instruction files is available
- Copilot can reference pattern-specific guidance
- Links to documentation are provided

## Verification

To verify the instructions are working:

1. **Test pattern matching**:
   ```bash
   # Check what files match each pattern
   echo "Testing components pattern:"
   fd . src/app -e tsx | head -5
   ```

2. **Ask Copilot**:
   - "Show me how to create a Server Component that fetches issues"
   - "What are the authentication patterns I should follow?"
   - "How should I write an integration test for a tRPC router?"

3. **Review generated code**:
   - Does it use `~/` imports?
   - Does it include organization scoping?
   - Does it follow type safety patterns?

## Resources

- [GitHub Copilot Custom Instructions Docs](https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions)
- [Best Practices for Copilot Coding Agent](https://docs.github.com/en/copilot/tutorials/coding-agent/get-the-best-results)
- [PinPoint NON_NEGOTIABLES.md](/docs/CORE/NON_NEGOTIABLES.md)
- [PinPoint AGENTS.md](/AGENTS.md)

## Contributing

When adding new patterns or architectural decisions:

1. Update `/docs/CORE/NON_NEGOTIABLES.md` first (source of truth)
2. Add pattern-specific instructions to `.github/instructions/`
3. Update `.github/copilot-instructions.md` if needed
4. Update this documentation if structure changes
5. Test with Copilot to verify effectiveness

---

**Last Updated**: 2025-11-04  
**Maintained By**: PinPoint Development Team
