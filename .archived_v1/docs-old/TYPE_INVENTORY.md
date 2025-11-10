# Type Ownership Matrix & Import Reference

**Last Updated**: September 1, 2025  
**Last Reviewed**: September 1, 2025

**Status:** Reflects completed types consolidation (WS-01 through WS-07)

## Quick Reference

**✅ ALWAYS:** Import types from `~/lib/types`  
**❌ NEVER:** Import types directly from implementation modules  
**🔧 VALUES:** Import functions/values from their implementation modules

```typescript
// ✅ Correct type imports
import type {
  IssueResponse,
  MachineFilters,
  OrganizationContext,
} from "~/lib/types";

// ❌ Avoid direct imports
import type { IssueResponse } from "~/lib/dal/issues"; // Wrong!
import type { OrganizationContext } from "~/lib/organization-context"; // Wrong!

// ✅ Correct value imports (unchanged)
import { getIssues } from "~/lib/dal/issues";
import { requireMemberAccess } from "~/lib/organization-context";
```

---

## Type Ownership Matrix

| Type Category          | Owner Module              | Access Pattern                           | Examples                                                               |
| ---------------------- | ------------------------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| **Domain/API Types**   | `~/lib/types/api.ts`      | `import type { ... } from "~/lib/types"` | `IssueResponse`, `MachineResponse`, `LocationResponse`, `UserResponse` |
| **Filter/DTO Types**   | `~/lib/types/filters.ts`  | `import type { ... } from "~/lib/types"` | `IssueFilters`, `MachineFilters`                                       |
| **Auth Types**         | `~/lib/types/auth.ts`     | `import type { ... } from "~/lib/types"` | `OrganizationContext`, `PinPointSupabaseUser`, `SupabaseSession`       |
| **Search Params**      | `~/lib/types/search.ts`   | `import type { ... } from "~/lib/types"` | `IssueSearchParams`, `MachineSearchParams`                             |
| **DB Model Types**     | `~/lib/types/db.ts`       | `import type { Db } from "~/lib/types"`  | `Db.Issue`, `Db.User`, `Db.Machine` (server-only)                      |
| **Supabase Generated** | `~/lib/types/supabase.ts` | `import type { ... } from "~/lib/types"` | `Database`, `Tables`, `Json`                                           |
| **Utility Types**      | `~/lib/types/utils.ts`    | `import type { ... } from "~/lib/types"` | `DrizzleToCamelCase`, `CamelCased`                                     |
| **Guard Types**        | `~/lib/types/guards.ts`   | `import type { ... } from "~/lib/types"` | `ValidationResult<T>`, `OperationResult<T>`                            |

---

## Module Import Rules

### App Code (Components, Pages, Layouts)

```typescript
// ✅ Single import path for all types
import type {
  IssueResponse,
  MachineFilters,
  OrganizationContext,
} from "~/lib/types";

// ✅ Value imports remain unchanged
import { requireMemberAccess } from "~/lib/organization-context";
import { parseIssueSearchParams } from "~/lib/search-params/issue-search-params";
```

### Server Code (API Routers, DAL, Services)

```typescript
// ✅ Domain types from central barrel
import type { RoleResponse, PermissionResponse } from "~/lib/types";

// ✅ DB types via Db namespace (server-only)
import type { Db } from "~/lib/types";
// Usage: Db.Role, Db.Permission, etc.

// ✅ Value imports remain unchanged
import { db } from "~/server/db/drizzle";
import { roles } from "~/server/db/schema";
```

### Type-Only Modules (`src/lib/types/**`)

```typescript
// ✅ Re-export from authoritative sources
export type { IssueResponse } from "~/lib/dal/issues"; // If owned by DAL
export type { OrganizationContext } from "~/lib/organization-context";

// ✅ Generated type re-exports
export type * from "~/types/supabase";
export type * as Db from "~/server/db/types";
```

---

## Canonical Type Locations

### Domain/API Types (`~/lib/types/api.ts`)

| Type                         | Description                        | Usage                     |
| ---------------------------- | ---------------------------------- | ------------------------- |
| `IssueResponse`              | Standard issue object (camelCase)  | API responses, components |
| `IssueWithRelationsResponse` | Issue with nested relations        | Detail pages, full data   |
| `MachineResponse`            | Standard machine object            | API responses, lists      |
| `MachineForIssues`           | Simplified machine for issue forms | Issue creation, selection |
| `LocationResponse`           | Location object                    | Location features         |
| `UserResponse`               | User profile object                | User displays, selections |
| `RoleResponse`               | Role with permissions              | Role management           |
| `ModelResponse`              | Machine model data                 | Model selection, details  |

### Filter Types (`~/lib/types/filters.ts`)

