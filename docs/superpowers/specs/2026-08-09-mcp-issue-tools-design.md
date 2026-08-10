# MCP issue tools — design

**Bead:** PP-u4ab.14 (epic PP-u4ab, MCP remote admin)
**Date:** 2026-08-09
**Status:** approved, not started

## Goal

Four MCP tools so Claude can work an issue end to end from the desk: read one
issue in full, find issues across the collection, comment on an issue, and
change its fields.

## Why this is cheap

Unlike PP-u4ab.12 (`set_machine_pinballmap`), no service extraction is needed.
`src/services/issues.ts` already exports every mutation as a standalone
function, each owning its transaction, timeline event, and notification
delivery plan:

| Field / action | Service function       | Returns                                         |
| :------------- | :--------------------- | :---------------------------------------------- |
| status         | `updateIssueStatus`    | `{issueId, oldStatus, newStatus, deliveryPlan}` |
| severity       | `updateIssueSeverity`  | `{issueId, oldSeverity, newSeverity}`           |
| priority       | `updateIssuePriority`  | `{issueId, oldPriority, newPriority}`           |
| frequency      | `updateIssueFrequency` | `{issueId, oldFrequency, newFrequency}`         |
| title          | `updateIssueTitle`     | `{issueId, oldTitle, newTitle}`                 |
| assignee       | `assignIssue`          | `DeliveryPlan`                                  |
| comment        | `addIssueComment`      | `{comment, deliveryPlan}`                       |

Only `updateIssueStatus`, `assignIssue`, and `addIssueComment` produce a
delivery plan. The other four have no external effect to dispatch.

The MCP tools are wrappers: `checkPermission` → resolve the issue → call the
service → `after(() => dispatchNotification(plan))`. The web edit path is
untouched, so there is no regression surface outside the new files.

## Identification: `machine` + `number`

Every issue tool takes two arguments to name its target: `machine` (initials,
case-insensitive, or UUID — the same shape `resolveMachine` already accepts)
and `number` (the per-machine issue number).

`issue_number` is unique per machine (`unique_issue_number` on
`(machine_initials, issue_number)`), and the pair is already what the surface
speaks: `create_issue` returns `{number, machine, url}`, `get_machine` returns
`openIssues[].number`, and the issue URL is `/m/<INITIALS>/i/<number>`.

Issue UUIDs are deliberately **not** accepted. No tool ever returns one, so
accepting one adds an argument shape the model can never populate. The audit
line still carries `issueId` — `ToolOutcome.issueId` is set from the resolved
row, not from an argument.

A shared `resolveIssue(machine, number)` lands in
`src/lib/mcp/tools/shared.ts` beside `resolveMachine`, throwing
`McpToolError("not_found", …)` with a message pointing at `list_issues`.

## Tools

### `get_issue(machine, number)`

Full detail for one issue: title, description as plain text
(`docToPlainText`), status, severity, priority, frequency, reporter name,
assignee name, `createdAt`/`updatedAt`/`closedAt`, URL, and the comment
thread — each comment as `{author, text, createdAt}`.

Gated on `issues.view` **and** `comments.view`, checked separately so the
thread is omitted rather than the call denied if only `comments.view` fails.

**Never returns an email.** `issues.reporterEmail` exists on the row for
anonymous and invited reporters and must not be selected (CORE-SEC-007). The
reporter falls back to `issues.reporterName`, then `"Anonymous"`.

System rows (`issue_comments.is_system = true`) are excluded. Rendering their
`event_data` into readable history is real work for marginal value — the
status transitions it would describe are already visible as the issue's
current state.

### `list_issues({machine?, status?, severity?, assignee?, limit?, offset?})`

Cross-machine when `machine` is omitted. Each row: `machine`, `number`,
`title`, `status`, `severity`, `priority`, `assignee`, `createdAt`, `url`.

`status` accepts an **array** of `IssueStatus` values plus the shorthands
`"open"` (expands to `OPEN_STATUSES`) and `"closed"` (`CLOSED_STATUSES`).
Taking PP-u4ab.13's lesson up front: `list_machines` shipped `presence` as a
single value and immediately needed widening, because a worklist that cannot
say "these three states" cannot exclude un-actionable rows. Default when
omitted: **open only** — the collection carries closed issues indefinitely and
an unfiltered default would bury the ones that matter.

Paging mirrors `list_machines` exactly: one `where` shared by the page query
and the `count()` query, `count`/`total`/`offset`/`hasMore` in the response,
and a total sort order (`createdAt desc, machineInitials asc, issueNumber
asc`) so page boundaries agree between requests.

