Task: Remove common duplicate types and switch to canonical types

Context
- Types are consolidated under `~/lib/types`.
- We still have inline duplicates for Location, User, and Machine in a few components, and exported validation “User” types in two modules.

Goals
- Replace inline Location/User/Machine types in targeted components with canonical types (or Picks).
- Centralize the shared validation “User” type and reuse it in both validation modules without changing runtime behavior.

Scope (surgical; no overreach)
1) Create a shared validation “User” type and adopt it
- Add: `@src/lib/types/validation.ts`
  - Contents:
    ```ts
    export interface ValidationUser {
      readonly id: string;
      readonly name: string | null;
      readonly email: string;
    }
    ```
- Update: `@src/lib/users/roleManagementValidation.ts`
  - Remove the local exported `interface User`.
  - Add: `import type { ValidationUser } from "~/lib/types/validation";`
  - Add compatibility alias at bottom: `export type User = ValidationUser;` (preserves existing imports)
  - Ensure all references still compile (properties already match).
- Update: `@src/lib/issues/assignmentValidation.ts`
  - Remove the local exported `interface User`.
  - Add: `import type { ValidationUser } from "~/lib/types/validation";`
  - Add compatibility alias at bottom: `export type User = ValidationUser;`
  - Ensure `Membership.user: User` remains correct.

2) Swap CreateIssueForm to canonical types
- Update: `@src/components/forms/CreateIssueFormServer.tsx`
  - Replace local `interface Machine` with `type Machine = MachineForIssues`.
  - Replace local `interface User` with `type User = Pick<UserResponse, "id" | "name" | "email">`.
  - Add imports: `import type { MachineForIssues, UserResponse } from "~/lib/types";`
  - No runtime changes; only type aliases and imports.

3) Clean up an extra inline Location type
- Update: `@src/components/machines/client/create-machine-form-client.tsx`
  - Replace local `interface Location` with `type Location = Pick<LocationResponse, "id" | "name">`.
  - Add import: `import type { LocationResponse } from "~/lib/types";`

Implementation notes
- Keep changes minimal; do not refactor logic or runtime behavior.
- Do not move component-specific UI types; only replace domain-shape duplicates.
- For any other inline domain duplicates discovered in these files, prefer `Pick<CanonicalType, "fields">` from `~/lib/types`.

Checks
- Grep for the duplicates targeted:
  - `rg -n '^export\\s+interface\\s+User\\b' src/lib/users src/lib/issues`
  - `rg -n '^interface\\s+(Location|User|Machine)\\b' src/components`
- Typecheck:
  - `npm run typecheck`
- Lint:
  - `npm run lint`

Acceptance
- No exported `User` interface in `roleManagementValidation.ts` or `assignmentValidation.ts` (they alias the shared type).
- The three components use canonical types (or Picks) from `~/lib/types` with no behavior changes.
- Typecheck/lint pass with no new errors.

Optional next pass (not in this task)
- Machines header/detail components still use snake_case props. In a follow-up, switch to `MachineResponse` + camelCase (using transforms at call sites).

