# Testing System

## Current State

**Active Tests**: 205 unit tests (1 file)  
**Commands**: `npm test`, `npm run test:rls`, `npm run smoke`  
**Status**: Minimal baseline operational

## Test Types

- **Unit**: `src/lib/common/__tests__/inputValidation.test.ts` (205 tests)
- **RLS**: pgTAP database policy validation
- **Smoke**: Essential Playwright flows

## Future System

- **[TEST_SYSTEM_REBOOT_PLAN.md](./TEST_SYSTEM_REBOOT_PLAN.md)** - 9 archetype system plan
- **[RISK_ANALYSIS.md](./RISK_ANALYSIS.md)** - Current risk assessment
- **[SERVICE_TESTS_ARCHETYPE.md](./SERVICE_TESTS_ARCHETYPE.md)** - Service testing patterns

## Archive

~130 test files archived during system reboot. Legacy patterns in `docs/deprecated/testing/`.
