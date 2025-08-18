# PinPoint Configuration Guide

> **Comprehensive guide to all configuration files and tooling decisions in the PinPoint project**

## 📋 Table of Contents

- [Overview](#overview)
- [TypeScript Configurations](#typescript-configurations)
- [ESLint Configuration](#eslint-configuration)
- [Vitest Configuration](#vitest-configuration)
- [Build Tool Configurations](#build-tool-configurations)
- [Development Tools](#development-tools)
- [Security & Quality Tools](#security--quality-tools)
- [Memory Safety](#memory-safety)
- [Configuration Philosophy](#configuration-philosophy)

---

## Overview

PinPoint uses a **multi-context configuration approach** where different types of code (production, tests, utilities, config) have appropriately tuned standards:

- **Production Code**: Strictest possible TypeScript and linting (`@tsconfig/strictest`)
- **Test Utilities**: Moderate standards for reusable test code
- **Test Files**: Relaxed standards for pragmatic testing patterns
- **Config Files**: Flexible standards for build tools and scripts

---

## TypeScript Configurations

### 🎯 tsconfig.json - Production Code
```json
// Main TypeScript configuration for production code
// Extends @tsconfig/strictest for maximum type safety
// Used by: ESLint type-aware rules, IDE, tsc compilation
```

**Purpose**: Strictest possible type checking for production code
**Standards**: `@tsconfig/strictest` - catches potential runtime errors at compile time
**Scope**: `src/**/*.{ts,tsx}` excluding test files

**Key Settings**:
- `exactOptionalPropertyTypes: true` - Prevents `undefined` assignment to optional properties
- `noPropertyAccessFromIndexSignature: true` - Forces explicit property access
- `noUncheckedSideEffectImports: true` - Prevents importing modules with side effects

### 📚 tsconfig.base.json - Shared Foundation
**Purpose**: Common settings shared across all TypeScript configs
**Contains**: Path aliases, module resolution, compiler options base

### 🧪 tsconfig.tests.json - Test Files
```json
// Relaxed TypeScript configuration for test files
// Allows pragmatic testing patterns that conflict with strict production rules
```

**Purpose**: Pragmatic testing without strict type constraints
**Rationale**: Testing requires patterns that conflict with production strictness:
- Mock objects with partial interfaces
- Dynamic test data generation
- Framework-specific patterns (Vitest globals)
- `any` types for complex mock scenarios

**Scope**: `**/*.test.{ts,tsx}`, `**/*.spec.{ts,tsx}`, `**/__tests__/**`

### 🔧 tsconfig.test-utils.json - Test Utilities
**Purpose**: Moderate standards for reusable test code (factories, helpers, utilities)
**Scope**: `src/test/**/*.{ts,tsx}`
**Rationale**: More flexible than production but stricter than test files

### ⚙️ tsconfig.config.json - Build Tools
**Purpose**: Configuration for build tools and scripts
**Scope**: `*.config.{js,ts}`, scripts, build tools
**Rationale**: Build tools need flexibility for dynamic configurations

---

## ESLint Configuration

### 🔒 Multi-Context Linting Strategy

Our ESLint setup (`eslint.config.js`) implements **context-aware linting** with different rule sets for different code types:

```javascript
/**
 * ESLint Configuration for PinPoint
 * 
 * Multi-context setup supporting:
 * - Production code: Strictest type safety
 * - Test utilities: Moderate standards  
 * - Test files: Relaxed for pragmatic testing
 * - Config files: Flexible for build tools
 * 
 * Key features:
 * - Type-aware linting with multiple tsconfigs
 * - Modern security and quality plugins (Phase 0)
 * - Custom Drizzle safety rules
 * - Performance optimized
 */
```

### 🛡️ Security & Quality Plugins (Phase 0)

**Modern Plugin Stack**:
- `@vitest/eslint-plugin` - Official Vitest test quality rules
- `eslint-plugin-security` - SQL injection prevention, security scanning
- `@microsoft/eslint-plugin-sdl` - Microsoft Security Development Lifecycle rules

**Custom Drizzle Safety Rules**:
```javascript
// Replaces abandoned eslint-plugin-drizzle
"no-restricted-syntax": [
  "error",
  {
    "selector": "CallExpression[callee.property.name='delete']:not([arguments.0])",
    "message": "DELETE operations must include WHERE clause"
  },
  {
    "selector": "CallExpression[callee.property.name='update']:not([arguments.0])",
    "message": "UPDATE operations must include WHERE clause"
  }
]
```

### 📊 Performance Considerations

**Multi-tsconfig Impact**: ~15-20% slower linting due to type-aware rules across 4 TypeScript configurations
**Mitigation**: Parallel execution and intelligent caching
**Memory Usage**: ~150-300MB additional during linting

---

## Vitest Configuration

### 🧪 Three-Project Testing Architecture

```typescript
/**
 * Vitest Configuration for PinPoint
 * 
 * Three-project setup:
 * - node: Unit tests with mocked database (256MB limit)
 * - integration: Real PGlite database tests (512MB limit)  
 * - jsdom: React component tests
 * 
 * Memory safety: Worker threads isolated, limited parallelism
 * for PGlite stability. See docs/testing/memory-safety.md
 */
```

### 💾 Memory Safety Architecture

**Critical for PGlite Integration Tests**:
- **Unit Tests**: 256MB limit, mocked database, maximum parallelism
- **Integration Tests**: 512MB limit, real PGlite database, limited parallelism
- **Component Tests**: JSDOM environment for React testing

**Why Memory Limits**:
- PGlite creates in-memory PostgreSQL instances (~50-100MB each)
- 12+ integration tests without limits = 1-2GB+ usage = system lockups
- Worker isolation prevents memory blowouts between test files

### 🎯 Test Project Mapping

```javascript
projects: [
  {
    name: "node",
    testMatch: ["**/*.test.ts"],
    environment: "node",
    // Unit tests: Mock everything, fast execution
  },
  {
    name: "integration", 
    testMatch: ["**/*.integration.test.ts"],
    environment: "node",
    // Integration tests: Real PGlite database
  },
  {
    name: "jsdom",
    testMatch: ["**/*.test.tsx"],
    environment: "jsdom",
    // React component tests
  }
]
```

---

## Build Tool Configurations

### 🎨 prettier.config.js
**Purpose**: Code formatting standards
**Strategy**: Simple, minimal configuration
**Philosophy**: Consistency over customization

### 🗄️ Drizzle Configurations

**drizzle.config.dev.ts**: Local development database configuration
- Connection to local Supabase instance
- Development-friendly settings

**drizzle.config.prod.ts**: Production/preview database configuration  
- Connection to hosted Supabase instance
- Production-optimized settings

### 🏗️ tooling.config.js - Centralized Patterns

**Purpose**: Single source of truth for file inclusion patterns
**Philosophy**: Explicit inclusion over exclusion
**Benefits**: Clear separation between code contexts

```javascript
export const INCLUDE_PATTERNS = {
  production: ["./src/**/*.{ts,tsx}"],     // Strictest standards
  testUtils: ["./src/test/**/*.{ts,tsx}"], // Moderate standards  
  tests: ["./src/**/*.test.{ts,tsx}"],     // Relaxed standards
  config: ["./*.config.{js,ts}"]           // Flexible standards
};
```

---

## Development Tools

### 🎭 Playwright Configuration
**Purpose**: End-to-end testing setup
**Features**: Multi-browser testing, parallel execution
**Integration**: Configured for PinPoint's authentication flows

### 📊 Coverage Configurations

**codecov.yml** & **.codecov.yml**: Dual coverage reporting
- **codecov.yml**: Primary configuration with strict thresholds
- **.codecov.yml**: Backup configuration for different CI environments

**Coverage Targets**:
- Overall: 50-60% (realistic for full-stack application)
- Server: 60-65% (business logic focus)
- Lib: 70%+ (utility functions should be well-tested)

---

## Security & Quality Tools

### 🛡️ Phase 0: Modern Security Stack

**Research-Validated Plugin Selection** (August 2025):

**✅ LOW RISK - Production Ready**:
1. **@vitest/eslint-plugin** - Official Vitest maintenance, 418K downloads
2. **@microsoft/eslint-plugin-sdl** - Corporate backing, enterprise usage

**⚠️ MEDIUM RISK - Active & Innovative**:
3. **eslint-plugin-security** - 996K downloads, community-driven
4. **@ts-safeql/eslint-plugin** - Revolutionary SQL type checking (29K downloads)

**❌ HIGH RISK - Excluded**:
- **eslint-plugin-drizzle** - Abandoned (2 years old, only 2 rules)
- **schemalint** - Low adoption (328 downloads)

### 🔍 Security Rule Categories

**SQL Injection Prevention**:
```javascript
"security/detect-sql-injection": "error",
"@microsoft/sdl/no-postmessage-star-origin": "error"
```

**Custom Database Safety**:
```javascript
// Prevents dangerous database operations
"no-restricted-syntax": ["error", { /* DELETE without WHERE */ }]
```

**Test Quality Enforcement**:
```javascript
"vitest/no-focused-tests": "error",
"vitest/no-disabled-tests": "warn"
```

---

## Memory Safety

### 🧠 Critical Memory Management

**Problem**: PGlite integration tests can cause system lockups
**Root Cause**: Multiple in-memory PostgreSQL instances (50-100MB each)
**Solution**: Three-tier memory architecture

### 📈 Memory Allocation Strategy

```javascript
// vitest.config.ts memory limits
projects: [
  {
    name: "node",
    pool: "threads", 
    poolOptions: { threads: { maxThreads: 4 } }  // 256MB total
  },
  {
    name: "integration",
    pool: "threads",
    poolOptions: { threads: { maxThreads: 2 } }  // 512MB total, limited parallelism
  }
]
```

**Worker Isolation Benefits**:
- Prevents memory blowouts between test files
- Automatic cleanup of PGlite instances
- Graceful handling of memory pressure

---

## Configuration Philosophy

### 🎯 Design Principles

**1. Context-Appropriate Standards**
- Production code: Maximum safety (`@tsconfig/strictest`)
- Test code: Pragmatic flexibility
- Build tools: Minimal constraints

**2. Explicit Over Implicit**
- File patterns explicitly defined in `tooling.config.js`
- Clear separation between code contexts
- Documented rationale for all decisions

**3. Performance Consciousness**
- Memory limits prevent system lockups
- Intelligent caching and parallelism
- Tool compatibility verified

**4. Security First**
- Modern security plugins (Phase 0)
- SQL injection prevention
- Custom Drizzle safety rules

**5. Maintainability**
- Centralized configuration patterns
- Comprehensive documentation
- Future-proof tool selection

### 🔄 Configuration Evolution

**Phase 0 (Complete)**: Modern linting tools, security hardening
**Phase 1 (Complete)**: Drizzle-only architecture
**Future**: Enhanced type safety, performance optimization

---

## Validation Commands

### ✅ Configuration Health Checks

```bash
# Verify all configurations work together
npm run typecheck  # Multi-tsconfig TypeScript compilation
npm run lint       # Multi-context ESLint with security rules
npm run test       # Three-project Vitest with memory safety
npm run build      # Next.js production build

# Memory safety verification
npm run test:integration  # PGlite tests with worker isolation

# Security validation
npm run lint:security     # Security-focused linting rules
```

### 🎯 Success Indicators

**TypeScript**: Zero compilation errors across all contexts
**ESLint**: Clean linting with security rules active
**Vitest**: All tests pass without memory issues
**Build**: Production build completes successfully

---

## Troubleshooting

### Common Configuration Issues

**TypeScript Errors in Tests**:
- Ensure test files use `tsconfig.tests.json` context
- Check that test patterns match project setup

**Memory Issues in Integration Tests**:
- Verify PGlite cleanup in test teardown
- Check worker thread limits in Vitest config

**ESLint Performance**:
- Disable type-aware rules for faster development linting
- Use `--max-warnings` flag for CI optimization

**Security Rule Conflicts**:
- Review custom Drizzle rules for false positives
- Configure progressive adoption for new security rules

---

## Future Considerations

### Planned Improvements

**Enhanced Type Safety**:
- Consider enabling additional strict TypeScript flags
- Evaluate `noUncheckedSideEffectImports` impact

**Performance Optimization**:
- Monitor ESLint performance with growing codebase
- Consider selective type-aware rule application

**Security Enhancement**:
- Evaluate @ts-safeql/eslint-plugin for production use
- Consider additional Microsoft SDL rules

---

**Last Updated**: August 2025  
**Phase**: Post-Phase 0 Configuration Excellence  
**Next Review**: Phase 2 completion