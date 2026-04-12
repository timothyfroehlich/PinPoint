# CSV Issue Export

**Date**: 2026-04-06
**Status**: Draft
**Origin**: Discord discussion (Eric E., Becca S., Neil Wilson, Tim) — 2026-03-16

## Problem

Operators want to identify which machines have the most issues and spot
recurring problems to inform tournament bank decisions. The app shows
individual issues well, but there's no way to see all games and all issues
simultaneously for cross-cutting analysis. A CSV export lets users leverage
spreadsheet tools (pivot tables, sorting, filtering, Gemini/Claude analysis)
without PinPoint needing to build and maintain analytics features.

## Design

### Approach

Server action generates a CSV string, returns it in the action `Result`, and
the client triggers a browser download via `Blob` URL. No API routes, no
intermediate files on disk. Follows the existing server action pattern used
throughout PinPoint.

### Columns

One row per issue. All enum values use human-readable labels, not raw DB values.

| Column      | Source                                                                   | Example                                    |
| ----------- | ------------------------------------------------------------------------ | ------------------------------------------ |
| Issue ID    | `{machineInitials}-{issueNumber}`                                        | AFM-003                                    |
| Machine     | `machines.name` (join)                                                   | Attack from Mars                           |
| Title       | `issues.title`                                                           | Left flipper weak                          |
| Description | First paragraph of `issues.description`, plain text, formatting stripped | Flipper barely reaches the upper playfield |
| Status      | Label from `STATUS_CONFIG`                                               | In Progress                                |
| Severity    | Label from `SEVERITY_CONFIG`                                             | Major                                      |
| Priority    | Label from priority config                                               | High                                       |
| Frequency   | Label from frequency config                                              | Intermittent                               |
| Reporter    | `userProfiles.name` or `reporterName`, never email                       | Becca S.                                   |
| Assigned To | `userProfiles.name` (join), blank if unassigned                          | Tim Froehlich                              |
| Created     | `issues.createdAt` as `YYYY-MM-DD`                                       | 2026-03-15                                 |
| Updated     | `issues.updatedAt` as `YYYY-MM-DD`                                       | 2026-04-01                                 |
| Closed      | `issues.closedAt` as `YYYY-MM-DD`, blank if open                         |                                            |

### Description Handling

Extract only the first paragraph node from the ProseMirrorDoc JSON. Concatenate
its text nodes, ignoring all marks (bold, italic, links, etc.). If the document
is empty or contains no text content, the column is blank.

### Entry Points

**Issues list page** — Download icon button next to the existing view options.
Tooltip: "Export to CSV". Exports issues matching the current filter state
(status, severity, priority, machine, etc.). Uses the same filter-query logic
from `filters-queries.ts` so the export matches exactly what the user sees.

**Machine detail page** — Download icon button in the corner of the open issues
box. Always exports all issues for that machine regardless of any UI state. No
filter params passed — just the `machineInitials`.

### Filenames

- Issues list export: `pinpoint-issues-YYYY-MM-DD.csv`
- Machine page export: `pinpoint-{INITIALS}-issues-YYYY-MM-DD.csv`

### Authentication & Permissions

No new permission matrix entry. The export surfaces data already visible via
`issues.view` (available to all access levels). The server action checks
authentication via `auth.getUser()` — any authenticated user can export. The
export button is hidden for unauthenticated visitors.

Email privacy is enforced: Reporter and Assigned To columns use display names
only. Anonymous reporters show `reporterName` or "Anonymous" if blank.

### Server Action

```
exportIssuesAction(filters: IssueFilters, machineInitials?: string)
  → Result<{ csv: string; fileName: string }>
```

`IssueFilters` reuses the existing filter type from the issues list (status,
severity, priority, machine, search text, etc.). The machine page export passes
no filters and only `machineInitials`.

Steps:

1. Authenticate via `createClient()` → `auth.getUser()`
2. Validate input (filter params via Zod schema)
3. Query issues with joins to machines and userProfiles, applying filters
4. Flatten each row: format dates, resolve enum labels, extract first paragraph
5. Generate CSV string with proper quoting/escaping
6. Return `ok({ csv, fileName })`

Error codes: `UNAUTHORIZED`, `VALIDATION`, `SERVER`.

### Client-Side Download

On receiving a successful result, the client:

1. Creates a `Blob` from the CSV string with type `text/csv;charset=utf-8;`
2. Creates an object URL via `URL.createObjectURL()`
3. Programmatically clicks a temporary `<a>` element with `download` attribute
4. Revokes the object URL

### UI Behavior

- Button shows a loading spinner (disabled state) while the action runs
- Empty result (zero issues matching filters): show a toast "No issues to export"
- Error result: show a toast with the error message

### CSV Generation

Hand-rolled utility function (~30 lines). CSV is a simple format and adding a
library dependency is unnecessary. The utility handles:

- Quoting fields that contain commas, quotes, or newlines
- Escaping double quotes by doubling them
- UTF-8 BOM prefix for Excel compatibility

## Testing

### Unit Tests

- CSV generation utility: proper quoting, escaping, commas in fields, quotes in
  fields, newlines in descriptions
- First-paragraph extraction: empty doc, single paragraph, multiple paragraphs,
  formatted text (marks stripped), no text nodes
- Filename generation: date format, machine initials inclusion

### Integration Tests

- Server action: authenticates, applies filters, returns CSV with expected
  columns and row count
- Unauthenticated request returns `UNAUTHORIZED` error
- Machine-scoped export returns only that machine's issues

### E2E Tests

- Issues list page: click export button, verify download triggers
- Machine detail page: click export button, verify download triggers
- Both buttons clicked per non-negotiable #11

## Scope Boundaries

**In scope**: Everything described above.

**Out of scope** (potential follow-ups):

- JSON export format
- Comments in export
- Aggregated machine summary export
- Date range filter on machine page export
- Export from admin panel
