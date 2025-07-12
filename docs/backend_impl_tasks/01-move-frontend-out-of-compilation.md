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

- [ ] In Progress
- [ ] Completed

## Implementation Steps

### 1. Create Archive Directory

```bash
mkdir -p src/_archived_frontend
```

### 2. Move Frontend Components (Batch Operation)

```bash
# Move all components except core infrastructure
find src/app -name "*.tsx" -not -path "*/layout.tsx" -not -path "*/loading.tsx" -not -path "*/error.tsx" | xargs -I {} mv {} src/_archived_frontend/
find src/components -type f | xargs -I {} mv {} src/_archived_frontend/
```

### 3. Move Pages and Routes

```bash
# Move app router pages but preserve core layout
find src/app -type d -mindepth 1 -not -name "_*" | while read dir; do
  if [ -f "$dir/page.tsx" ]; then
    mv "$dir" src/_archived_frontend/
  fi
done
```

### 4. Update TypeScript Configuration

Edit `tsconfig.json` to exclude archived frontend:

```json
{
  "exclude": ["node_modules", ".next", "src/_archived_frontend/**/*"]
}
```

### 5. Create Minimal Layout

Create a new minimal `src/app/layout.tsx`:

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

### 6. Create Placeholder Page

Create `src/app/page.tsx`:

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

-

### Unexpected Complexity:

-

### Notes for Later Tasks:

-

## Rollback Procedure

If issues arise:

```bash
# Restore archived frontend
mv src/_archived_frontend/* src/components/
mv src/_archived_frontend/pages/* src/app/
git checkout HEAD -- tsconfig.json
```
