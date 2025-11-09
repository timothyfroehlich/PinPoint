# PinPoint Documentation Guidelines for Agents

## ✅ Critical Context Files
The following files contain critical documentation context and should be read immediately:
- `docs/INDEX.md` - Documentation structure and quick start
- `docs/CORE/NON_NEGOTIABLES.md` - Critical patterns and forbidden practices
- `docs/CORE/TARGET_ARCHITECTURE.md` - Architectural authority for all decisions
- `docs/CORE/TESTING_GUIDE.md` - Testing guidelines and standards

## 📚 DOCUMENTATION STRUCTURE

### Essential Documentation
- **`docs/CORE/`** - **Most critical documentation** (NON_NEGOTIABLES, TARGET_ARCHITECTURE, etc.)
- **`docs/developer-guides/`** - Implementation guides and current patterns
- **`docs/quick-reference/`** - Auto-loaded tactical patterns
- **`docs/testing/`** - Test system reboot plan and guidelines

### Reference Documentation
- **`docs/architecture/`** - System design and current state
- **`docs/security/`** - Security patterns and audit findings
- **`docs/deployment/`** - Environment setup guides
- **`docs/design-docs/`** - Feature specifications
- **`docs/planning/`** - Roadmap and future features

### Archive
- **`docs/deprecated/`** - Legacy documentation (don't use)

## 📖 ESSENTIAL READING ORDER

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

### 4. User Requirements
- **CUJS_LIST.md** - Critical user journeys by role and release phase

### 5. Current Tech Stack
- **latest-updates/** - Post-training library updates (September 2025)
  - **quick-reference.md** - All breaking changes and new patterns
  - Individual library guides for React 19, Next.js 15, Tailwind v4, etc.

## 🗂️ FEATURE SPECIFICATIONS (docs/feature_specs)

### Purpose
Provide a consistent, reviewable spec for each user‑visible feature. These specs are living documents and MUST be kept current as behavior changes.

### Required Structure (in order)
1. **Feature overview** (one paragraph)
2. **Last reviewed / Last updated** (ISO date)
3. **Key source files** (paths + brief purpose)
4. **Detailed feature spec** (capabilities & behavior)
5. **Security / RLS spec** (link to CORE docs; summarize effective rules)
6. **Test spec** (pyramid: unit → integration → E2E; include acceptance criteria)
7. **Associated test files** (current + planned paths)

### Authoring Rules
- **Single source of truth**: Specs must reflect the current code. If you make behavior changes, update the spec in the same PR
- **Review freshness**: Update "Last reviewed" after verification. Per CORE policy, content older than 5 days must be re‑verified before use
- **Cross‑reference**: Link relevant constraints in `docs/CORE/` (e.g., `DATABASE_SECURITY_SPEC.md`, `NON_NEGOTIABLES.md`)
- **Paths over prose**: Prefer listing concrete file paths and exported symbols over vague descriptions

### Naming & Location
- One feature per file under `docs/feature_specs/`
- Filename: kebab‑case, e.g., `issue-creation.md`
- Keep related assets (small diagrams, screenshots) alongside the spec using the same kebab prefix

### Test Spec Expectations
- Follow the testing pyramid: many unit tests for pure logic; fewer integration tests for DAL/tRPC; E2E for full journeys
- Follow `docs/CORE/TESTING_GUIDE.md` for test type selection, naming, placement, and templates
- Use shared seed constants and helpers; avoid ad‑hoc patterns

### PR & Review Policy
- Any PR changing a feature's behavior MUST update its spec (and bump Last updated/reviewed)
- Reviewers should reject behavior‑changing PRs without corresponding spec updates
- When introducing a new feature, include its spec in the same PR

## 🔍 USAGE PATTERNS

**Before any changes**: Read NON_NEGOTIABLES.md for forbidden patterns
**Architecture decisions**: Consult TARGET_ARCHITECTURE.md as authority
**TypeScript errors**: Reference TYPESCRIPT_STRICTEST_PATTERNS.md
**Library usage**: Check latest-updates/ for current patterns (training cutoff January 2025)
**User features**: Validate against CUJS_LIST.md requirements

## ⚠️ REVIEW REQUIREMENTS

**CRITICAL**: Any CORE document not reviewed within 5 days requires review to ensure consistency with current codebase state. Update "Last Reviewed" date after verification.

## 📋 DOCUMENTATION PHILOSOPHY

- Actionable information only, no justifications or selling points
- Focus on "what" and "how", not "why" something is beneficial
- No marketing language, performance claims, or convincing explanations
- Designed for efficient LLM consumption, context reminders without persuasion
- Scope of changes matters, not time estimates or session planning

## 🗂 CURRENT_TASK + Docs Handoff

- `CURRENT_TASK.md` is branch-specific documentation. When you start a new branch, reset the heading, Branch Snapshot, and task board so they only cover that branch.
- Document work-in-flight in `CURRENT_TASK.md` and mirror any behavior changes in the relevant spec under `docs/feature_specs/`. The spec is the long-term authority; `CURRENT_TASK.md` is the short-term ledger.
- When handing off a branch, ensure `CURRENT_TASK.md` lists the next steps, verification commands, and any doc sections that still need updates. The incoming agent should be able to resume work by reading that file first.

**USAGE**: This serves as the documentation-specific agent context for PinPoint development. Always prioritize CORE documentation and maintain feature specs as living documents.
