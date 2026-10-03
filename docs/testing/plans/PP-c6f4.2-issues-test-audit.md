# PP-c6f4.2 Issues and Comments Lane Plan & Ledger

## 1. Executive Summary & Lane Scope

- **Epic Bead**: PP-c6f4 (Whole-app test pruning campaign)
- **Lane Bead**: PP-c6f4.2 (Campaign lane: Issues and comments)
- **Total Files in Epic Baseline**: 72 files (13,588 lines)
- **Previously Retired on Main (Prior PRs)**: 7 files (1,061 lines)
  - `e2e/full/issue-detail-sticky-composer.spec.ts` (91 lines, retired in PR #2329)
  - `e2e/smoke/report-form-clear.spec.ts` (80 lines, retired in PR #2281)
  - `src/components/issues/IssueMetadata.test.tsx` (145 lines, retired in PR #2329)
  - `src/components/issues/IssueRow.test.tsx` (174 lines, retired in PR #2330)
  - `src/components/issues/StickyCommentComposer.test.tsx` (48 lines, retired in PR #2329)
  - `src/test/unit/components/issues/CompactIssueFieldForms.test.tsx` (71 lines, retired in PR #2329)
  - `src/test/unit/components/issues/metadata-select-reset-revert.test.tsx` (192 lines, retired in PR #2329)
- **Active Files in Scope on HEAD**: 65 files
- **Total Test Declarations**: 484

## 2. Layer Plan

### 2.1 Redundant Layers & Mock Retirements (CORE-TEST-004)

1. **Mocked DB Unit Tests -> PGlite Integration (CORE-TEST-004)**:
   - `src/app/(app)/settings/reporting/actions.test.ts` (4 tests): Uses chained mocks (`mockUpdate`, `mockSet`, `mockWhere`, `mockReturning`) on `~/server/db` to test `updateDefaultReportModeAction`. Upgraded to worker-scoped PGlite integration test `src/test/integration/default-report-mode-action.test.ts` (`setupTestDb()` / `getTestDb()`), asserting real `userProfiles` row persistence and layout cache revalidation. Retired unit file deleted.
   - `src/app/(app)/issues/export-action.test.ts` (16 tests): Uses canned `mockFindManyIssues`, `mockFindFirstProfile`, and mock `drizzle-orm` operators (`eq`, `and`) to test `exportIssuesAction`. Upgraded to worker-scoped PGlite integration test `src/test/integration/export-issues-action.test.ts` (`setupTestDb()` / `getTestDb()`), inserting real `issues`, `machines`, and `userProfiles`, asserting real query execution, relations, CSV serialization, filename formatting, and auth checks. Retired unit file deleted.

### 2.2 Consolidations into Canonical Keepers

1. **Consolidate `src/test/unit/delete-comment-audit.test.ts` (2 tests)**:
   - These 2 tests assert pure Zod validation for `deleteCommentAction` (invalid/missing commentId), but mock `~/server/db` to load the module. Absorbed into the canonical PGlite keeper `src/test/integration/issue-comment-actions.test.ts`. Retired unit file deleted.
2. **Consolidate `src/test/unit/issue-actions.test.ts` (4 tests)**:
   - These 4 tests assert `addCommentAction` unauthenticated rejection, input validation, service error handling, and image count limit, using canned mocks of `~/server/db` and `~/services/issues`. Absorbed into canonical PGlite keeper `src/test/integration/issue-comment-actions.test.ts`. Retired unit file deleted.
3. **Consolidate `src/test/unit/public-issue-security.test.ts` (1 test)**:
   - Single test asserting DB error message sanitization in `submitPublicIssueAction`, using mocked `createIssue` and `~/server/db`. Absorbed into canonical PGlite keeper `src/test/integration/public-issue-submit.test.ts`. Retired unit file deleted.

### 2.3 Redundant RTL Presentational Pruning (CORE-TEST-005)

1. `src/components/issues/AddCommentForm.test.tsx:107`: Delete `renders correctly` (pure presence check asserting `Add Comment` button is in document; fully subsumed by interaction and state tests in the same file).
2. `src/components/issues/ExportButton.test.tsx:52`: Delete `renders an accessible export button` (pure presence check asserting `Export to CSV` button is in document; subsumed by export interaction and pending state tests).
3. `src/components/issues/OwnerBadge.test.tsx:14-34`: Delete CSS class inspection tests (`renders with default size`, `renders with small size`, `applies custom className`) that assert hardcoded Tailwind class strings rather than user-facing behavior.

## 3. Production Seams & Dead Code

- No production exports or seams are broken; all actions (`exportIssuesAction`, `updateDefaultReportModeAction`, `deleteCommentAction`, `addCommentAction`, `submitPublicIssueAction`) remain public Server Actions with strengthened integration test coverage.

## 4. Complete Per-Test Ledger

### `e2e/full/issue-detail-sticky-composer.spec.ts`

_Status: Retired on main in prior PR._

### `e2e/full/issue-list-extended.spec.ts`

Total Declarations: 4

| Line | Mark  | Class | Declaration                                                     | Rationale                                             |
| ---: | :---: | :---: | :-------------------------------------------------------------- | :---------------------------------------------------- |
|   32 | **R** |   F   | should inline-edit issues                                       | Retain: Multi-step browser user journey (bug class F) |
|  104 | **R** |   F   | a Severity Segment filters the list to its issues               | Retain: Multi-step browser user journey (bug class F) |
|  153 | **R** |   F   | should persist filters when navigating to issue detail and back | Retain: Multi-step browser user journey (bug class F) |
|  189 | **R** |   F   | should persist filters when using AppHeader Issues link         | Retain: Multi-step browser user journey (bug class F) |

### `e2e/full/public-reporting-extended.spec.ts`

Total Declarations: 3

| Line | Mark  | Class | Declaration                                                  | Rationale                                             |
| ---: | :---: | :---: | :----------------------------------------------------------- | :---------------------------------------------------- |
|   23 | **R** |   F   | should show signup prompt when anonymous user provides email | Retain: Multi-step browser user journey (bug class F) |
|   52 | **R** |   F   | should pre-fill name on signup when provided without email   | Retain: Multi-step browser user journey (bug class F) |
|   84 | **R** |   F   | should pre-fill name and email on signup when both provided  | Retain: Multi-step browser user journey (bug class F) |

### `e2e/full/quick-report.spec.ts`

Total Declarations: 4

| Line | Mark  | Class | Declaration                                                                     | Rationale                                             |
| ---: | :---: | :---: | :------------------------------------------------------------------------------ | :---------------------------------------------------- |
|   29 | **R** |   F   | quick-submits a row, links the created issue, and advances focus to a fresh row | Retain: Multi-step browser user journey (bug class F) |
|   53 | **R** |   F   | Enter in the problem field quick-submits the row                                | Retain: Multi-step browser user journey (bug class F) |
|   67 | **R** |   F   | keyboard Tab flows from the machine picker straight to the problem field        | Retain: Multi-step browser user journey (bug class F) |
|   83 | **R** |   F   | collapsed row shows initials-only at a phone width and the full name on desktop | Retain: Multi-step browser user journey (bug class F) |

### `e2e/full/report-modes.spec.ts`

Total Declarations: 5

| Line | Mark  | Class | Declaration                                                                       | Rationale                                             |
| ---: | :---: | :---: | :-------------------------------------------------------------------------------- | :---------------------------------------------------- |
|   21 | **R** |   F   | Quick report creates one issue from the short form                                | Retain: Multi-step browser user journey (bug class F) |
|   38 | **R** |   F   | Quick draft carries machine, problem, and frequency through Detailed and Multiple | Retain: Multi-step browser user journey (bug class F) |
|   80 | **R** |   F   | Multiple retains extra rows when returning to Detailed                            | Retain: Multi-step browser user journey (bug class F) |
|  110 | **R** |   F   | legacy Multiple URL redirects to its named route                                  | Retain: Multi-step browser user journey (bug class F) |
|  134 | **R** |   F   | saved preferences drive the header and bottom-bar Report actions                  | Retain: Multi-step browser user journey (bug class F) |

### `e2e/smoke/issue-list.spec.ts`

Total Declarations: 4

| Line | Mark  | Class | Declaration                                                           | Rationale                                             |
| ---: | :---: | :---: | :-------------------------------------------------------------------- | :---------------------------------------------------- |
|   17 | **R** |   F   | should filter and search issues                                       | Retain: Multi-step browser user journey (bug class F) |
|   89 | **R** |   F   | should show and activate "My machines" quick-select in Machine filter | Retain: Multi-step browser user journey (bug class F) |
|  116 | **R** |   F   | should show bottom pagination on out-of-range page                    | Retain: Multi-step browser user journey (bug class F) |
|  130 | **R** |   F   | should export issues to CSV                                           | Retain: Multi-step browser user journey (bug class F) |

### `e2e/smoke/issues-crud.spec.ts`

Total Declarations: 4

| Line | Mark  | Class | Declaration                                                      | Rationale                                             |
| ---: | :---: | :---: | :--------------------------------------------------------------- | :---------------------------------------------------- |
|   51 | **R** |   F   | should create an issue for a specific machine                    | Retain: Multi-step browser user journey (bug class F) |
|   90 | **R** |   F   | should create an issue from machine page with pre-filled machine | Retain: Multi-step browser user journey (bug class F) |
|  195 | **R** |   F   | should display issue details                                     | Retain: Multi-step browser user journey (bug class F) |
|  287 | **R** |   F   | should display assignee on issue detail page                     | Retain: Multi-step browser user journey (bug class F) |

### `e2e/smoke/public-reporting.spec.ts`

Total Declarations: 5

| Line | Mark  | Class | Declaration                                                        | Rationale                                             |
| ---: | :---: | :---: | :----------------------------------------------------------------- | :---------------------------------------------------- |
|   27 | **R** |   F   | should submit anonymous issue and show confirmation                | Retain: Multi-step browser user journey (bug class F) |
|   66 | **R** |   F   | should allow reporting another issue from success page             | Retain: Multi-step browser user journey (bug class F) |
|   74 | **R** |   F   | should preserve draft when logging in from inline report-form link | Retain: Multi-step browser user journey (bug class F) |
|  113 | **R** |   F   | should preserve draft when logging in from header sign-in link     | Retain: Multi-step browser user journey (bug class F) |
|  153 | **R** |   F   | should clear form draft after successful submission                | Retain: Multi-step browser user journey (bug class F) |

### `e2e/smoke/quick-report.spec.ts`

Total Declarations: 4

| Line | Mark  | Class | Declaration                                                 | Rationale                                             |
| ---: | :---: | :---: | :---------------------------------------------------------- | :---------------------------------------------------- |
|    6 | **R** |   F   | renders Multiple issues for a technician                    | Retain: Multi-step browser user journey (bug class F) |
|   23 | **R** |   F   | renders Multiple issues for a member                        | Retain: Multi-step browser user journey (bug class F) |
|   32 | **R** |   F   | redirects a guest away from Multiple issues to Quick report | Retain: Multi-step browser user journey (bug class F) |
|   47 | **R** |   F   | Quick report offers Multiple issues to a member             | Retain: Multi-step browser user journey (bug class F) |

### `e2e/smoke/report-form-clear.spec.ts`

_Status: Retired on main in prior PR._

### `src/app/(app)/issues/export-action.test.ts`

Total Declarations: 16

| Line | Mark  | Class | Declaration                                                        | Rationale                                                                                                          |
| ---: | :---: | :---: | :----------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------- |
|  102 | **F** |   B   | returns UNAUTHORIZED when user is not signed in                    | Upgrade to worker-scoped PGlite integration test src/test/integration/export-issues-action.test.ts (CORE-TEST-004) |
|  119 | **F** |   B   | returns VALIDATION for invalid machineInitials                     | Upgrade to worker-scoped PGlite integration test src/test/integration/export-issues-action.test.ts (CORE-TEST-004) |
|  129 | **F** |   B   | returns VALIDATION for malformed filtersJson                       | Upgrade to worker-scoped PGlite integration test src/test/integration/export-issues-action.test.ts (CORE-TEST-004) |
|  143 | **F** |   B   | returns EMPTY when no issues match filters                         | Upgrade to worker-scoped PGlite integration test src/test/integration/export-issues-action.test.ts (CORE-TEST-004) |
|  159 | **F** |   B   | produces correct headers in order                                  | Upgrade to worker-scoped PGlite integration test src/test/integration/export-issues-action.test.ts (CORE-TEST-004) |
|  171 | **F** |   B   | maps row values to correct columns                                 | Upgrade to worker-scoped PGlite integration test src/test/integration/export-issues-action.test.ts (CORE-TEST-004) |
|  190 | **F** |   B   | formats general export filename as pinpoint-issues-YYYY-MM-DD.csv  | Upgrade to worker-scoped PGlite integration test src/test/integration/export-issues-action.test.ts (CORE-TEST-004) |
|  201 | **F** |   B   | formats machine export filename with uppercased initials           | Upgrade to worker-scoped PGlite integration test src/test/integration/export-issues-action.test.ts (CORE-TEST-004) |
|  212 | **F** |   B   | uses Anonymous for issues with no reporter                         | Upgrade to worker-scoped PGlite integration test src/test/integration/export-issues-action.test.ts (CORE-TEST-004) |
|  230 | **F** |   B   | uses invitedReporter name when reportedByUser is absent            | Upgrade to worker-scoped PGlite integration test src/test/integration/export-issues-action.test.ts (CORE-TEST-004) |
|  252 | **F** |   B   | passes parsed filters to buildWhereConditions                      | Upgrade to worker-scoped PGlite integration test src/test/integration/export-issues-action.test.ts (CORE-TEST-004) |
|  263 | **F** |   B   | coerces ISO date strings in filtersJson into Date objects          | Upgrade to worker-scoped PGlite integration test src/test/integration/export-issues-action.test.ts (CORE-TEST-004) |
|  280 | **F** |   B   | uses empty filters when filtersJson contains an invalid enum value | Upgrade to worker-scoped PGlite integration test src/test/integration/export-issues-action.test.ts (CORE-TEST-004) |
|  295 | **F** |   B   | injects currentUserId from the authenticated user                  | Upgrade to worker-scoped PGlite integration test src/test/integration/export-issues-action.test.ts (CORE-TEST-004) |
|  307 | **F** |   B   | sets machine filter, clears status, and enables inactive machines  | Upgrade to worker-scoped PGlite integration test src/test/integration/export-issues-action.test.ts (CORE-TEST-004) |
|  322 | **F** |   B   | returns SERVER error when db.query.issues.findMany throws          | Upgrade to worker-scoped PGlite integration test src/test/integration/export-issues-action.test.ts (CORE-TEST-004) |

### `src/app/(app)/issues/frequency-schema.test.ts`

Total Declarations: 2

| Line | Mark  | Class | Declaration                                    | Rationale                                                         |
| ---: | :---: | :---: | :--------------------------------------------- | :---------------------------------------------------------------- |
|    7 | **R** |   G   | accepts the value for issue editing            | Retain: Pure business logic / validator / formatter (bug class G) |
|   15 | **R** |   G   | preserves the value in list and export filters | Retain: Pure business logic / validator / formatter (bug class G) |

### `src/app/(app)/report/(tabbed)/quick/quick-report-grid.test.tsx`

Total Declarations: 15

| Line | Mark  | Class | Declaration                                                            | Rationale                                                         |
| ---: | :---: | :---: | :--------------------------------------------------------------------- | :---------------------------------------------------------------- |
|   56 | **R** |   H   | starts with one empty row and can add more                             | Retain: Accessible UI component state & interaction (bug class H) |
|   63 | **R** |   H   | expands and collapses a row                                            | Retain: Accessible UI component state & interaction (bug class H) |
|   71 | **R** |   H   | keeps the staged Watch checkbox value when a row collapses and expands | Retain: Accessible UI component state & interaction (bug class H) |
|   92 | **R** |   H   | quick-submits a row and shows the confirmation receipt                 | Retain: Accessible UI component state & interaction (bug class H) |
|  116 | **R** |   H   | opens a new blank row automatically after a successful quick-submit    | Retain: Accessible UI component state & interaction (bug class H) |
|  138 | **R** |   H   | marks Machine and Problem as required fields                           | Retain: Accessible UI component state & interaction (bug class H) |
|  150 | **R** |   H   | keeps a bad row flagged after submit-all partial failure               | Retain: Accessible UI component state & interaction (bug class H) |
|  179 | **R** |   H   | recovers from a thrown submit action instead of hanging                | Retain: Accessible UI component state & interaction (bug class H) |
|  197 | **R** |   H   | quick-submits the row when Enter is pressed in the problem field       | Retain: Accessible UI component state & interaction (bug class H) |
|  219 | **R** |   H   | moves focus to the next blank row's machine picker after a submit      | Retain: Accessible UI component state & interaction (bug class H) |
|  242 | **R** |   H   | guards against navigating away only while a row has unsaved content    | Retain: Accessible UI component state & interaction (bug class H) |
|  275 | **R** |   H   | confirms before discarding a row that has content, then removes it     | Retain: Accessible UI component state & interaction (bug class H) |
|  300 | **R** |   H   | counts a row as ready only once both required fields are filled        | Retain: Accessible UI component state & interaction (bug class H) |
|  320 | **R** |   H   | clears a row's validation error when the offending field is edited     | Retain: Accessible UI component state & interaction (bug class H) |
|  343 | **R** |   H   | keeps an editable blank row after discarding the last unsubmitted row  | Retain: Accessible UI component state & interaction (bug class H) |

### `src/app/(app)/report/(tabbed)/quick/validation.test.ts`

Total Declarations: 10

| Line | Mark  | Class | Declaration                                                                   | Rationale                                                         |
| ---: | :---: | :---: | :---------------------------------------------------------------------------- | :---------------------------------------------------------------- |
|   20 | **R** |   G   | accepts a well-formed row                                                     | Retain: Pure business logic / validator / formatter (bug class G) |
|   25 | **R** |   G   | rejects a missing machineId with the schema's plain message (no field prefix) | Retain: Pure business logic / validator / formatter (bug class G) |
|   35 | **R** |   G   | rejects an empty title                                                        | Retain: Pure business logic / validator / formatter (bug class G) |
|   40 | **R** |   G   | rejects a whitespace-only title                                               | Retain: Pure business logic / validator / formatter (bug class G) |
|   45 | **R** |   G   | rejects a title longer than 60 chars                                          | Retain: Pure business logic / validator / formatter (bug class G) |
|   50 | **R** |   G   | rejects an invalid severity                                                   | Retain: Pure business logic / validator / formatter (bug class G) |
|   55 | **R** |   G   | treats empty assignedTo as valid (unassigned)                                 | Retain: Pure business logic / validator / formatter (bug class G) |
|   60 | **R** |   G   | accepts a ProseMirror description doc                                         | Retain: Pure business logic / validator / formatter (bug class G) |
|   73 | **R** |   G   | rejects a bare string description (must be a ProseMirror doc or null)         | Retain: Pure business logic / validator / formatter (bug class G) |
|   78 | **R** |   G   | exposes the batch cap                                                         | Retain: Pure business logic / validator / formatter (bug class G) |

### `src/app/(app)/report/actions.test.ts`

Total Declarations: 16

| Line | Mark  | Class | Declaration                                                                                    | Rationale               |
| ---: | :---: | :---: | :--------------------------------------------------------------------------------------------- | :---------------------- |
|   93 | **R** |   G   | rejects empty machineInitials                                                                  | Retain: Unit logic test |
|  104 | **R** |   G   | rejects machineInitials longer than 10 characters                                              | Retain: Unit logic test |
|  115 | **R** |   G   | rejects machineInitials with invalid characters                                                | Retain: Unit logic test |
|  126 | **R** |   G   | rejects machineInitials with spaces                                                            | Retain: Unit logic test |
|  137 | **R** |   G   | rejects limit of 0                                                                             | Retain: Unit logic test |
|  148 | **R** |   G   | rejects limit greater than 20                                                                  | Retain: Unit logic test |
|  159 | **R** |   G   | rejects non-integer limit                                                                      | Retain: Unit logic test |
|  170 | **R** |   G   | rejects negative limit                                                                         | Retain: Unit logic test |
|  187 | **R** |   G   | accepts machineInitials with hyphens                                                           | Retain: Unit logic test |
|  196 | **R** |   G   | accepts boundary limit values (1 and 20)                                                       | Retain: Unit logic test |
|  211 | **R** |   G   | returns err when db.query throws                                                               | Retain: Unit logic test |
|  225 | **R** |   G   | returns err when db.query throws non-Error                                                     | Retain: Unit logic test |
|  271 | **R** |   G   | uses checkAuthenticatedIssueLimit (keyed by user.id) and skips IP check when user is logged in | Retain: Unit logic test |
|  280 | **R** |   G   | uses checkPublicIssueLimit (keyed by IP) when user is anonymous                                | Retain: Unit logic test |
|  289 | **R** |   G   | returns rate limit error when authenticated limit is exceeded                                  | Retain: Unit logic test |
|  302 | **R** |   G   | returns rate limit error when anonymous limit is exceeded                                      | Retain: Unit logic test |

### `src/app/(app)/report/error.test.tsx`

Total Declarations: 5

| Line | Mark  | Class | Declaration                                            | Rationale                                                         |
| ---: | :---: | :---: | :----------------------------------------------------- | :---------------------------------------------------------------- |
|   24 | **R** |   H   | renders the draft-kept heading and message             | Retain: Accessible UI component state & interaction (bug class H) |
|   35 | **R** |   H   | calls reset when Try Again is clicked                  | Retain: Accessible UI component state & interaction (bug class H) |
|   46 | **R** |   H   | renders a Back to Report Form link pointing to /report | Retain: Accessible UI component state & interaction (bug class H) |
|   53 | **R** |   H   | shows Error ID when digest is provided                 | Retain: Accessible UI component state & interaction (bug class H) |
|   63 | **R** |   H   | does not show Error ID when digest is absent           | Retain: Accessible UI component state & interaction (bug class H) |

### `src/app/(app)/report/quick-report-form.test.tsx`

Total Declarations: 5

| Line | Mark  | Class | Declaration                                                                         | Rationale                                           |
| ---: | :---: | :---: | :---------------------------------------------------------------------------------- | :-------------------------------------------------- |
|   77 | **R** |   C   | renders URL machine and Quick frequency on the first server paint                   | Retain: Form lifecycle & client state (bug class C) |
|  100 | **R** |   C   | starts with the approved Quick fields and Not specified frequency                   | Retain: Form lifecycle & client state (bug class C) |
|  121 | **R** |   C   | submits apron source and keeps it when opening Detailed                             | Retain: Form lifecycle & client state (bug class C) |
|  142 | **R** |   C   | hides Multiple without capability and shows it when permitted                       | Retain: Form lifecycle & client state (bug class C) |
|  164 | **R** |   C   | clears Detailed-only data after a Quick submit while preserving extra Multiple rows | Retain: Form lifecycle & client state (bug class C) |

### `src/app/(app)/report/report-draft-schema.test.ts`

Total Declarations: 8

| Line | Mark  | Class | Declaration                                                           | Rationale                                                         |
| ---: | :---: | :---: | :-------------------------------------------------------------------- | :---------------------------------------------------------------- |
|   22 | **R** |   G   | round-trips a fresh draft through serialize/parse                     | Retain: Pure business logic / validator / formatter (bug class G) |
|   35 | **R** |   G   | preserves a ProseMirror description doc                               | Retain: Pure business logic / validator / formatter (bug class G) |
|   45 | **R** |   G   | migrates a legacy report_form_state draft into entry #1 + single-only | Retain: Pure business logic / validator / formatter (bug class G) |
|   79 | **R** |   G   | mints an idempotency key when a legacy draft lacks one                | Retain: Pure business logic / validator / formatter (bug class G) |
|   87 | **R** |   G   | keeps defaults for invalid legacy enum values                         | Retain: Pure business logic / validator / formatter (bug class G) |
|   98 | **R** |   G   | drops legacy image rows missing required metadata (PP-2053.6)         | Retain: Pure business logic / validator / formatter (bug class G) |
|  119 | **R** |   G   | returns null (never throws) on corrupt JSON                           | Retain: Pure business logic / validator / formatter (bug class G) |
|  125 | **R** |   G   | returns null on a structurally-invalid new-shape draft                | Retain: Pure business logic / validator / formatter (bug class G) |

### `src/app/(app)/report/report-draft-store.test.tsx`

Total Declarations: 10

| Line | Mark  | Class | Declaration                                                    | Rationale                                           |
| ---: | :---: | :---: | :------------------------------------------------------------- | :-------------------------------------------------- |
|   80 | **R** |   C   | starts with one blank entry and zero content rows              | Retain: Form lifecycle & client state (bug class C) |
|   86 | **R** |   C   | patchEntry updates a synced field                              | Retain: Form lifecycle & client state (bug class C) |
|   93 | **R** |   C   | counts a row as content only with a machine or non-blank title | Retain: Form lifecycle & client state (bug class C) |
|  102 | **R** |   C   | setEntries appends a row and bumps the content count           | Retain: Form lifecycle & client state (bug class C) |
|  110 | **R** |   C   | patchSingle updates single-only state                          | Retain: Form lifecycle & client state (bug class C) |
|  116 | **R** |   C   | resetEntryZero blanks entry 0 with a fresh idempotency key     | Retain: Form lifecycle & client state (bug class C) |
|  125 | **R** |   C   | persists to localStorage on change                             | Retain: Form lifecycle & client state (bug class C) |
|  132 | **R** |   C   | clearAll wipes the draft and localStorage                      | Retain: Form lifecycle & client state (bug class C) |
|  141 | **R** |   C   | hydrates from a seeded draft and drops a stale machineId       | Retain: Form lifecycle & client state (bug class C) |
|  158 | **R** |   C   | migrates and retires a legacy report_form_state draft          | Retain: Form lifecycle & client state (bug class C) |

### `src/app/(app)/report/select-fallback.test.tsx`

Total Declarations: 3

| Line | Mark  | Class | Declaration                                                                     | Rationale                                                         |
| ---: | :---: | :---: | :------------------------------------------------------------------------------ | :---------------------------------------------------------------- |
|   52 | **R** |   H   | submits the first option's value when controlled value matches no option        | Retain: Accessible UI component state & interaction (bug class H) |
|   70 | **R** |   H   | submits the disabled placeholder's value (empty) when controlled value is empty | Retain: Accessible UI component state & interaction (bug class H) |
|   83 | **R** |   H   | submits the matching option's value when controlled value is valid              | Retain: Accessible UI component state & interaction (bug class H) |

### `src/app/(app)/report/unified-report-form.test.tsx`

Total Declarations: 11

| Line | Mark  | Class | Declaration                                                                     | Rationale                                           |
| ---: | :---: | :---: | :------------------------------------------------------------------------------ | :-------------------------------------------------- |
|  201 | **R** |   C   | shows firstName, lastName, and email hydrated from the draft                    | Retain: Form lifecycle & client state (bug class C) |
|  220 | **R** |   C   | renders the gallery for a fully-valid restored image                            | Retain: Form lifecycle & client state (bug class C) |
|  229 | **R** |   C   | drops slim-only image rows that lack required metadata                          | Retain: Form lifecycle & client state (bug class C) |
|  249 | **R** |   C   | renders no gallery when the image array is empty                                | Retain: Form lifecycle & client state (bug class C) |
|  259 | **R** |   C   | keeps the draft in localStorage after a failed submission                       | Retain: Form lifecycle & client state (bug class C) |
|  276 | **R** |   C   | clears the draft in localStorage on successful submission                       | Retain: Form lifecycle & client state (bug class C) |
|  292 | **R** |   C   | clears firstName/lastName/email on success                                      | Retain: Form lifecycle & client state (bug class C) |
|  330 | **R** |   C   | re-serializes restored images so imagesMetadataArraySchema accepts them         | Retain: Form lifecycle & client state (bug class C) |
|  352 | **R** |   C   | proves the OLD slim shape would have FAILED the schema (locks in the fix)       | Retain: Form lifecycle & client state (bug class C) |
|  372 | **R** |   C   | drops stale machineId from draft, clears machine selection, and disables submit | Retain: Form lifecycle & client state (bug class C) |
|  402 | **R** |   C   | clears title, machine, and strips ?machine= from URL on confirmation            | Retain: Form lifecycle & client state (bug class C) |

### `src/app/(app)/report/validation.test.ts`

Total Declarations: 10

| Line | Mark  | Class | Declaration                                                        | Rationale                                                         |
| ---: | :---: | :---: | :----------------------------------------------------------------- | :---------------------------------------------------------------- |
|    5 | **R** |   G   | should fail validation when machineId is missing                   | Retain: Pure business logic / validator / formatter (bug class G) |
|   25 | **R** |   G   | should fail validation when severity is missing                    | Retain: Pure business logic / validator / formatter (bug class G) |
|   40 | **R** |   G   | should fail validation when title is empty                         | Retain: Pure business logic / validator / formatter (bug class G) |
|   56 | **R** |   G   | should pass validation when all required fields are present        | Retain: Pure business logic / validator / formatter (bug class G) |
|   71 | **R** |   G   | accepts Not specified as an explicit frequency                     | Retain: Pure business logic / validator / formatter (bug class G) |
|   86 | **R** |   G   | should respect watchIssue opt-out flag                             | Retain: Pure business logic / validator / formatter (bug class G) |
|  102 | **R** |   G   | retains the apron scan source and leaves ordinary reports untagged | Retain: Pure business logic / validator / formatter (bug class G) |
|  118 | **R** |   G   | should pass validation with valid assignedTo UUID                  | Retain: Pure business logic / validator / formatter (bug class G) |
|  135 | **R** |   G   | should pass validation with empty string assignedTo                | Retain: Pure business logic / validator / formatter (bug class G) |
|  151 | **R** |   G   | should fail validation with invalid assignedTo format              | Retain: Pure business logic / validator / formatter (bug class G) |

### `src/app/(app)/settings/reporting/actions.test.ts`

Total Declarations: 4

| Line | Mark  | Class | Declaration                                    | Rationale                                                                                                                |
| ---: | :---: | :---: | :--------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------- |
|   45 | **F** |   B   | saves both settings for an authorized reporter | Upgrade to worker-scoped PGlite integration test src/test/integration/default-report-mode-action.test.ts (CORE-TEST-004) |
|   64 | **F** |   B   | rejects invalid values before updating         | Upgrade to worker-scoped PGlite integration test src/test/integration/default-report-mode-action.test.ts (CORE-TEST-004) |
|   73 | **F** |   B   | rejects Multiple when batch access is absent   | Upgrade to worker-scoped PGlite integration test src/test/integration/default-report-mode-action.test.ts (CORE-TEST-004) |
|   83 | **F** |   B   | requires a signed-in account                   | Upgrade to worker-scoped PGlite integration test src/test/integration/default-report-mode-action.test.ts (CORE-TEST-004) |

### `src/app/(app)/settings/reporting/default-report-mode-form.test.tsx`

Total Declarations: 9

| Line | Mark  | Class | Declaration                                                         | Rationale                                           |
| ---: | :---: | :---: | :------------------------------------------------------------------ | :-------------------------------------------------- |
|   20 | **R** |   C   | shows compact desktop and mobile rows with their defaults           | Retain: Form lifecycle & client state (bug class C) |
|   44 | **R** |   C   | lists the mobile row before the desktop row                         | Retain: Form lifecycle & client state (bug class C) |
|   61 | **R** |   C   | marks a choice pending until the server confirms it                 | Retain: Form lifecycle & client state (bug class C) |
|   98 | **R** |   C   | offers Multiple in both settings only with batch access             | Retain: Form lifecycle & client state (bug class C) |
|  109 | **R** |   C   | saves each selection immediately and preserves the other preference | Retain: Form lifecycle & client state (bug class C) |
|  156 | **R** |   C   | queues the latest selection while a save is in flight               | Retain: Form lifecycle & client state (bug class C) |
|  203 | **R** |   C   | submits a queued choice when the save ahead of it fails             | Retain: Form lifecycle & client state (bug class C) |
|  253 | **R** |   C   | restores the confirmed choice and reports a failed save             | Retain: Form lifecycle & client state (bug class C) |
|  282 | **R** |   C   | supports arrow keys within each report-screen group                 | Retain: Form lifecycle & client state (bug class C) |

### `src/components/feedback/FeedbackWidget.test.tsx`

Total Declarations: 2

| Line | Mark  | Class | Declaration                                                              | Rationale                                                         |
| ---: | :---: | :---: | :----------------------------------------------------------------------- | :---------------------------------------------------------------- |
|   71 | **R** |   H   | calls createForm with correct title and button label for Feature Request | Retain: Accessible UI component state & interaction (bug class H) |
|   95 | **R** |   H   | calls createForm with correct title and button label for Bug Report      | Retain: Accessible UI component state & interaction (bug class H) |

### `src/components/issues/AddCommentForm.test.tsx`

Total Declarations: 10

| Line | Mark  | Class | Declaration                                                                                       | Rationale                                                                                 |
| ---: | :---: | :---: | :------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------- |
|  107 | **D** |   H   | renders correctly                                                                                 | Delete redundant presence check (CORE-TEST-005); fully subsumed by form interaction tests |
|  115 | **R** |   C   | names the quick composer's formatting toggle by its visible text (WCAG 2.5.3)                     | Retain: Form lifecycle & client state (bug class C)                                       |
|  122 | **R** |   C   | announces a failed post as an alert                                                               | Retain: Form lifecycle & client state (bug class C)                                       |
|  134 | **R** |   C   | shows loading state when pending (using standard loading prop)                                    | Retain: Form lifecycle & client state (bug class C)                                       |
|  148 | **R** |   C   | calls toast on success                                                                            | Retain: Form lifecycle & client state (bug class C)                                       |
|  161 | **R** |   C   | acts on one post once, even when the parent passes a new callback                                 | Retain: Form lifecycle & client state (bug class C)                                       |
|  190 | **R** |   C   | clears the rich text editor after a successful submit (PP-8mq)                                    | Retain: Form lifecycle & client state (bug class C)                                       |
|  224 | **R** |   C   | restores a saved draft into the submission — comment, photos with their imageIds, idempotency key | Retain: Form lifecycle & client state (bug class C)                                       |
|  260 | **R** |   C   | clears the saved draft once the comment posts                                                     | Retain: Form lifecycle & client state (bug class C)                                       |
|  294 | **R** |   C   | resets uploaded images and hidden imagesMetadata input after a successful submit                  | Retain: Form lifecycle & client state (bug class C)                                       |

### `src/components/issues/AssigneePicker.test.tsx`

Total Declarations: 14

| Line | Mark  | Class | Declaration                                                                  | Rationale                                                         |
| ---: | :---: | :---: | :--------------------------------------------------------------------------- | :---------------------------------------------------------------- |
|   20 | **R** |   H   | renders with correct accessibility attributes                                | Retain: Accessible UI component state & interaction (bug class H) |
|   39 | **R** |   H   | renders listbox options with correct roles and data-assigned                 | Retain: Accessible UI component state & interaction (bug class H) |
|   79 | **R** |   H   | renders loading state with accessible attributes                             | Retain: Accessible UI component state & interaction (bug class H) |
|  101 | **R** |   H   | shows 'Me' option when currentUserId matches a user in the list              | Retain: Accessible UI component state & interaction (bug class H) |
|  120 | **R** |   H   | does NOT show 'Me' option when currentUserId is null                         | Retain: Accessible UI component state & interaction (bug class H) |
|  137 | **R** |   H   | does NOT show 'Me' option when currentUserId prop is omitted                 | Retain: Accessible UI component state & interaction (bug class H) |
|  153 | **R** |   H   | selecting 'Me' calls onAssign with the current user's ID                     | Retain: Accessible UI component state & interaction (bug class H) |
|  172 | **R** |   H   | finds and selects the current user by name in addition to 'Me'               | Retain: Accessible UI component state & interaction (bug class H) |
|  203 | **R** |   H   | marks 'Me' with data-assigned when the current user is assigned              | Retain: Accessible UI component state & interaction (bug class H) |
|  221 | **R** |   H   | does NOT show 'Me' when currentUserId does not match any user in the list    | Retain: Accessible UI component state & interaction (bug class H) |
|  276 | **R** |   H   | marks only the current assignee's rows with a check                          | Retain: Accessible UI component state & interaction (bug class H) |
|  303 | **R** |   H   | keeps the no-matches message out of the listbox (axe aria-required-children) | Retain: Accessible UI component state & interaction (bug class H) |
|  321 | **R** |   H   | announces how many people match the filter                                   | Retain: Accessible UI component state & interaction (bug class H) |
|  340 | **R** |   H   | opens a bottom sheet with the search box first                               | Retain: Accessible UI component state & interaction (bug class H) |

### `src/components/issues/ExportButton.test.tsx`

Total Declarations: 4

| Line | Mark  | Class | Declaration                                                  | Rationale                                                                       |
| ---: | :---: | :---: | :----------------------------------------------------------- | :------------------------------------------------------------------------------ |
|   52 | **D** |   H   | renders an accessible export button                          | Delete redundant presence check (CORE-TEST-005); subsumed by export state tests |
|   59 | **R** |   H   | disables the button while export is in progress              | Retain: Accessible UI component state & interaction (bug class H)               |
|   74 | **R** |   H   | re-enables the button after a successful export              | Retain: Accessible UI component state & interaction (bug class H)               |
|  110 | **R** |   H   | re-enables the button after a failed export (EMPTY response) | Retain: Accessible UI component state & interaction (bug class H)               |

### `src/components/issues/IssueCard.test.tsx`

Total Declarations: 5

| Line | Mark  | Class | Declaration                                                                            | Rationale                                                         |
| ---: | :---: | :---: | :------------------------------------------------------------------------------------- | :---------------------------------------------------------------- |
|   38 | **R** |   H   | uses the elevated card surface for open issues                                         | Retain: Accessible UI component state & interaction (bug class H) |
|   47 | **R** |   H   | keeps closed issues on the dimmed surface without a hover glow                         | Retain: Accessible UI component state & interaction (bug class H) |
|   63 | **R** |   H   | renders the machine name by default                                                    | Retain: Accessible UI component state & interaction (bug class H) |
|   68 | **R** |   H   | omits the machine name when showMachineName is false                                   | Retain: Accessible UI component state & interaction (bug class H) |
|   81 | **R** |   H   | caps the mobile badge strip to Status + Severity (Priority/Frequency container-hidden) | Retain: Accessible UI component state & interaction (bug class H) |

### `src/components/issues/IssueListPagination.test.tsx`

Total Declarations: 8

| Line | Mark  | Class | Declaration                                                                   | Rationale                                                         |
| ---: | :---: | :---: | :---------------------------------------------------------------------------- | :---------------------------------------------------------------- |
|  133 | **R** |   H   | renders both top and bottom pagination buttons                                | Retain: Accessible UI component state & interaction (bug class H) |
|  151 | **R** |   H   | disables all buttons on the only page                                         | Retain: Accessible UI component state & interaction (bug class H) |
|  171 | **R** |   H   | disables prev and enables next on the first page                              | Retain: Accessible UI component state & interaction (bug class H) |
|  189 | **R** |   H   | enables prev and disables next on the last page                               | Retain: Accessible UI component state & interaction (bug class H) |
|  207 | **R** |   H   | enables both buttons on a middle page                                         | Retain: Accessible UI component state & interaction (bug class H) |
|  225 | **R** |   H   | clicking next-page calls router.push with page=2                              | Retain: Accessible UI component state & interaction (bug class H) |
|  264 | **R** |   H   | clicking prev-page calls router.push without a page param (back to page 1)    | Retain: Accessible UI component state & interaction (bug class H) |
|  305 | **R** |   H   | does not render the bottom pagination bar but renders disabled top pagination | Retain: Accessible UI component state & interaction (bug class H) |

### `src/components/issues/IssueMetadata.test.tsx`

_Status: Retired on main in prior PR._

### `src/components/issues/IssueRow.test.tsx`

_Status: Retired on main in prior PR._

### `src/components/issues/IssueSummaryWidgets.test.tsx`

Total Declarations: 2

| Line | Mark  | Class | Declaration                                                         | Rationale                                                         |
| ---: | :---: | :---: | :------------------------------------------------------------------ | :---------------------------------------------------------------- |
|   51 | **R** |   H   | sets only that widget's filter from a Segment and returns to page 1 | Retain: Accessible UI component state & interaction (bug class H) |
|   66 | **R** |   H   | keeps the page when a widget switches population                    | Retain: Accessible UI component state & interaction (bug class H) |

### `src/components/issues/OwnerBadge.test.tsx`

Total Declarations: 7

| Line | Mark  | Class | Declaration                                                    | Rationale                                                         |
| ---: | :---: | :---: | :------------------------------------------------------------- | :---------------------------------------------------------------- |
|    6 | **R** |   H   | renders the owner badge with crown icon                        | Retain: Accessible UI component state & interaction (bug class H) |
|   14 | **D** |   H   | renders with default size                                      | Delete redundant CSS class inspection (CORE-TEST-005)             |
|   21 | **D** |   H   | renders with small size                                        | Delete redundant CSS class inspection (CORE-TEST-005)             |
|   29 | **D** |   H   | applies custom className                                       | Delete redundant CSS class inspection (CORE-TEST-005)             |
|   40 | **R** |   H   | keeps the label and the test id                                | Retain: Accessible UI component state & interaction (bug class H) |
|   47 | **R** |   H   | renders no filled pill — no background, border, or uppercasing | Retain: Accessible UI component state & interaction (bug class H) |
|   56 | **R** |   H   | still accepts a custom className                               | Retain: Accessible UI component state & interaction (bug class H) |

### `src/components/issues/QuickRecentIssues.test.tsx`

Total Declarations: 2

| Line | Mark  | Class | Declaration                                                    | Rationale                                                         |
| ---: | :---: | :---: | :------------------------------------------------------------- | :---------------------------------------------------------------- |
|   20 | **R** |   H   | shows a linked, non-collapsible issue list and all-issues path | Retain: Accessible UI component state & interaction (bug class H) |
|   45 | **R** |   H   | explains when the selected machine has no open issues          | Retain: Accessible UI component state & interaction (bug class H) |

### `src/components/issues/RelativeTime.test.tsx`

Total Declarations: 7

| Line | Mark  | Class | Declaration                                             | Rationale                                                         |
| ---: | :---: | :---: | :------------------------------------------------------ | :---------------------------------------------------------------- |
|   13 | **R** |   H   | renders the fallback in SSR output (no client effects)  | Retain: Accessible UI component state & interaction (bug class H) |
|   28 | **R** |   H   | renders nothing pre-hydration when no fallback is given | Retain: Accessible UI component state & interaction (bug class H) |
|   48 | **R** |   H   | swaps to a relative label after mount                   | Retain: Accessible UI component state & interaction (bug class H) |
|   63 | **R** |   H   | accepts a string value and parses it                    | Retain: Accessible UI component state & interaction (bug class H) |
|   81 | **R** |   H   | stays on the fallback when given an invalid date string | Retain: Accessible UI component state & interaction (bug class H) |
|  102 | **R** |   H   | shared ticker stops when the provider unmounts          | Retain: Accessible UI component state & interaction (bug class H) |
|  114 | **R** |   H   | renders fallback without a provider (no ticker running) | Retain: Accessible UI component state & interaction (bug class H) |

### `src/components/issues/StickyCommentComposer.test.tsx`

_Status: Retired on main in prior PR._

### `src/components/issues/fields/SelectFields.test.tsx`

Total Declarations: 4

| Line | Mark  | Class | Declaration                                 | Rationale                                                         |
| ---: | :---: | :---: | :------------------------------------------ | :---------------------------------------------------------------- |
|   21 | **R** |   H   | SeveritySelect has dynamic accessible name  | Retain: Accessible UI component state & interaction (bug class H) |
|   28 | **R** |   H   | StatusSelect has dynamic accessible name    | Retain: Accessible UI component state & interaction (bug class H) |
|   39 | **R** |   H   | PrioritySelect has dynamic accessible name  | Retain: Accessible UI component state & interaction (bug class H) |
|   46 | **R** |   H   | FrequencySelect has dynamic accessible name | Retain: Accessible UI component state & interaction (bug class H) |

### `src/lib/issues/filter-utils.test.ts`

Total Declarations: 5

| Line | Mark  | Class | Declaration                                | Rationale                                                         |
| ---: | :---: | :---: | :----------------------------------------- | :---------------------------------------------------------------- |
|   11 | **R** |   G   | puts current user first as 'Me'            | Retain: Pure business logic / validator / formatter (bug class G) |
|   21 | **R** |   G   | puts 'Unassigned' second                   | Retain: Pure business logic / validator / formatter (bug class G) |
|   30 | **R** |   G   | includes separator after quick-selects     | Retain: Pure business logic / validator / formatter (bug class G) |
|   35 | **R** |   G   | sorts remaining users alphabetically       | Retain: Pure business logic / validator / formatter (bug class G) |
|   44 | **R** |   G   | handles null currentUserId (no 'Me' entry) | Retain: Pure business logic / validator / formatter (bug class G) |

### `src/lib/issues/owner.test.ts`

Total Declarations: 14

| Line | Mark  | Class | Declaration                                                     | Rationale               |
| ---: | :---: | :---: | :-------------------------------------------------------------- | :---------------------- |
|   47 | **R** |   G   | returns true when user is the registered owner                  | Retain: Unit logic test |
|   52 | **R** |   G   | returns true when user is the invited owner                     | Retain: Unit logic test |
|   57 | **R** |   G   | returns false when user is not the owner                        | Retain: Unit logic test |
|   62 | **R** |   G   | returns false when userId is null                               | Retain: Unit logic test |
|   67 | **R** |   G   | returns false when userId is undefined                          | Retain: Unit logic test |
|   72 | **R** |   G   | returns false when there is no owner                            | Retain: Unit logic test |
|  116 | **R** |   G   | returns registered owner name when present                      | Retain: Unit logic test |
|  121 | **R** |   G   | returns invited owner name when registered owner is not present | Retain: Unit logic test |
|  126 | **R** |   G   | prefers registered owner over invited owner                     | Retain: Unit logic test |
|  131 | **R** |   G   | returns null when there is no owner                             | Retain: Unit logic test |
|  175 | **R** |   G   | returns registered owner ID when present                        | Retain: Unit logic test |
|  180 | **R** |   G   | returns invited owner ID when registered owner is not present   | Retain: Unit logic test |
|  185 | **R** |   G   | prefers registered owner over invited owner                     | Retain: Unit logic test |
|  190 | **R** |   G   | returns null when there is no owner                             | Retain: Unit logic test |

### `src/lib/issues/status.test.ts`

Total Declarations: 10

| Line | Mark  | Class | Declaration                                            | Rationale               |
| ---: | :---: | :---: | :----------------------------------------------------- | :---------------------- |
|   15 | **R** |   G   | should return Circle for new statuses                  | Retain: Unit logic test |
|   20 | **R** |   G   | should return CircleDot for in-progress statuses       | Retain: Unit logic test |
|   25 | **R** |   G   | should return Disc for closed statuses                 | Retain: Unit logic test |
|   32 | **R** |   G   | should return correct labels                           | Retain: Unit logic test |
|   48 | **R** |   G   | displays 'Open' for the new group (user-facing rename) | Retain: Unit logic test |
|   52 | **R** |   G   | displays 'In Progress' for the in_progress group       | Retain: Unit logic test |
|   56 | **R** |   G   | displays 'Closed' for the closed group                 | Retain: Unit logic test |
|   62 | **R** |   G   | ALL_STATUS_OPTIONS should contain all statuses         | Retain: Unit logic test |
|   68 | **R** |   G   | STATUS_STYLES should have styles for all statuses      | Retain: Unit logic test |
|   75 | **R** |   G   | SEVERITY_STYLES should have styles for all severities  | Retain: Unit logic test |

### `src/lib/issues/utils.test.ts`

Total Declarations: 4

| Line | Mark  | Class | Declaration                                   | Rationale                                                         |
| ---: | :---: | :---: | :-------------------------------------------- | :---------------------------------------------------------------- |
|    5 | **R** |   G   | resolves reportedByUser                       | Retain: Pure business logic / validator / formatter (bug class G) |
|   16 | **R** |   G   | resolves invitedReporter if no reportedByUser | Retain: Pure business logic / validator / formatter (bug class G) |
|   30 | **R** |   G   | resolves reporterName if no user/invited      | Retain: Pure business logic / validator / formatter (bug class G) |
|   41 | **R** |   G   | falls back to Anonymous                       | Retain: Pure business logic / validator / formatter (bug class G) |

### `src/lib/observability/report-error.test.ts`

Total Declarations: 11

| Line | Mark  | Class | Declaration                                                                | Rationale                                            |
| ---: | :---: | :---: | :------------------------------------------------------------------------- | :--------------------------------------------------- |
|   34 | **R** |   G   | forwards the error to Sentry with a pinpoint context                       | Retain: Sentry observability & error handling helper |
|   46 | **R** |   G   | writes a structured log entry with the error under the err key             | Retain: Sentry observability & error handling helper |
|   56 | **R** |   G   | uses a default message when no action is provided                          | Retain: Sentry observability & error handling helper |
|   62 | **R** |   G   | works with non-Error inputs (still captures)                               | Retain: Sentry observability & error handling helper |
|   69 | **R** |   G   | preserves a bestEffort flag in both pipelines                              | Retain: Sentry observability & error handling helper |
|   82 | **R** |   G   | does NOT report an AuthSessionMissingError (normal no-session response)    | Retain: Sentry observability & error handling helper |
|   90 | **R** |   G   | forwards a real auth error (non-AuthSessionMissingError) to Sentry and log | Retain: Sentry observability & error handling helper |
|  106 | **R** |   G   | works with no context argument                                             | Retain: Sentry observability & error handling helper |
|  116 | **R** |   G   | returns a Result err with the supplied code and message                    | Retain: Sentry observability & error handling helper |
|  129 | **R** |   G   | captures the error to Sentry and the logger before returning               | Retain: Sentry observability & error handling helper |
|  137 | **R** |   G   | narrows the Result type to the supplied code literal                       | Retain: Sentry observability & error handling helper |

### `src/lib/report/default-mode.test.ts`

Total Declarations: 3

| Line | Mark  | Class | Declaration                                                   | Rationale               |
| ---: | :---: | :---: | :------------------------------------------------------------ | :---------------------- |
|    5 | **R** |   G   | keeps Quick and Detailed available regardless of batch access | Retain: Unit logic test |
|   12 | **R** |   G   | allows Multiple only with the batch-reporting capability      | Retain: Unit logic test |
|   24 | **R** |   G   | maps Quick to the direct report route                         | Retain: Unit logic test |

### `src/lib/timeline/bucket-rows.test.ts`

Total Declarations: 4

| Line | Mark  | Class | Declaration                                                  | Rationale               |
| ---: | :---: | :---: | :----------------------------------------------------------- | :---------------------- |
|   11 | **R** |   G   | returns no groups for an empty list                          | Retain: Unit logic test |
|   15 | **R** |   G   | groups consecutive rows that share a bucket key              | Retain: Unit logic test |
|   24 | **R** |   G   | opens a new group when the bucket key changes                | Retain: Unit logic test |
|   34 | **R** |   G   | preserves each entry's own bucket alongside the group bucket | Retain: Unit logic test |

### `src/lib/timeline/format.test.ts`

Total Declarations: 11

| Line | Mark  | Class | Declaration                                   | Rationale                                                         |
| ---: | :---: | :---: | :-------------------------------------------- | :---------------------------------------------------------------- |
|    9 | **R** |   G   | formats assigned event                        | Retain: Pure business logic / validator / formatter (bug class G) |
|   14 | **R** |   G   | formats unassigned event                      | Retain: Pure business logic / validator / formatter (bug class G) |
|   19 | **R** |   G   | formats status_changed event                  | Retain: Pure business logic / validator / formatter (bug class G) |
|   30 | **R** |   G   | formats severity_changed event                | Retain: Pure business logic / validator / formatter (bug class G) |
|   41 | **R** |   G   | formats priority_changed event                | Retain: Pure business logic / validator / formatter (bug class G) |
|   52 | **R** |   G   | formats frequency_changed event               | Retain: Pure business logic / validator / formatter (bug class G) |
|   63 | **R** |   G   | formats comment_deleted by author             | Retain: Pure business logic / validator / formatter (bug class G) |
|   71 | **R** |   G   | formats comment_deleted by admin              | Retain: Pure business logic / validator / formatter (bug class G) |
|   79 | **R** |   G   | formats title_changed event                   | Retain: Pure business logic / validator / formatter (bug class G) |
|   90 | **R** |   G   | formats machine_reassigned event              | Retain: Pure business logic / validator / formatter (bug class G) |
|  105 | **R** |   G   | handles unknown status enum values gracefully | Retain: Pure business logic / validator / formatter (bug class G) |

### `src/lib/timeline/resolve-person.test.ts`

Total Declarations: 4

| Line | Mark  | Class | Declaration                                                         | Rationale               |
| ---: | :---: | :---: | :------------------------------------------------------------------ | :---------------------- |
|    6 | **R** |   G   | resolves a real user to their current name, not invited             | Retain: Unit logic test |
|   17 | **R** |   G   | resolves an invited user with the invited flag set                  | Retain: Unit logic test |
|   28 | **R** |   G   | resolves a deleted user (FK nulled, both ids null) to 'Former user' | Retain: Unit logic test |
|   39 | **R** |   G   | falls back safely if a user id is present but the name join missed  | Retain: Unit logic test |

### `src/services/issues.readback.test.ts`

Total Declarations: 3

| Line | Mark  | Class | Declaration                                                                      | Rationale               |
| ---: | :---: | :---: | :------------------------------------------------------------------------------- | :---------------------- |
|   17 | **R** |   G   | assertIssuePersisted resolves when the row exists                                | Retain: Unit logic test |
|   30 | **R** |   G   | assertIssuePersisted throws IssueCommitVerificationError when the row is absent  | Retain: Unit logic test |
|   43 | **R** |   G   | IssueCommitVerificationError message includes machineInitials and id but not PII | Retain: Unit logic test |

### `src/test/integration/issue-comment-actions.test.ts`

Total Declarations: 9

| Line | Mark  | Class | Declaration                                                                                      | Rationale                                                                         |
| ---: | :---: | :---: | :----------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------- |
|  233 | **R** |   B   | converts comment to audit trail when author deletes their own comment                            | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  263 | **R** |   B   | converts comment to audit trail with deletedBy='admin' when admin deletes another user's comment | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  290 | **R** |   B   | returns UNAUTHORIZED for unauthenticated user and does not mutate the comment row                | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  316 | **R** |   B   | returns NOT_FOUND when comment does not exist                                                    | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  341 | **R** |   B   | returns UNAUTHORIZED for system comments and does not mutate them                                | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  379 | **R** |   B   | returns UNAUTHORIZED when non-admin tries to delete another user's comment                       | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  456 | **R** |   B   | persists the comment row in the database on happy path                                           | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  578 | **R** |   B   | updates the comment content in the database when the author edits their own comment              | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  602 | **R** |   B   | returns UNAUTHORIZED and does not mutate the comment when a non-author tries to edit             | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |

### `src/test/integration/issue-list-summary.test.ts`

Total Declarations: 3

| Line | Mark  | Class | Declaration                                                            | Rationale                                                                                       |
| ---: | :---: | :---: | :--------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------- |
|   68 | **R** |   I   | counts All as every issue on On the Floor machines, open or closed     | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |
|   97 | **R** |   I   | counts Filtered with the list's filters and All within a group's scope | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |
|  128 | **R** |   I   | returns no reporter, assignee, or user email anywhere in the page data | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |

### `src/test/integration/issue-services.test.ts`

Total Declarations: 42

| Line | Mark  | Class | Declaration                                                                                                 | Rationale                                                                         |
| ---: | :---: | :---: | :---------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------- |
|  155 | **R** |   B   | should update status and create timeline event                                                              | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  189 | **R** |   B   | should update severity and create timeline event                                                            | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  218 | **R** |   B   | should update priority and create timeline event                                                            | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  247 | **R** |   B   | should update frequency and create timeline event                                                           | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  277 | **R** |   B   | should create an issue with guest reporter info                                                             | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  305 | **R** |   B   | should create an anonymous issue                                                                            | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  331 | **R** |   B   | should create a member issue                                                                                | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  359 | **R** |   B   | dedupes a retried submission: same key twice yields one row, returns the existing issue, no second dispatch | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  423 | **R** |   B   | distinct keys create distinct issues                                                                        | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  442 | **R** |   B   | null key skips dedup: two submissions create two rows                                                       | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  480 | **R** |   B   | should create assigned timeline event with actorId                                                          | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  520 | **R** |   B   | reports changed and the replaced assignee                                                                   | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  549 | **R** |   B   | should create unassigned timeline event                                                                     | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  583 | **R** |   B   | should no-op when assignment unchanged                                                                      | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  615 | **R** |   B   | should update title and create timeline event                                                               | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  647 | **R** |   B   | should no-op when title unchanged                                                                           | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  679 | **R** |   B   | auto-watches the reporter when autoWatchReporter is true (default)                                          | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  700 | **R** |   B   | does not auto-watch the reporter when autoWatchReporter is false                                            | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  720 | **R** |   B   | does not insert a watcher row when there is no authenticated reporter                                       | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  755 | **R** |   B   | resolveIssueReporter returns Anonymous for email-only guest, never the email                                | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  830 | **R** |   B   | notifies the assignee when assigning (block 1)                                                              | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  855 | **R** |   B   | passes issue description to notification when present (block 2)                                             | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  890 | **R** |   B   | uses a new persisted event ID when an assignee returns                                                      | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  932 | **R** |   B   | sends a new_issue notification to machine owner (block 3)                                                   | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  956 | **R** |   B   | extracts mention IDs from description and dispatches a mentioned notification (block 5)                     | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  998 | **R** |   B   | does not dispatch a mentioned notification when description has no mentions (block 6)                       | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
| 1029 | **R** |   B   | notifies participants and auto-watches the commenter (block 7)                                              | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
| 1077 | **R** |   B   | dedupes a retried comment: same key twice yields one row, returns the existing comment, no second dispatch  | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
| 1111 | **R** |   B   | distinct keys create distinct comments                                                                      | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
| 1127 | **R** |   B   | does not leak another user's comment via a reused idempotency key (cross-user/cross-issue)                  | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
| 1206 | **R** |   B   | null key skips dedup: two submissions create two rows                                                       | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
| 1232 | **R** |   B   | sends issue_status_changed notification and sets closedAt when closing (block 8)                            | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
| 1261 | **R** |   B   | skips update when status has not changed (no-op) (block 9)                                                  | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
| 1289 | **R** |   B   | uses a new persisted event ID when status cycles back                                                       | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
| 1322 | **R** |   B   | skips update when severity has not changed (no-op) (block 10)                                               | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
| 1350 | **R** |   B   | skips update when priority has not changed (no-op) (block 11)                                               | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
| 1378 | **R** |   B   | skips update when frequency has not changed (no-op) (block 12)                                              | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
| 1435 | **R** |   B   | reserves a fresh number on the destination, updates the issue, and creates a timeline event (block 14)      | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
| 1490 | **R** |   B   | throws when destination machine matches the current one (block 15)                                          | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
| 1508 | **R** |   B   | throws when destination machine does not exist (block 16)                                                   | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
| 1518 | **R** |   B   | throws when issue does not exist (block 17)                                                                 | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
| 1536 | **R** |   B   | createIssue persists the row and returns it findable by id (happy path)                                     | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |

### `src/test/integration/public-issue-submit.test.ts`

Total Declarations: 8

| Line | Mark  | Class | Declaration                                                                                    | Rationale                                                                         |
| ---: | :---: | :---: | :--------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------- |
|  190 | **R** |   B   | member can assign issue to another user                                                        | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  209 | **R** |   B   | retains apron scan attribution on the committed issue-opened event                             | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  229 | **R** |   B   | admin can assign issue to another user                                                         | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  247 | **R** |   B   | member with empty assignedTo normalizes to null                                                | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  264 | **R** |   B   | guest assignedTo is stripped (unauthenticated)                                                 | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  286 | **R** |   B   | non-member (guest role) authenticated user assignedTo is stripped                              | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  325 | **R** |   B   | anonymous submission forces status to 'new' and priority to 'medium' regardless of form values | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  345 | **R** |   B   | authenticated guest user status is forced to 'new'                                             | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |

### `src/test/integration/quick-report-action.test.ts`

Total Declarations: 5

| Line | Mark  | Class | Declaration                                                 | Rationale                                                                         |
| ---: | :---: | :---: | :---------------------------------------------------------- | :-------------------------------------------------------------------------------- |
|   88 | **R** |   B   | forbids a guest                                             | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  100 | **R** |   B   | creates all good rows for a member                          | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  119 | **R** |   B   | creates good rows and reports the bad one (partial failure) | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  140 | **R** |   B   | is idempotent on a repeated idempotency key                 | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  158 | **R** |   B   | rejects a batch over the soft cap                           | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |

### `src/test/integration/recent-issues.test.ts`

Total Declarations: 5

| Line | Mark  | Class | Declaration                                                        | Rationale                                                                                       |
| ---: | :---: | :---: | :----------------------------------------------------------------- | :---------------------------------------------------------------------------------------------- |
|  148 | **R** |   I   | returns ok with properly serialized rows (createdAt as ISO string) | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |
|  185 | **R** |   I   | returns ok with empty array when no issues exist for the machine   | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |
|  196 | **R** |   I   | returns multiple rows ordered newest first (desc createdAt)        | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |
|  243 | **R** |   I   | shows the newest open issues rather than newer closed issues       | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |
|  278 | **R** |   I   | does not expose reporterEmail on returned rows (CORE-SEC-007)      | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |

### `src/test/integration/report-image-dedup.test.ts`

Total Declarations: 3

| Line | Mark  | Class | Declaration                                                              | Rationale                                                                         |
| ---: | :---: | :---: | :----------------------------------------------------------------------- | :-------------------------------------------------------------------------------- |
|  188 | **R** |   B   | first submission links images to the issue (control: deduped=false path) | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  217 | **R** |   B   | idempotent retry does NOT add duplicate issueImages rows (PP-u0v1)       | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |
|  265 | **R** |   B   | idempotent retry without images does not call deleteFromBlob             | Retain: Server Action wiring & DB persistence against real PGlite (CORE-TEST-004) |

### `src/test/integration/supabase/issue-filtering.test.ts`

Total Declarations: 11

| Line | Mark  | Class | Declaration                                                           | Rationale                                                                                       |
| ---: | :---: | :---: | :-------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------- |
|  136 | **R** |   I   | filters by status (OR logic)                                          | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |
|  148 | **R** |   I   | filters by search query (title match)                                 | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |
|  156 | **R** |   I   | filters by search query (issue number match)                          | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |
|  163 | **R** |   I   | filters by search query (machine initials match)                      | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |
|  172 | **R** |   I   | defaults to open statuses when status is undefined                    | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |
|  186 | **R** |   I   | shows all statuses when status is empty array (all)                   | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |
|  194 | **R** |   I   | filters by combined status and machine initials                       | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |
|  208 | **R** |   I   | filters by severity and priority                                      | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |
|  222 | **R** |   I   | filters by owner                                                      | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |
|  237 | **R** |   I   | excludes issues from inactive machines by default                     | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |
|  246 | **R** |   I   | includes inactive machine issues when includeInactiveMachines is true | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |

### `src/test/integration/supabase/issues.test.ts`

Total Declarations: 19

| Line | Mark  | Class | Declaration                                                       | Rationale                                                                                       |
| ---: | :---: | :---: | :---------------------------------------------------------------- | :---------------------------------------------------------------------------------------------- |
|   50 | **R** |   I   | should create an issue with valid data                            | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |
|   76 | **R** |   I   | should enforce machine initials requirement (NOT NULL constraint) | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |
|  100 | **R** |   I   | should default status to 'new' if not provided                    | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |
|  117 | **R** |   I   | should default severity to 'minor' if not provided                | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |
|  167 | **R** |   I   | should query all issues for a machine                             | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |
|  177 | **R** |   I   | should filter issues by status                                    | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |
|  188 | **R** |   I   | should filter issues by severity                                  | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |
|  199 | **R** |   I   | should query issue with relations                                 | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |
|  242 | **R** |   I   | should update issue status                                        | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |
|  257 | **R** |   I   | should update issue severity                                      | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |
|  272 | **R** |   I   | should set closedAt when status is fixed                          | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |
|  289 | **R** |   I   | should assign issue to user                                       | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |
|  328 | **R** |   I   | should create system timeline event                               | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |
|  351 | **R** |   I   | should query timeline events with comments                        | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |
|  397 | **R** |   I   | should order timeline events chronologically                      | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |
|  443 | **R** |   I   | should create an issue with null reporter                         | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |
|  461 | **R** |   I   | should include anonymous issues in member issue lists             | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |
|  505 | **R** |   I   | should delete issues when machine is deleted                      | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |
|  528 | **R** |   I   | should delete timeline events when issue is deleted               | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |

### `src/test/integration/supabase/timeline-invited-conversion.test.ts`

Total Declarations: 1

| Line | Mark  | Class | Declaration                                                                    | Rationale                                                                                       |
| ---: | :---: | :---: | :----------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------- |
|   90 | **R** |   I   | rewrites the person-reference invited→real and drops the invited row on signup | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |

### `src/test/integration/timeline-author-scope.test.ts`

Total Declarations: 3

| Line | Mark  | Class | Declaration                                       | Rationale                                                                                       |
| ---: | :---: | :---: | :------------------------------------------------ | :---------------------------------------------------------------------------------------------- |
|   64 | **R** |   I   | returns only the author's events, across machines | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |
|   72 | **R** |   I   | machineId scope still works unchanged             | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |
|   78 | **R** |   I   | returns [] when no scope is given                 | Retain: DB query correctness and schema invariants against real Postgres/PGlite (CORE-TEST-004) |

### `src/test/unit/comment-validation.test.ts`

Total Declarations: 9

| Line | Mark  | Class | Declaration                                               | Rationale                                                         |
| ---: | :---: | :---: | :-------------------------------------------------------- | :---------------------------------------------------------------- |
|   14 | **R** |   G   | should validate correct issueId and comment               | Retain: Pure business logic / validator / formatter (bug class G) |
|   27 | **R** |   G   | should reject empty comment                               | Retain: Pure business logic / validator / formatter (bug class G) |
|   41 | **R** |   G   | should reject invalid issueId format                      | Retain: Pure business logic / validator / formatter (bug class G) |
|   53 | **R** |   G   | should reject missing issueId                             | Retain: Pure business logic / validator / formatter (bug class G) |
|   61 | **R** |   G   | should reject missing comment                             | Retain: Pure business logic / validator / formatter (bug class G) |
|   69 | **R** |   G   | should trim whitespace and reject whitespace-only comment | Retain: Pure business logic / validator / formatter (bug class G) |
|   84 | **R** |   G   | should accept single character comment                    | Retain: Pure business logic / validator / formatter (bug class G) |
|   93 | **R** |   G   | should accept long comments within limit                  | Retain: Pure business logic / validator / formatter (bug class G) |
|  106 | **R** |   G   | should reject extremely long comments                     | Retain: Pure business logic / validator / formatter (bug class G) |

### `src/test/unit/components/issues/CompactIssueFieldForms.test.tsx`

_Status: Retired on main in prior PR._

### `src/test/unit/components/issues/IssueFilters.test.tsx`

Total Declarations: 12

| Line | Mark  | Class | Declaration                                                                   | Rationale                                                         |
| ---: | :---: | :---: | :---------------------------------------------------------------------------- | :---------------------------------------------------------------- |
|   57 | **R** |   H   | shows status badges on landing (default state)                                | Retain: Accessible UI component state & interaction (bug class H) |
|   66 | **R** |   H   | clears 'Open' group statuses when X is clicked                                | Retain: Accessible UI component state & interaction (bug class H) |
|  101 | **R** |   H   | clears individual status when X is clicked                                    | Retain: Accessible UI component state & interaction (bug class H) |
|  122 | **R** |   H   | clears all active filters when global Clear button is clicked                 | Retain: Accessible UI component state & interaction (bug class H) |
|  143 | **R** |   H   | reflects pre-populated filters prop (q and severity badge)                    | Retain: Accessible UI component state & interaction (bug class H) |
|  161 | **R** |   H   | pushes created_from and created_to params when Created date range is applied  | Retain: Accessible UI component state & interaction (bug class H) |
|  188 | **R** |   H   | pushes updated_from and updated_to params when Modified date range is applied | Retain: Accessible UI component state & interaction (bug class H) |
|  230 | **R** |   H   | shows "My machines" toggle when ownedMachineInitials is non-empty             | Retain: Accessible UI component state & interaction (bug class H) |
|  245 | **R** |   H   | does not show "My machines" toggle when ownedMachineInitials is empty         | Retain: Accessible UI component state & interaction (bug class H) |
|  260 | **R** |   H   | does not show "My machines" toggle when ownedMachineInitials is undefined     | Retain: Accessible UI component state & interaction (bug class H) |
|  270 | **R** |   H   | clicking "My machines" selects all owned machine initials (AFM and MM)        | Retain: Accessible UI component state & interaction (bug class H) |
|  290 | **R** |   H   | clicking "My machines" when all owned selected deselects only owned machines  | Retain: Accessible UI component state & interaction (bug class H) |

### `src/test/unit/components/issues/MetadataDrawer.test.tsx`

Total Declarations: 5

| Line | Mark  | Class | Declaration                                                                                                                | Rationale                                                         |
| ---: | :---: | :---: | :------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------- |
|   57 | **R** |   H   | is one listbox with labeled groups, selects the current value, and focuses it on open                                      | Retain: Accessible UI component state & interaction (bug class H) |
|   77 | **R** |   H   | keeps only the focused option in the Tab order; arrows, Home, and End move focus across groups without selecting or saving | Retain: Accessible UI component state & interaction (bug class H) |
|  113 | **R** |   H   | re-choosing the current value closes without saving                                                                        | Retain: Accessible UI component state & interaction (bug class H) |
|  126 | **R** |   H   | passes the chosen literal value to onSelect                                                                                | Retain: Accessible UI component state & interaction (bug class H) |
|  136 | **R** |   H   | does not open while a save is in flight                                                                                    | Retain: Accessible UI component state & interaction (bug class H) |

### `src/test/unit/components/issues/WatchButton.test.tsx`

Total Declarations: 4

| Line | Mark  | Class | Declaration                                                            | Rationale                                                         |
| ---: | :---: | :---: | :--------------------------------------------------------------------- | :---------------------------------------------------------------- |
|   18 | **R** |   H   | shows the count and a Watch toggle for a signed-in viewer              | Retain: Accessible UI component state & interaction (bug class H) |
|   34 | **R** |   H   | shows the count only for a signed-out visitor                          | Retain: Accessible UI component state & interaction (bug class H) |
|   47 | **R** |   H   | watching updates the toggle and the count without waiting for a reload | Retain: Accessible UI component state & interaction (bug class H) |
|   78 | **R** |   H   | unwatching lowers the count                                            | Retain: Accessible UI component state & interaction (bug class H) |

### `src/test/unit/components/issues/metadata-select-reset-revert.test.tsx`

_Status: Retired on main in prior PR._

### `src/test/unit/components/report/report-form-failed-submit-revert.test.tsx`

Total Declarations: 2

| Line | Mark  | Class | Declaration                                                              | Rationale                                           |
| ---: | :---: | :---: | :----------------------------------------------------------------------- | :-------------------------------------------------- |
|  139 | **R** |   C   | keeps the chosen Severity after the action fails                         | Retain: Form lifecycle & client state (bug class C) |
|  178 | **R** |   C   | clears the Selects when the mount-time value is stale after a tab switch | Retain: Form lifecycle & client state (bug class C) |

### `src/test/unit/delete-comment-audit.test.ts`

Total Declarations: 2

| Line | Mark  | Class | Declaration                                          | Rationale                                                                                   |
| ---: | :---: | :---: | :--------------------------------------------------- | :------------------------------------------------------------------------------------------ |
|   95 | **C** |   G   | should return VALIDATION error for invalid commentId | Consolidate into canonical PGlite keeper src/test/integration/issue-comment-actions.test.ts |
|  108 | **C** |   G   | should return VALIDATION error for missing commentId | Consolidate into canonical PGlite keeper src/test/integration/issue-comment-actions.test.ts |

### `src/test/unit/issue-actions.test.ts`

Total Declarations: 4

| Line | Mark  | Class | Declaration                                         | Rationale                                                                                   |
| ---: | :---: | :---: | :-------------------------------------------------- | :------------------------------------------------------------------------------------------ |
|  118 | **C** |   B   | should return an error if not authenticated         | Consolidate into canonical PGlite keeper src/test/integration/issue-comment-actions.test.ts |
|  137 | **C** |   B   | should validate input                               | Consolidate into canonical PGlite keeper src/test/integration/issue-comment-actions.test.ts |
|  151 | **C** |   B   | should handle database errors gracefully            | Consolidate into canonical PGlite keeper src/test/integration/issue-comment-actions.test.ts |
|  176 | **C** |   B   | should reject comments exceeding COMMENT_MAX images | Consolidate into canonical PGlite keeper src/test/integration/issue-comment-actions.test.ts |

### `src/test/unit/issue-schemas.test.ts`

Total Declarations: 13

| Line | Mark  | Class | Declaration                           | Rationale                                                         |
| ---: | :---: | :---: | :------------------------------------ | :---------------------------------------------------------------- |
|   13 | **R** |   G   | should validate valid status update   | Retain: Pure business logic / validator / formatter (bug class G) |
|   21 | **R** |   G   | should reject invalid status          | Retain: Pure business logic / validator / formatter (bug class G) |
|   29 | **R** |   G   | should reject invalid issueId         | Retain: Pure business logic / validator / formatter (bug class G) |
|   39 | **R** |   G   | should validate valid severity update | Retain: Pure business logic / validator / formatter (bug class G) |
|   47 | **R** |   G   | should reject invalid severity        | Retain: Pure business logic / validator / formatter (bug class G) |
|   55 | **R** |   G   | should reject invalid issueId         | Retain: Pure business logic / validator / formatter (bug class G) |
|   65 | **R** |   G   | should validate valid priority update | Retain: Pure business logic / validator / formatter (bug class G) |
|   73 | **R** |   G   | should reject invalid priority        | Retain: Pure business logic / validator / formatter (bug class G) |
|   81 | **R** |   G   | should reject invalid issueId         | Retain: Pure business logic / validator / formatter (bug class G) |
|   91 | **R** |   G   | should validate assignment to user    | Retain: Pure business logic / validator / formatter (bug class G) |
|   99 | **R** |   G   | should validate unassignment (null)   | Retain: Pure business logic / validator / formatter (bug class G) |
|  107 | **R** |   G   | should reject invalid assignedTo      | Retain: Pure business logic / validator / formatter (bug class G) |
|  115 | **R** |   G   | should reject invalid issueId         | Retain: Pure business logic / validator / formatter (bug class G) |

### `src/test/unit/lib/issues/filters.test.ts`

Total Declarations: 20

| Line | Mark  | Class | Declaration                                                              | Rationale               |
| ---: | :---: | :---: | :----------------------------------------------------------------------- | :---------------------- |
|    5 | **R** |   G   | parses search query                                                      | Retain: Unit logic test |
|   11 | **R** |   G   | parses comma-separated status values                                     | Retain: Unit logic test |
|   17 | **R** |   G   | filters out invalid status values                                        | Retain: Unit logic test |
|   23 | **R** |   G   | parses machine initials                                                  | Retain: Unit logic test |
|   29 | **R** |   G   | parses severity and priority                                             | Retain: Unit logic test |
|   36 | **R** |   G   | parses date range correctly                                              | Retain: Unit logic test |
|   45 | **R** |   G   | handles pagination parameters                                            | Retain: Unit logic test |
|   52 | **R** |   G   | defaults pagination parameters                                           | Retain: Unit logic test |
|   60 | **R** |   G   | handles status=all                                                       | Retain: Unit logic test |
|   66 | **R** |   G   | handles sort parameter                                                   | Retain: Unit logic test |
|   72 | **R** |   G   | defaults sort parameter to updated_desc                                  | Retain: Unit logic test |
|   78 | **R** |   G   | parses include_inactive_machines=true                                    | Retain: Unit logic test |
|   84 | **R** |   G   | parses Summary Widget populations, treating anything but filtered as All | Retain: Unit logic test |
|   95 | **R** |   G   | returns true when q is present                                           | Retain: Unit logic test |
|  100 | **R** |   G   | returns true when status is present                                      | Retain: Unit logic test |
|  105 | **R** |   G   | returns true when machine is present                                     | Retain: Unit logic test |
|  110 | **R** |   G   | returns true when watching filter is set                                 | Retain: Unit logic test |
|  115 | **R** |   G   | returns true when include_inactive_machines is set                       | Retain: Unit logic test |
|  120 | **R** |   G   | returns false when only page/page_size/sort are present                  | Retain: Unit logic test |
|  125 | **R** |   G   | returns false when no params are present                                 | Retain: Unit logic test |

### `src/test/unit/public-issue-schema.test.ts`

Total Declarations: 12

| Line | Mark  | Class | Declaration                                            | Rationale                                                         |
| ---: | :---: | :---: | :----------------------------------------------------- | :---------------------------------------------------------------- |
|    7 | **R** |   G   | should validate valid public issue                     | Retain: Pure business logic / validator / formatter (bug class G) |
|   18 | **R** |   G   | should validate valid public issue without description | Retain: Pure business logic / validator / formatter (bug class G) |
|   28 | **R** |   G   | should reject missing machineId                        | Retain: Pure business logic / validator / formatter (bug class G) |
|   37 | **R** |   G   | should reject invalid machineId                        | Retain: Pure business logic / validator / formatter (bug class G) |
|   47 | **R** |   G   | should reject empty title                              | Retain: Pure business logic / validator / formatter (bug class G) |
|   57 | **R** |   G   | should reject too long title                           | Retain: Pure business logic / validator / formatter (bug class G) |
|   67 | **R** |   G   | should reject too long description                     | Retain: Pure business logic / validator / formatter (bug class G) |
|   78 | **R** |   G   | should reject invalid severity                         | Retain: Pure business logic / validator / formatter (bug class G) |
|   89 | **R** |   G   | should validate valid assignedTo UUID                  | Retain: Pure business logic / validator / formatter (bug class G) |
|  100 | **R** |   G   | should validate empty string assignedTo                | Retain: Pure business logic / validator / formatter (bug class G) |
|  112 | **R** |   G   | should validate missing assignedTo (optional)          | Retain: Pure business logic / validator / formatter (bug class G) |
|  123 | **R** |   G   | should reject invalid assignedTo format                | Retain: Pure business logic / validator / formatter (bug class G) |

### `src/test/unit/public-issue-security.test.ts`

Total Declarations: 1

| Line | Mark  | Class | Declaration                                                   | Rationale                                                                            |
| ---: | :---: | :---: | :------------------------------------------------------------ | :----------------------------------------------------------------------------------- |
|   93 | **C** |   B   | should not expose sensitive database error messages to client | Consolidate error sanitization into src/test/integration/public-issue-submit.test.ts |
