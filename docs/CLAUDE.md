@AGENTS.md

## 🤖 CLAUDE CODE DOCUMENTATION FEATURES

### Essential Reading Order for Claude Code

When working on PinPoint documentation, reference CORE documentation in this priority order using @ syntax for auto-loading:

### 1. Critical Constraints (Auto-Load)
- **@NON_NEGOTIABLES.md** - Forbidden patterns that MUST be enforced
- **@DATABASE_SECURITY_SPEC.md** - RLS policies and multi-tenant security rules

### 2. Architecture Authority (Manual Reference)
- **TARGET_ARCHITECTURE.md** - Complete architectural blueprint (too large to auto-load)
- **TARGET_ARCHITECTURE_CONDENSED.md** - Quick reference for common patterns

### 3. Implementation Patterns (Auto-Load)
- **@TYPESCRIPT_STRICTEST_PATTERNS.md** - Type safety patterns for @tsconfig/strictest
- **@TYPE_INVENTORY.md** - Type Ownership Matrix and import reference for ~/lib/types

### 4. Current Tech Stack (Manual Reference)
- **latest-updates/** - Post-training library updates (September 2025)
  - **quick-reference.md** - All breaking changes and new patterns
  - Individual library guides for React 19, Next.js 15, Tailwind v4, etc.

## 📋 CLAUDE CODE USAGE PATTERNS

**Before any changes**: Read @NON_NEGOTIABLES.md for forbidden patterns
**Architecture decisions**: Consult TARGET_ARCHITECTURE.md as authority
**TypeScript errors**: Reference @TYPESCRIPT_STRICTEST_PATTERNS.md
**Library usage**: Check latest-updates/ for current patterns (training cutoff January 2025)
**User features**: Validate against CUJS_LIST.md requirements

**USAGE**: This serves as the Claude Code specific documentation context. The @AGENTS.md file provides general documentation guidelines for any AI agent.