| Type             | Description                     | DAL Compatibility                    |
| ---------------- | ------------------------------- | ------------------------------------ |
| `IssueFilters`   | Issue filtering/sorting options | `status[]`, `priority[]` arrays      |
| `MachineFilters` | Machine filtering options       | `locationIds[]`, `modelIds[]` arrays |

### Auth Types (`~/lib/types/auth.ts`)

| Type                          | Source Module                | Description             |
| ----------------------------- | ---------------------------- | ----------------------- |
| `OrganizationContext`         | `~/lib/organization-context` | App-level org context   |
| `SupabaseOrganizationContext` | `~/lib/supabase/types`       | JWT payload org context |
| `PinPointSupabaseUser`        | `~/lib/supabase/types`       | Enhanced Supabase user  |
| `SupabaseSession`             | `@supabase/supabase-js`      | Supabase session        |
| `AuthResult<T>`               | `~/lib/supabase/types`       | Auth operation results  |

### Search Params (`~/lib/types/search.ts`)

| Type                  | Source Schema                               | Description                   |
| --------------------- | ------------------------------------------- | ----------------------------- |
| `IssueSearchParams`   | `~/lib/search-params/issue-search-params`   | URL state for issue filters   |
| `MachineSearchParams` | `~/lib/search-params/machine-search-params` | URL state for machine filters |

### Database Types (`~/lib/types/db.ts`)

```typescript
// Server-only namespace access
import type { Db } from "~/lib/types";

// Usage examples:
type User = Db.User; // Snake_case user from schema
type Issue = Db.Issue; // Snake_case issue from schema
type Machine = Db.Machine; // Snake_case machine from schema
```

---

## Anti-Patterns to Avoid

### ❌ Direct Type Imports

```typescript
// ❌ Don't import types directly
import type { IssueResponse } from "~/server/api/routers/issue";
import type { MachineFilters } from "~/lib/dal/machines";
import type { OrganizationContext } from "~/lib/organization-context";
```

### ❌ Duplicate Type Definitions

```typescript
// ❌ Don't redeclare canonical types
interface IssueFilters {
  // This already exists in ~/lib/types/filters
  statusId?: string;
}
```

### ❌ Mixed Import Patterns

```typescript
// ❌ Inconsistent import sources
import type { IssueResponse } from "~/lib/types";
import type { MachineFilters } from "~/lib/dal/machines"; // Should be ~/lib/types
```

---

## ESLint Enforcement

The following ESLint rules enforce these patterns:

### Restricted Imports (App Code)

- `~/server/db/types` → Use `~/lib/types` (Db namespace)
- `~/lib/supabase/types` → Use `~/lib/types` for types
- `~/lib/dal/*` (for filter types) → Use `~/lib/types`

### Restricted Exports

- Type/interface exports outside `src/lib/types` are flagged
- Exceptions: Component props, test utilities, generated files

### Type-Only Import Guard

- Search param type imports must go through `~/lib/types`
- Value imports (parsers, builders) remain in original modules

---

## Migration Status

| Workstream | Status         | Description                  |
| ---------- | -------------- | ---------------------------- |
| WS-01      | ✅ Completed   | Types surface scaffolding    |
| WS-02      | ✅ Completed   | API types hygiene            |
| WS-03      | ✅ Completed   | Filters unification          |
| WS-04      | ✅ Completed   | MachineForIssues unification |
| WS-05      | ✅ Completed   | Auth & org context split     |
| WS-06      | ✅ Completed   | Zod search params re-exports |
| WS-07      | ✅ Completed   | DB types barrel & boundary   |
| WS-08      | ✅ In Progress | Lint/CI enforcement (active) |

---

## Troubleshooting

### "Cannot find module '~/lib/types'" Error

- Check TypeScript configuration includes path mapping
- Verify `src/lib/types/index.ts` exists and exports modules
- Ensure barrel file uses `export type *` (not `export *`)

### Type Not Found in Barrel

- Check if type is exported from specific module (e.g., `~/lib/types/auth`)
- Verify type is declared in correct canonical location
- Update `src/lib/types/index.ts` if missing re-export

### Server DB Types Not Accessible

- Use `import type { Db } from "~/lib/types"` for server code
- Access as `Db.ModelName` (e.g., `Db.User`, `Db.Issue`)
- Don't import `Db.*` types in app code (ESLint will warn)

---

## Related Documentation

- **[NON_NEGOTIABLES.md](./NON_NEGOTIABLES.md)** - Core type system rules (CORE-TS-001 through CORE-TS-005)
- **[TYPESCRIPT_STRICTEST_PATTERNS.md](./TYPESCRIPT_STRICTEST_PATTERNS.md)** - Type safety patterns
- **[TYPES_CONSOLIDATION_PLAN.md](../../TYPES_CONSOLIDATION_PLAN.md)** - Implementation plan and workstreams
