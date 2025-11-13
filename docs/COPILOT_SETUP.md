# GitHub Copilot Instructions Setup

This document explains the Copilot instructions configuration for the PinPoint repository.

## Overview

PinPoint has comprehensive GitHub Copilot instructions that guide AI assistance to follow the project's architectural patterns, coding standards, and best practices. The instructions are specifically tailored for the v2 single-tenant rewrite.

## File Structure

```
.github/
├── copilot-instructions.md          # Main repository-wide guidance
├── COPILOT_INSTRUCTIONS.md          # Meta documentation (this system)
└── instructions/                     # Pattern-specific instructions
    ├── auth.instructions.md          # Supabase SSR authentication
    ├── components.instructions.md    # Server vs Client components
    ├── database.instructions.md      # Drizzle ORM patterns
    ├── server-actions.instructions.md # Form handling & mutations
    └── testing.instructions.md       # Memory-safe testing
```

## How It Works

### 1. Repository-Wide Instructions

The main `.github/copilot-instructions.md` file provides:

- Project context (phase, users, core value)
- 8 architectural pillars
- Critical patterns summary
- Code examples
- What to avoid
- Quality gates

This file applies to **all files** in the repository by default.

### 2. Pattern-Specific Instructions

Each file in `.github/instructions/` includes YAML front matter specifying which file patterns it applies to:

```yaml
---
applyTo: "src/app/**/*.tsx,src/components/**/*.tsx"
---
```

When you edit a file matching these patterns, Copilot automatically merges:

1. Repository-wide instructions
2. Pattern-specific instructions for that file type

### Pattern Mapping

| File Pattern                                                                                                  | Instruction File                 | Purpose                                                           |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------- |
| `**/*auth*.ts`<br>`**/middleware.ts`<br>`src/lib/supabase/**/*.ts`<br>`src/app/(auth)/**/*.ts`                | `auth.instructions.md`           | Authentication patterns, Supabase SSR client creation, middleware |
| `src/app/**/*.tsx`<br>`src/components/**/*.tsx`                                                               | `components.instructions.md`     | Server vs Client components, UI patterns, imports                 |
| `src/server/db/**/*.ts`<br>`src/server/db/schema.ts`                                                          | `database.instructions.md`       | Schema rules, Drizzle queries, data access                        |
| `**/*actions*.ts`<br>`src/app/**/actions.ts`<br>`src/lib/actions/**/*.ts`                                     | `server-actions.instructions.md` | Server Actions, validation, mutations                             |
| `**/*.test.ts`<br>`**/*.test.tsx`<br>`**/*.spec.ts`<br>`**/*.spec.tsx`<br>`e2e/**/*.ts`<br>`src/test/**/*.ts` | `testing.instructions.md`        | Test patterns, memory safety, PGlite usage                        |

## Key Principles

### Single-Tenant Architecture

All instructions emphasize **single-tenant simplicity**:

- No organization scoping
- No Row-Level Security (RLS)
- No multi-tenant isolation layers
- Direct database access

### Server-First

- Default to Server Components
- Client components only for real interactivity
- Progressive enhancement (forms work without JS)

### Direct Data Access

- Query Drizzle directly from Server Components
- No DAL/repository/service layers (until Rule of Three)
- Server Actions for mutations

### Strict TypeScript

- No `any`, non-null `!`, or unsafe `as`
- Explicit return types
- Proper type narrowing

### Memory Safety

- Worker-scoped PGlite for integration tests
- **NEVER** per-test DB instantiation

## Using the Instructions

### As a Developer

When you use GitHub Copilot in this repository:

1. **Open any file** - Copilot automatically loads relevant instructions
2. **Request completions** - Suggestions follow project patterns
3. **Review suggestions** - Instructions guide Copilot but verify code
4. **Learn patterns** - Instructions document project conventions

### Testing Instruction Effectiveness

