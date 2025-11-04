---
applyTo: "src/app/**/*.tsx,src/components/**/*.tsx"
---

# Component Development Instructions

## Server Components vs Client Components

### Default to Server Components (CORE)

- **ALWAYS** prefer Server Components unless interactivity is required
- Server Components are the default in Next.js 15 App Router
- Only add `"use client"` directive when necessary for:
  - Event handlers (onClick, onChange, etc.)
  - Browser APIs (window, document, localStorage)
  - React hooks (useState, useEffect, useContext, etc.)
  - Third-party libraries requiring client-side execution

### Server Component Patterns

**Organization Context (CRITICAL)**:

```typescript
// ✅ Server Component receiving organization context
async function IssueList({ organizationId }: { organizationId: string }) {
  const issues = await getIssuesByOrganization(organizationId);
  return <div>...</div>;
}

// ❌ Server Component without org context (security violation)
async function IssueList() {
  const issues = await getAllIssues(); // FORBIDDEN: No org scoping
  return <div>...</div>;
}
```

**Data Fetching with Cache**:

```typescript
import { cache } from "react";

// ✅ Cached data fetcher
const getIssues = cache(async (organizationId: string) => {
  return await db.query.issues.findMany({
    where: eq(issues.organizationId, organizationId),
  });
});
```

### Client Component Patterns

**Minimal Client Islands**:

```typescript
// ✅ Small, focused client component
"use client";

export function FilterButton({ onFilter }: { onFilter: (filter: string) => void }) {
  return <button onClick={() => onFilter("active")}>Filter</button>;
}

// ❌ Entire page as client component when only button needs interactivity
"use client"; // AVOID: This makes the entire page client-side
export default function IssuesPage() { ... }
```

**Server + Client Hybrid**:

```typescript
// ✅ Server Component shell with Client Component island
async function IssuesPage({ organizationId }: { organizationId: string }) {
  const issues = await getIssues(organizationId);
  return (
    <div>
      <IssueList issues={issues} /> {/* Server Component */}
      <FilterToolbarClient /> {/* Client Component for interactivity */}
    </div>
  );
}
```

## Component Organization

### File Naming

- **PascalCase** for component files: `IssueCard.tsx`, `ProfilePictureUpload.tsx`
- **Client-only suffix**: `-client.tsx` for pure client components
- **Server-only suffix**: Not needed (default is server)

### Import Patterns

- **ALWAYS use `~/` path aliases**, never deep relative imports
- `~/lib/types` for shared types
- `~/lib/utils` for utilities
- `~/server/db` for database access (Server Components only)

```typescript
// ✅ Correct imports
import { IssueFilters } from "~/lib/types";
import { cn } from "~/lib/utils";

// ❌ Wrong: Deep relative imports
import { IssueFilters } from "../../../lib/types";
```

## UI Framework Standards

### shadcn/ui ONLY

- **REQUIRED**: Use shadcn/ui for all new UI components
- **FORBIDDEN**: New Material UI components
- Use Material Design 3 colors from `globals.css`

```typescript
// ✅ shadcn/ui components
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";

// ❌ No new MUI components
import { Button } from "@mui/material"; // FORBIDDEN
```

## Type Safety

### Props Typing

```typescript
// ✅ Explicit props interface
interface IssueCardProps {
  issue: Issue;
  organizationId: string;
  onUpdate?: (id: string) => void; // Optional callback
}

export function IssueCard({ issue, organizationId, onUpdate }: IssueCardProps) {
  // Implementation
}

// ❌ Inline type without interface
export function IssueCard({ issue }: { issue: any }) {
  // FORBIDDEN: any
  // Implementation
}
```

### No TypeScript Safety Defeats

- **FORBIDDEN**: `any` type
- **FORBIDDEN**: Non-null assertion `!`
- **FORBIDDEN**: Unsafe `as` casting
- **REQUIRED**: Proper type guards and null checks

## Error Handling

### Error Boundaries

- Server Components should have `error.tsx` boundaries
- Use structured error types from `~/lib/errors`
- Never expose internal details to users

```typescript
// error.tsx
"use client";

export default function IssueError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

## Accessibility

- Use semantic HTML elements
- Add proper ARIA labels for interactive elements
- Ensure keyboard navigation works
- Maintain color contrast for readability

## Performance

- Use React 19 `cache()` for server-side data fetching
- Implement loading states with `loading.tsx`
- Lazy load heavy client components when possible
- Avoid unnecessary re-renders in client components
