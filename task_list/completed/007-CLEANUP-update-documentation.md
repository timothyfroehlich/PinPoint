# Task 007: Update Documentation for API Changes

**Priority**: LOW  
**Category**: Documentation  
**Status**: Not Started  
**Dependencies**: Tasks 001-002 (API removal)

## Problem

After removing API routes and consolidating on tRPC, documentation needs updates:

- Remove references to deleted API routes
- Document remaining legitimate API routes
- Update developer guides
- Add security best practices

## Current State

- Documentation references old API routes
- No clear guidance on when to use API vs tRPC
- Missing security documentation
- Outdated architecture diagrams

## Solution

Systematically update all documentation to reflect the new architecture.

## Implementation Steps

### 1. Document Legitimate API Routes

Create `docs/architecture/api-routes.md`:

- List all remaining API routes
- Explain why each exists (can't use tRPC)
- Document security considerations
- Add examples of proper usage

Legitimate routes:

- `/api/auth/[...nextauth]` - NextAuth requirement
- `/api/trpc/[trpc]` - tRPC handler
- `/api/health` - Monitoring requirement
- `/api/qr/[qrCodeId]` - HTTP redirect for QR codes
- `/api/dev/users` - Development utility

### 2. Update Architecture Documentation

Update `docs/architecture/current-state.md`:

- Remove references to deleted API routes
- Add section on API strategy (tRPC-only)
- Update diagrams

### 3. Create Security Guidelines

Create `docs/security/api-security.md`:

- Why we use tRPC exclusively
- Permission checking patterns
- Common security pitfalls
- Testing security

### 4. Update Developer Guides

Search and update:

```bash
rg -t md "/api/" docs/
```

### 5. Add Migration Guide

Create `docs/migration/api-to-trpc.md`:

- How to convert API routes to tRPC
- Permission integration
- Testing patterns

## Success Criteria

- [ ] All legitimate API routes documented
- [ ] No references to deleted routes
- [ ] Security guidelines created
- [ ] Developer guides updated
- [ ] Migration guide available

## References

### Core Documentation

- Core objectives: `task_list/README.md`
- Original analysis: `TASK_LIST.md`

### Documentation to Update

- `docs/architecture/current-state.md`
- `docs/architecture/source-map.md`
- `docs/developer-guides/`
- `CLAUDE.md` - Add API strategy note

### Documentation to Create

- `docs/architecture/api-routes.md`
- `docs/security/api-security.md`
- `docs/migration/api-to-trpc.md`

### Search Commands

```bash
# Find all API route references
rg -t md "/api/" docs/

# Find fetch/axios usage examples
rg -t md "fetch|axios" docs/

# Find outdated examples
rg -t md "app/api" docs/
```
