# Quick Reference Navigation

Specialized tactical guides for immediate action. Auto-loaded by Claude Code for instant access.

## 🎯 Direct Conversion Context

**Context:** Solo development, pre-beta, velocity first - see [CLAUDE.md → Project Context](../../CLAUDE.md#project-context--development-phase)

---

## 🔧 Core Pattern Guides

### **Migration & Architecture**

- **[Migration Patterns](migration-patterns.md)** - Current Supabase SSR + Drizzle direct conversion workflows
- **[API Security Patterns](api-security-patterns.md)** - RLS, multi-tenant scoping, tRPC protection
- **[Testing Patterns](testing-patterns.md)** - Modern Vitest, PGlite, integration strategies

### **Language & Framework**

- **[TypeScript Strictest Patterns](typescript-strictest-patterns.md)** - Common fixes for @tsconfig/strictest

---

## 📋 Migration-Specific Guides

### **Database Conversion**

- **[Prisma → Drizzle](../migration/supabase-drizzle/quick-reference/prisma-to-drizzle.md)** - Direct conversion patterns, generated columns, relational queries

### **Authentication Migration**

- **[NextAuth → Supabase](../migration/supabase-drizzle/quick-reference/nextauth-to-supabase.md)** - SSR package patterns, Server Actions auth

### **Overall Strategy**

- **[Direct Conversion Plan](../migration/supabase-drizzle/direct-conversion-plan.md)** - Complete migration strategy and timeline

---

## 🚀 Usage Patterns

**For Immediate Problems:**

1. Check relevant pattern guide
2. Copy/adapt code example
3. Test immediately
4. Fix issues as they arise

**For Migration Work:**

1. Reference Direct Conversion Plan for strategy
2. Use specific migration guides for tactics
3. Follow incremental approach (one router at a time)

**For New Features:**

1. Check security patterns first
2. Use testing patterns for coverage
3. Apply TypeScript patterns for safety

---

## 📖 Relationship to Other Docs

**Main Documentation**: [@docs/INDEX.md](../INDEX.md) - Project overview, directory structure, getting started  
**This Directory**: Tactical patterns for immediate action (auto-loaded by Claude Code)

- **CLAUDE.md** - Context, breaking changes, Context7 directive
- **docs/latest-updates/** - Comprehensive tech stack research
- **docs/developer-guides/** - In-depth implementation guides

---

**Last Updated**: 2025-08-11
