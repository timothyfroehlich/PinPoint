# Task 01: Move Frontend Code Out of Compilation

## Prerequisites

**REQUIRED**: Read and understand `docs/planning/backend_impl_plan.md` before starting this task.

## Workflow

- **Base Branch**: `feature/phase-1a-backend-refactor`
- **Task Branch**: `task/01-move-frontend-out-compilation`
- **PR Target**: `feature/phase-1a-backend-refactor` (NOT main)

## Dependencies

- Task 00 (Feature Branch Setup) must be completed
- No other task dependencies (can run in parallel with Task 02)

## Objective

Move existing frontend components and pages out of the compilation path to prevent build errors during the backend refactor. This allows us to preserve the existing code as reference while rebuilding the frontend from scratch.

## Status

- [x] In Progress
- [x] Completed

## Implementation Steps

### 1. Create Archive Directory

```bash
mkdir -p src/_archived_frontend
```

### 2. Move Frontend GUI Components (Batch Operation)

```bash
# Move React components directory (all GUI components)
mv src/app/_components src/_archived_frontend/
```

### 3. Move GUI Pages and Core Layout Files

```bash
# Move GUI page directories and core layout files
mv src/app/admin src/_archived_frontend/
mv src/app/issues src/_archived_frontend/
mv src/app/location src/_archived_frontend/
mv src/app/profile src/_archived_frontend/
mv src/app/sign-in src/_archived_frontend/
mv src/app/signup src/_archived_frontend/
mv src/app/layout.tsx src/_archived_frontend/
mv src/app/page.tsx src/_archived_frontend/
mv src/app/providers.tsx src/_archived_frontend/
```

### 4. Move Frontend-Specific Libraries and Config

```bash
# Move frontend-specific libraries (PRESERVE backend libraries like OPDB, PinballMap)
mv src/lib/hooks src/_archived_frontend/
mv src/trpc/react.tsx src/_archived_frontend/
mv src/trpc/query-client.ts src/_archived_frontend/
mv src/styles src/_archived_frontend/

# Move frontend config and tests
mv tests src/_archived_frontend/
mv playwright.config.ts src/_archived_frontend/
mv next.config.js src/_archived_frontend/
mv postcss.config.js src/_archived_frontend/

# Restore server-side query-client (needed for SSR)
cp src/_archived_frontend/query-client.ts src/trpc/query-client.ts
```

### 5. Update TypeScript Configuration

Edit `tsconfig.json` to exclude archived frontend:

```json
{
  "exclude": ["node_modules", "scripts/**/*.cjs", "src/_archived_frontend/**/*"]
}
```

### 6. Update ESLint Configuration

Add archive directory to ESLint ignores in `eslint.config.js`:

```js
{
  // Global ignores
  ignores: [
    ".next/",
    "node_modules/",
    "drizzle/",
    "src/_archived_frontend/**/*",  // <- Add this line
    "eslint.config.js",
    "prettier.config.js",
    "next.config.js",
    "postcss.config.js",
    "tailwind.config.ts",
  ],
}
```

### 7. Create Minimal Replacement Frontend

Create new minimal `src/app/layout.tsx`:

```tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div>Backend Refactor In Progress</div>
        {children}
      </body>
    </html>
  );
}
```

Create new `src/app/page.tsx`:

```tsx
export default function HomePage() {
  return (
    <main>
      <h1>PinPoint Backend Refactor</h1>
      <p>Frontend being rebuilt. Check back soon!</p>
    </main>
  );
}
```

Create minimal `src/app/providers.tsx`:

```tsx
import { type ReactNode } from "react";

export default function Providers({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
```

## Manual Cleanup Required

After batch operations, manually check for:

- [ ] Any remaining TypeScript errors in build
- [ ] Missing dependencies that can be removed from package.json
- [ ] Tailwind classes or other UI dependencies that may cause warnings

## Validation Steps

```bash
# Test that build succeeds
npm run build

# Verify no TypeScript errors
npm run typecheck

# Check that archived files are preserved
ls -la src/_archived_frontend/
```

## Progress Notes

<!-- Agent: Update this section with implementation decisions and complexity encountered -->

### Implementation Decisions Made:

- Preserved OPDB and PinballMap libraries in `src/lib/` as these are backend integrations, not frontend-specific
- Restored `src/trpc/query-client.ts` from archive as it's needed for server-side rendering
- Updated ESLint config to exclude archived files from linting to prevent build warnings
- Created minimal replacement files rather than empty files to maintain Next.js structure

### Unexpected Complexity:

- Query client was needed for both client and server, required restoration for SSR functionality
- ESLint flat config required updating ignores pattern to exclude archived frontend files
- Next.js cache needed clearing after moving files to prevent stale references

### Notes for Later Tasks:

- All frontend GUI components preserved in `src/_archived_frontend/` for reference during rebuild
- Backend APIs, database, and external service integrations (OPDB, PinballMap) remain fully functional
- Playwright tests archived with frontend - Task 02 may be automatically completed
- TypeScript and build validation passing - ready for schema refactor tasks

## Rollback Procedure

If issues arise:

```bash
# Restore archived frontend
mv src/_archived_frontend/* src/components/
mv src/_archived_frontend/pages/* src/app/
git checkout HEAD -- tsconfig.json
```
