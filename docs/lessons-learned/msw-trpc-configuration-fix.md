# Lessons Learned: MSW-tRPC Configuration Fix

## Problem Summary
All PrimaryAppBar tests were failing with "links is not iterable" error when trying to use MSW-tRPC handlers for mocking tRPC calls.

## Initial Diagnosis
- Error occurred during MSW-tRPC handler creation in test setup
- All 22 PrimaryAppBar tests failing with the same error
- Error traced to `setupMSWHandlers` function in VitestTestWrapper calling `handlers.mockUserWithPermissions()`

## Root Cause Investigation

### Attempt 1: Hardcoded baseUrl Issue
**Hypothesis**: The MSW setup had a hardcoded `baseUrl: "http://localhost:3000"` which didn't match the expected tRPC endpoint.

**Approach**: 
- Updated to use environment-based URL construction
- Fixed TypeScript strict mode issues (array access, function return types)

**Result**: Still failed - discovered `baseUrl` property doesn't exist in `TRPCMswConfig` type

### Attempt 2: Transformer Configuration Mismatch
**Hypothesis**: The transformer configuration structure was incorrect.

**Approach**:
- Tried to match production client transformer setup
- Used `{ input: superjson, output: superjson }` structure

**Result**: TypeScript error - `baseUrl` still not recognized as valid property

### Attempt 3: Version Compatibility Analysis
**Discovery**: MSW-tRPC v2.0.1 uses a different configuration structure than documentation suggested.

**Investigation**:
- Checked actual TypeScript definitions in `node_modules/msw-trpc/dist/types.d.ts`
- Found `TRPCMswConfig` interface only accepts:
  - `links: Link[]` (required)
  - `transformer?: TRPCCombinedDataTransformer` (optional)
- No `baseUrl` or `basePath` properties exist in this version

**Solution in Progress**:
- Use `httpLink` from msw-trpc to create proper links configuration
- Structure: `links: [httpLink({ url: getTestBaseUrl() })]`

## Key Learnings

1. **Documentation vs Reality**: Documentation may not match the actual version being used
2. **TypeScript Definitions are Truth**: When in doubt, check the actual `.d.ts` files in node_modules
3. **Version-Specific APIs**: MSW-tRPC v2.0.1 has a different API than what online documentation might show
4. **Links-based Configuration**: Modern MSW-tRPC uses a links array similar to tRPC client configuration

## Configuration Patterns

### Incorrect (Pre-v2.0.1 style):
```typescript
export const trpcMsw = createTRPCMsw<AppRouter>({
  baseUrl: "http://localhost:3000/api/trpc",
  transformer: { input: superjson, output: superjson }
});
```

### Correct (v2.0.1 style):
```typescript
import { createTRPCMsw, httpLink } from "msw-trpc";

export const trpcMsw = createTRPCMsw<AppRouter>({
  links: [httpLink({ url: getTestBaseUrl() })],
  transformer: { input: superjson, output: superjson }
});
```

## ✅ SOLUTION IMPLEMENTED

### Final Working Configuration

**MSW-tRPC Setup** (`/src/test/msw/setup.ts`):
```typescript
import { setupServer } from "msw/node";
import { createTRPCMsw, httpLink } from "msw-trpc";
import superjson from "superjson";

function getTestBaseUrl(): string {
  const port = process.env['PORT'] ?? "3000";
  return `http://localhost:${port}/api/trpc`;
}

export const trpcMsw = createTRPCMsw<AppRouter>({
  links: [httpLink({ url: getTestBaseUrl() })],
  transformer: {
    input: superjson,
    output: superjson,
  },
});
```

**VitestTestWrapper** (`/src/test/VitestTestWrapper.tsx`):
```typescript
import { httpBatchStreamLink, loggerLink } from "@trpc/client";

const [trpcClient] = useState(() =>
  api.createClient({
    links: [
      loggerLink({ enabled: () => false }),
      httpBatchStreamLink({
        transformer: superjson,
        url: `http://localhost:${process.env['PORT'] ?? '3000'}/api/trpc`,
        headers: () => {
          const headers = new Headers();
          headers.set("x-trpc-source", "vitest-test");
          return headers;
        },
      }),
    ],
  }),
);
```

### ✅ VERIFICATION RESULTS

**SUCCESS**: The "links is not iterable" error is completely resolved!

- MSW-tRPC handlers are now being created successfully
- tRPC client configuration matches production patterns
- Tests are running without MSW setup errors

**NEW DISCOVERY**: Tests are now failing on different issues (component behavior, not MSW setup):
- PrimaryAppBar tests expect "Issues" and "Games" buttons but component only renders "Dashboard" button
- This indicates either permission logic changes or test expectation mismatches
- This is a separate issue from the MSW-tRPC configuration problem

## Next Steps
- [x] Apply the correct links-based configuration ✅
- [x] Verify the fix resolves the "links is not iterable" error ✅  
- [x] Update VitestTestWrapper to use matching tRPC client configuration ✅
- [x] Document the correct pattern for future developers ✅
- [ ] **NEW**: Investigate PrimaryAppBar component navigation button rendering logic

## Prevention
- Always check TypeScript definitions when upgrading packages
- Create integration tests for MSW setup to catch configuration breaks early
- Document version-specific configuration patterns in project docs