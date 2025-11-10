# PinPoint CORE Documentation Instructions

**Last Updated**: Unknown  
**Last Reviewed**: Unknown  

## Essential Reading Order

When working on PinPoint, reference CORE documentation in this priority order:

### 1. Critical Constraints
- **NON_NEGOTIABLES.md** - Forbidden patterns that MUST be enforced
- **DATABASE_SECURITY_SPEC.md** - RLS policies and multi-tenant security rules

### 2. Architecture Authority  
- **TARGET_ARCHITECTURE.md** - Complete architectural blueprint (comprehensive)
- **TARGET_ARCHITECTURE_CONDENSED.md** - Quick reference for common patterns

### 3. Implementation Patterns
- **TYPESCRIPT_STRICTEST_PATTERNS.md** - Type safety patterns for @tsconfig/strictest
- **TYPE_INVENTORY.md** - Type Ownership Matrix and import reference for ~/lib/types
- **MULTI_CONFIG_STRATEGY.md** - Multi-tier TypeScript/ESLint configuration system

### 4. User Requirements
- **CUJS_LIST.md** - Critical user journeys by role and release phase

### 5. Current Tech Stack
- **latest-updates/** - Post-training library updates (August 2025)
  - **quick-reference.md** - All breaking changes and new patterns
  - Individual library guides for React 19, Next.js 15, Tailwind v4, etc.

## Usage Patterns

**Before any changes**: Read NON_NEGOTIABLES.md for forbidden patterns  
**Architecture decisions**: Consult TARGET_ARCHITECTURE.md as authority  
**TypeScript errors**: Reference TYPESCRIPT_STRICTEST_PATTERNS.md  
**Library usage**: Check latest-updates/ for current patterns (training cutoff January 2025)  
**User features**: Validate against CUJS_LIST.md requirements  

## Review Requirements

**CRITICAL**: Any CORE document not reviewed within 5 days requires review to ensure consistency with current codebase state. Update "Last Reviewed" date after verification.

This documentation represents the authoritative source for all PinPoint development decisions.