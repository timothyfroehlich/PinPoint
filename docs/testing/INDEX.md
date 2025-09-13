# Testing System

## Current State

**Active Tests**: Unit, Integration, RLS, and E2E smoke in place  
**Commands**: `npm test`, `npm run test:rls`, `npm run smoke`  
**Status**: Operational baseline; see CORE Testing Guide for standards

## Test Types

- **Unit**: `src/lib/common/__tests__/inputValidation.test.ts` (205 tests)
- **RLS**: pgTAP database policy validation
- **Smoke**: Essential Playwright flows

## Guidance

- **Authoritative Guide**: `docs/CORE/TESTING_GUIDE.md`
- **Quick Reference**: `docs/CORE/TESTING_QUICK_REFERENCE.md`

## Archive

Legacy patterns were archived during a prior reboot. Use the CORE Testing Guide going forward.
