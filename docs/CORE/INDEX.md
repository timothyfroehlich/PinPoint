# PinPoint CORE Documentation Index

**Last Updated**: Unknown  
**Last Reviewed**: Unknown  

## Purpose
This directory contains PinPoint's most critical documentation - the foundational reference materials that guide all development decisions.

## Quick Navigation

### 🚨 Critical Constraints
| File | Purpose | When to Read |
|------|---------|--------------|
| **NON_NEGOTIABLES.md** | Forbidden patterns enforced by static analysis | Before any code changes |
| **DATABASE_SECURITY_SPEC.md** | RLS policies and multi-tenant security rules | When working with data access |

### 🏗️ Architecture Authority
| File | Purpose | When to Read |
|------|---------|--------------|
| **TARGET_ARCHITECTURE.md** | Complete architectural blueprint (1800+ lines) | For comprehensive system understanding |
| **TARGET_ARCHITECTURE_CONDENSED.md** | Essential patterns quick reference | For daily development reference |

### ⚙️ Implementation Patterns  
| File | Purpose | When to Read |
|------|---------|--------------|
| **TYPESCRIPT_STRICTEST_PATTERNS.md** | Type safety patterns for @tsconfig/strictest | When fixing TypeScript errors |
| **MULTI_CONFIG_STRATEGY.md** | Multi-tier TypeScript/ESLint configuration | When modifying build configuration |

### 👤 User Requirements
| File | Purpose | When to Read |
|------|---------|--------------|
| **CUJS_LIST.md** | Critical user journeys by role and release phase | When building user-facing features |

### 📚 Current Tech Stack
| Directory | Purpose | When to Read |
|-----------|---------|--------------|
| **latest-updates/** | Post-training library updates (August 2025) | When using any external library |

## Review Status

**⚠️ IMPORTANT**: Documents not reviewed within 5 days require verification against current codebase state.

| Document | Last Updated | Last Reviewed | Status |
|----------|--------------|---------------|--------|
| NON_NEGOTIABLES.md | Unknown | Unknown | 🔍 Needs Review |
| TARGET_ARCHITECTURE.md | Unknown | Unknown | 🔍 Needs Review |
| TARGET_ARCHITECTURE_CONDENSED.md | Unknown | Unknown | 🔍 Needs Review |
| TYPESCRIPT_STRICTEST_PATTERNS.md | Unknown | Unknown | 🔍 Needs Review |
| DATABASE_SECURITY_SPEC.md | Unknown | Unknown | 🔍 Needs Review |
| MULTI_CONFIG_STRATEGY.md | Unknown | Unknown | 🔍 Needs Review |
| CUJS_LIST.md | Unknown | Unknown | 🔍 Needs Review |

## Usage Guidelines

1. **Always check NON_NEGOTIABLES.md first** - Prevents architectural violations
2. **Use TARGET_ARCHITECTURE.md as final authority** - All decisions must align
3. **Reference latest-updates/ for current library patterns** - Training cutoff January 2025
4. **Update review dates after verification** - Maintain documentation freshness

This is the single source of truth for PinPoint development.