1. Open a file matching a pattern (e.g., `src/app/page.tsx`)
2. Request a Copilot completion
3. Verify suggestions follow server-first principles
4. For Server Action files, check validation + explicit return types
5. For test files, check worker-scoped DB usage

## Maintaining Instructions

### When to Update

Update instructions when:

- A pattern appears ≥2 times (Rule of Three)
- Source-of-truth docs change materially
- A new forbidden pattern emerges
- Architecture decisions evolve

### Update Process

1. **Update source-of-truth first** (e.g., `docs/NON_NEGOTIABLES.md`)
2. **Reference from instructions** (don't duplicate)
3. **Add concise guidance** with examples
4. **Update date stamp** at bottom of file
5. **Test effectiveness** with sample completions

### Adding New Pattern Files

If a new major pattern emerges (e.g., navigation, workflow management):

1. Create `<pattern>.instructions.md` in `.github/instructions/`
2. Add YAML front matter with `applyTo` patterns
3. Document the pattern with examples
4. Reference source-of-truth documents
5. Update this documentation

## Best Practices Compliance

This setup follows [GitHub Copilot best practices](https://gh.io/copilot-coding-agent-tips):

✅ **Main instructions file** at `.github/copilot-instructions.md`
✅ **Pattern-specific files** with YAML `applyTo` declarations
✅ **Clear structure** with headings and examples
✅ **Do's and Don'ts** for each pattern
✅ **Source references** instead of duplication
✅ **Context-aware** instructions matching v2 architecture
✅ **Maintainability** with update guidelines
✅ **Documentation** in README and meta files

## Source-of-Truth Documents

Instructions **reference** these authoritative documents:

- `docs/NON_NEGOTIABLES.md` - Forbidden patterns and critical constraints
- `docs/PATTERNS.md` - Project-specific code patterns
- `docs/TYPESCRIPT_STRICTEST_PATTERNS.md` - Type safety patterns
- `docs/PRODUCT_SPEC.md` - Feature specifications (MVP/MVP+/1.0/2.0)
- `docs/TECH_SPEC.md` - Single-tenant architecture specification
- `docs/TESTING_PLAN.md` - Testing strategy and patterns
- `AGENTS.md` - Agent-specific context and guidelines
- `TASKS.md` - Active PR sequencing and priorities

## Troubleshooting

### Copilot Suggests Outdated Patterns

**Symptom**: Copilot suggests multi-tenant or tRPC patterns

**Solution**:

1. Check if instructions are properly loaded
2. Verify file pattern matches instruction `applyTo` declaration
3. Regenerate completion after reviewing instructions
4. File an issue if pattern persists

### Instructions Not Being Applied

**Symptom**: Copilot ignores project patterns

**Solution**:

1. Verify YAML front matter syntax
2. Check file pattern matches `applyTo` glob
3. Ensure instruction file is in `.github/instructions/`
4. Reload VS Code / restart Copilot

### Need New Pattern Coverage

**Symptom**: Common pattern not covered by instructions

**Solution**:

1. Check if pattern repeats ≥2 times
2. Document in `docs/PATTERNS.md` first
3. Create new instruction file if needed
4. Update this documentation

## Evolution

The instruction system evolves with the codebase:

- **Now**: Foundational patterns (auth, components, database, actions, testing)
- **Future**: Domain patterns as they stabilize (issues, machines, comments)
- **Rule of Three**: Add abstractions/patterns only after ≥3 implementations

As features stabilize, patterns graduate to `docs/PATTERNS.md` and get referenced from instructions.

## Additional Resources

- [`.github/COPILOT_INSTRUCTIONS.md`](../.github/COPILOT_INSTRUCTIONS.md) - Meta documentation
- [`.github/copilot-instructions.md`](../.github/copilot-instructions.md) - Main instructions
- [GitHub Copilot Documentation](https://docs.github.com/en/copilot)
- [Best Practices Guide](https://gh.io/copilot-coding-agent-tips)

---

Last Updated: 2025-11-12
