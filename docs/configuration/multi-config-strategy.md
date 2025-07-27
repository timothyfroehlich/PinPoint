# PinPoint Multi-Configuration Strategy

**Status**: ✅ **Active** - Current implementation guide  
**Audience**: Developers, Claude Agents

> **🤖 Agent Notice**: Before modifying ANY configuration file, read this document to understand the multi-tier system and interdependencies.

---

## Overview

PinPoint uses a **multi-tier configuration system** with different TypeScript and ESLint rules for different code contexts:

- **Production Code**: Strictest standards (`@tsconfig/strictest`)
- **Config/Build Files**: Moderate standards (relaxed for tooling flexibility)
- **Test Utilities**: Moderate standards (`@tsconfig/recommended`)
- **Test Files**: Pragmatic patterns (relaxed for testing effectiveness)

**Central Principle**: All patterns are centralized in `tooling.config.ts` to prevent duplication and ensure consistency.

---

## Configuration Architecture

```
tooling.config.ts              ← Master patterns & rules
├── tsconfig.base.json         ← Shared foundation
├── tsconfig.json              ← Production (strictest)
├── tsconfig.config.json       ← Config/build files (moderate)
├── tsconfig.test-utils.json   ← Test utilities (recommended)
├── tsconfig.tests.json        ← Test files (relaxed)
├── eslint.config.js           ← Multi-tier rules
├── .betterer.ts               ← Regression tracking
└── vitest.config.ts           ← Test configuration
```

### File Pattern System

**Centralized in `tooling.config.ts`**:

```typescript
INCLUDE_PATTERNS = {
  production: ["./src/**/*.{ts,tsx}"],           // Source code
  testUtils: ["./src/test/**/*.{ts,tsx}"],       // Reusable test code
  tests: ["./src/**/*.test.{ts,tsx}", ...],      // Test files
}
```

**Pattern Conversion**: Different tools need different formats (with/without `./` prefix)

- `convertPatterns.forESLint()` - Removes `./` prefix
- `convertPatterns.forBetterer()` - Ensures `./` prefix
- `convertPatterns.forTSConfig()` - Removes `./` prefix

### Rule Hierarchy

**ESLint Rules by Context**:
| Rule | Production | Test Utils | Test Files |
|------|------------|------------|------------|
| `no-explicit-any` | `error` | `warn` | `off` |
| `no-unsafe-*` | `error` | `warn` | `off` |
| `explicit-function-return-type` | `warn` | `warn` | `off` |

**TypeScript Strictness**:

- **Production**: `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`
- **Test Utils**: `exactOptionalPropertyTypes: false`, `noUncheckedIndexedAccess: false`
- **Test Files**: `strict: false`, `noImplicitAny: false`

---

## Key Configuration Files

### `tooling.config.ts` - Central Command

- **Purpose**: Single source of truth for all patterns and rules
- **Exports**: `INCLUDE_PATTERNS`, `ESLINT_RULES`, `TYPESCRIPT_CONFIGS`, conversion utilities
- **Usage**: Imported by all other config files to ensure consistency

### TypeScript Configs

- **`tsconfig.base.json`**: Shared settings (paths, Next.js plugins, module resolution)
- **`tsconfig.json`**: Production code - extends base + `@tsconfig/strictest`, excludes all config files
- **`tsconfig.config.json`**: Config/build files - extends base, relaxed standards for tooling
- **`tsconfig.test-utils.json`**: Test utilities - extends base + `@tsconfig/recommended`
- **`tsconfig.tests.json`**: Test files - extends base only, relaxed settings

### ESLint Multi-Tier System

- Uses `INCLUDE_PATTERNS` to apply different rule sets per context
- Production files get strict type-safety rules as errors
- Test utilities get same rules as warnings
- Test files disable type-safety rules entirely

### Betterer Regression Prevention

- Tracks TypeScript errors in production code (blocks CI)
- Monitors `any` usage in production code (blocks CI)
- Tracks test utilities progress (warns, doesn't block)

---

## Development Workflow

### Validation Commands

```bash
npm run typecheck           # Production + Config TypeScript checks
npm run lint               # Multi-context ESLint
npm run betterer           # Regression check
npm run validate           # Combined validation
```

### Context-Specific Checking

```bash
# Check specific contexts
npx tsc -p tsconfig.config.json --noEmit       # Config/build files
npx tsc -p tsconfig.test-utils.json --noEmit   # Test utilities
npx tsc -p tsconfig.tests.json --noEmit        # Test files
```

---

## Agent Guidelines

### 🤖 Configuration Change Protocol

**Before Any Config Changes**:

1. **Understand the tier system** - Which context does this file serve?
2. **Use centralized patterns** - Modify `tooling.config.ts`, not individual configs
3. **Check dependencies** - How does this affect other configs?
4. **Test thoroughly** - Run `npm run validate` after changes

### Common Mistakes to Avoid

❌ **Don't**: Hardcode file patterns in config files  
✅ **Do**: Use `INCLUDE_PATTERNS` from `tooling.config.ts`

❌ **Don't**: Apply same rules to all contexts  
✅ **Do**: Respect the tier system (production/test-utils/tests)

❌ **Don't**: Modify without understanding dependencies  
✅ **Do**: Read this guide and test changes

### Configuration Modification Workflow

1. Modify `tooling.config.ts` if changing patterns or rules
2. Update specific config files using centralized exports
3. Run `npm run validate` to verify all contexts work
4. Test with `npm run test` to ensure functionality

---

## Troubleshooting

### Common Issues

- **"TypeScript errors in test files"**: Check if files match `tsconfig.tests.json` patterns
- **"Config files checked by strictest rules"**: Ensure config files are properly excluded from `tsconfig.json` and included in `tsconfig.config.json`
- **"ESLint too strict/loose"**: Verify file context in `INCLUDE_PATTERNS`
- **"Betterer blocking CI"**: Run `npm run betterer:update` for intentional changes
- **"IDE wrong errors"**: Restart TypeScript service, check project selection

### Health Check

```bash
npm run validate    # Full multi-tier validation
npm run test       # Ensure functionality still works
```

---

## Adding New Contexts

To add a new file context (e.g., "scripts"):

1. **Add to `tooling.config.ts`**:

   ```typescript
   INCLUDE_PATTERNS.scripts = ["./scripts/**/*.{ts,js}"];
   ESLINT_RULES.scripts = {
     /* appropriate rules */
   };
   ```

2. **Create TypeScript config** (if needed): `tsconfig.scripts.json`

3. **Update `eslint.config.js`** to use new patterns and rules

4. **Test with validation commands**

---

## Key Benefits

- **Context-Appropriate Standards**: Different rules for different needs
- **Centralized Management**: No duplication, consistent patterns
- **Regression Prevention**: Betterer prevents backsliding
- **IDE Integration**: Accurate IntelliSense per context
- **Performance**: Only necessary rules run where needed

---

**Related Docs**: [TypeScript Base Standards](../developer-guides/typescript-base-standards.md) | [TypeScript Strictest Production](../developer-guides/typescript-strictest-production.md) | [Betterer Workflow](../developer-guides/betterer-workflow.md)

**Last Updated**: July 27, 2025