The description carries the same drain procedure as `list_machines`, for the
same reason and with more force: `update_issue` writes `status` (the default
filter), `severity`, `priority`, and `assignee` — every filter this tool
offers. Working a filtered worklist while paging it is the normal use, and
`offset += limit` would step over exactly the issues just actioned. The rule:
re-request offset 0 and let the list drain; done when a page comes back
**empty**, not when `total` reaches 0.

Gated on `issues.view`.

### `add_issue_comment(machine, number, comment)`

`comment` is plain text, converted with `plainTextToDoc` (the column is a
`ProseMirrorDoc` jsonb). Calls `addIssueComment` with an idempotency key built
by the same content+10-minute-window UUIDv8 scheme as `create_issue`
(`createIssueIdempotencyKey`), over `(issueId, comment text, userId, window)`.
The service already accepts `idempotencyKey` and dedupes on a partial unique
index.

Returns `{created, commentId, issue: {machine, number, url}}`. `created:
false` means the identical comment already existed and nothing was written —
reporting a dedupe hit as a fresh post is the success-for-work-not-done shape
CORE-ARCH-012 forbids, and `create_issue` already models the honest answer.

`after(() => dispatchNotification(deliveryPlan))`. Gated on `comments.add`.

### `update_issue(machine, number, {status?, severity?, priority?, frequency?, title?, assignee?})`

Per-field permission, because the matrix splits these two ways:

- `issues.update.reporting` — title, status, severity, frequency
- `issues.update.triage` — priority, assignee

Checked only for the fields actually supplied, so a status-only call is not
denied for lacking triage rights.

`assignee` takes a member's full name or UUID, or `null` to unassign, resolved
by a new `resolveAssignee` in `shared.ts`. It is close to `resolveOwner` but
not the same: assignment targets an **active** `userProfiles` row only —
`issues.assigned_to` has no invited-user column, so the invited-user branch
`resolveOwner` carries has nothing to write to and must reject instead.

An update supplying no fields fails as `McpToolError("invalid", …)` rather
than reporting a successful no-op.

**Multi-field updates are not atomic, and the response says so.** Each field
has its own service function with its own transaction. Applying severity then
failing on priority leaves the first write committed. The tool therefore:

1. Applies fields in a fixed order — title, status, severity, frequency,
   priority, assignee.
2. Collects a per-field record `{field, from, to, changed}`.
3. On a service throw, stops and returns a **partial-success** payload:
   `{applied: [...], failed: {field, reason}, partial: true}` — not an error
   result. A blanket failure would tell the caller nothing was written when
   some of it was.
4. Dispatches the collected delivery plans (status, assignee) after the loop,
   for the fields that did commit.

A field supplied at its current value returns `changed: false` — the services
already short-circuit no-ops before opening a transaction.

## Out of scope

- **`issues.reassign`** (moving an issue to another machine). Different
  permission with an `"owner"` clause needing `OwnershipContext`, and it
  changes the issue's URL and number — worth its own bead.
- **Comment editing and deletion.** `comments.edit` and `comments.delete` are
  `"own"` at every level; correct, but no demand yet.
- **Watchers** (`toggleIssueWatcher`).
- **Image attachments** on comments. `addIssueComment` takes
  `imagesMetadata`, but there is no blob-upload path from MCP.

## Permissions note

`verifyToken` requires `accessLevel === "admin"` at the door
(`REQUIRED_ACCESS_LEVEL`), so every permission above resolves to `true` today
and no `OwnershipContext` is ever needed. The per-call `checkPermission` is
defense in depth (CORE-ARCH-008) and is what keeps these tools correct if the
door later opens to technician+.

## Testing

Per CORE-TEST-005, at the cheapest layer that catches the bug class:

- **Unit** (`src/lib/mcp/tools/*.test.ts`) — the comment idempotency key
  (collides within a window, differs across content/issue/user/window,
  parses as a UUID), and `update_issue`'s per-field permission mapping.
  Mirrors `create-issue.test.ts`.
- **Integration** (`src/test/integration/mcp-tools.test.ts`, extending the
  existing file) — service wiring against worker-scoped PGlite via the
  `run*(args, ctx)` handlers: resolution by initials and by UUID, the
  not-found message, `list_issues` filter/paging agreement between page and
  `total`, the comment dedupe path, `update_issue` multi-field success, and
  the partial-failure payload.
- **No E2E.** Nothing here is a browser journey.
