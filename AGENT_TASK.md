# Checkout: Anonymous Issue Reporting via QR Codes

## Source

- **Type**: PR #170
- **Branch**: task/issue-reporting
- **Author**: Tim Froehlich
- **Status**: OPEN (mergeable)
- **Title**: feat: implement anonymous issue reporting via QR codes

## Environment Setup

- ✅ Worktree created at: `/var/home/froeht/Code/PinPoint/worktrees/issue-reporting-pr170`
- ✅ Dependencies installed and built successfully
- ✅ Database connectivity verified (shared dev database)
- ✅ Development server can start (port 61868)
- ✅ TypeScript compilation passes
- ✅ ESLint/Prettier formatting passes
- ⚠️ Tests partially failing (15/580 failing - expected per CI status)

## Current State

### CI Status Summary

- **Passing**: TypeScript, ESLint, Prettier, Security, CodeQL, Vercel deployment
- **Failing**: Tests (15 failing), E2E tests (5 test suites failing)
- **Overall**: 13/20 checks passing, 7/20 failing

### Test Issues Identified

- Component tests failing for MachineDetailView, GameInstanceChip, LocationStatsSummary, etc.
- Hook tests failing (usePermissions.test.tsx has tRPC fetch errors)
- MUI warnings about out-of-range select values in IssueList tests
- OAuth warnings for missing Google credentials (expected in worktree)

### Environment Health

- **Development Server**: ✅ Starts successfully on port 61868
- **Database**: ✅ Connected to shared development database
- **TypeScript**: ✅ No compilation errors
- **Lint/Format**: ✅ All checks pass
- **Unique Ports**: Next.js (61868), Prisma Studio (61869), Database (61870)

## Ready for Agent Work

Environment is fully functional for development work. The test failures are consistent with the PR's current CI status and represent the main work needed to get this feature branch ready for merge.

Key areas that likely need attention:

1. Fix failing component tests
2. Resolve E2E test issues
3. Address tRPC fetch errors in hook tests
4. Fix MUI select component warnings

**Recommended approach**: Focus on the test failures first, then verify the anonymous issue reporting functionality works as intended.

---

_Environment setup complete. Ready for manual agent dispatch with appropriate task instructions._
