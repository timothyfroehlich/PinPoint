# Issue Creation

## Feature Overview
Issue creation lets organization members use `/issues/create` and anonymous users via QR‑resolved links report problems for a specific machine; both paths validate org context, apply default status and priority, and notify machine owners when configured, while only member creations record activity and anonymous inserts have `createdById = null`. Creation controls are permission‑gated (basic vs full) with the current UI defaulting to full for members, and the public path constrained by server‑side validation; anonymous content is immutable by the author and anonymous initial attachments are currently not implemented.

## Last Reviewed / Last Updated
- Last Reviewed: 2025-11-09
- Last Updated: 2025-11-09

## Key Source Files
- `src/server/api/routers/issue.core.ts`: tRPC router for issues (publicCreate, create, getAll, assignment, status update). Handles validation, inserts, activity, notifications.
- `src/server/api/schemas/issue.schema.ts`: Zod schemas including `issueCreateSchema` and `publicIssueCreateSchema`.
- `src/app/issues/create/page.tsx`: Auth‑guarded Server Component page for member creation; uses Server Action and DAL fetchers.
- `src/app/machines/[machineId]/report-issue/page.tsx`: Anonymous issue reporting page for QR-resolved machine context (correct route structure as of 2025-11-08).
- `src/components/forms/CreateIssueFormServer.tsx`: Member issue creation form with severity and priority fields.
- `src/lib/actions/issue-actions.ts`: Server Action `createIssueAction` used by the form for member flow; includes severity field support.
- `src/lib/issues/assignmentValidation.ts`: Pure business rule validators including `validateIssueCreation` and dependencies.
- `src/app/api/qr/[qrCodeId]/route.ts`: QR route; resolves QR → report URL redirect (redirects to `/machines/[machineId]/report-issue`).
- `src/lib/dal/qr-codes.ts`: QR resolution using services and DB provider.
- `src/server/utils/qrCodeUtils.ts`: Constructs organization‑aware report URLs.
- `src/server/auth/permissions.constants.ts`: Permission constants for creation/edit/attachments.
- `src/server/api/trpc.permission.ts`: Permission‑wrapped procedures (issueCreateProcedure, etc.).
- `src/server/services/notificationService.ts`: Notifies machine owners for new issues.
- `src/server/services/issueActivityService.ts`: Records creation/assignment history (member path).
- `src/lib/utils/visibility-inheritance.ts`: Visibility inheritance helpers (covered by Vitest as of 2025-11-09) used by anonymous gating.
- `src/lib/dal/public-machines.ts`: Anonymous/public DAL fetcher that now shares the visibility helper coverage.

## Detailed Feature Spec
- Member creation flow
  - Access: Authenticated member within an organization context.
  - Form: `/issues/create` lists machines and assignable users; includes both **severity** (reporter's impact assessment) and **priority** (internal scheduling weight) fields; gating via `computeIssueCreationGating` controls priority/assignee visibility based on permissions.
  - Server validation: `issue.core.create` fetches machine + default status/priority; runs `validateIssueCreation`; inserts issue with `createdById = user.id` including severity; records `recordIssueCreated`; sends owner notification.
  - Defaults: Uses org default status and priority (must exist and belong to org).

- Public/anonymous creation flow
  - Entry: User scans machine QR → `/api/qr/[qrCodeId]` → redirect to `/machines/[machineId]/report-issue` for that machine within the org domain.
  - Server validation: `issue.core.publicCreate` requires `publicIssueCreateSchema` (includes reporterEmail), resolves org context, validates resources, inserts with `createdById = null`; activity recording is skipped; notifications sent to owner when applicable.
  - Constraints: Only permitted against machines that are effectively accessible by guests per org visibility and policy; no post‑creation mutation allowed for the anonymous author.

- Visibility & containment
  - Every issue belongs to exactly one machine → location → organization; no floating issues.
  - Effective public/private visibility derives from inheritance and org `public_issue_default` when flags are null.

- Notifications & activity
  - Member path: records creation activity and notifies owner (if configured).
  - Anonymous path: notifies owner; skips activity due to absence of actor.

- Current gaps/TODOs
  - Anonymous initial attachments: Not implemented in `publicCreate`. Align with DB spec (guest may attach during initial creation only) and add org policy checks before enabling.

- Recent updates
  - ✅ Route structure corrected: Anonymous reporting now at `/machines/[machineId]/report-issue` (was `/report/[machineId]`)
  - ✅ Severity field added: Both member and anonymous forms now include severity selector (low/medium/high/critical)
  - ✅ Anonymous UI implemented: Server page exists at `/machines/[machineId]/report-issue` with full form functionality
  - ✅ Full test coverage: Member and anonymous flows validated with integration and E2E tests
  - ✅ 2025-11-09: Added Vitest coverage for visibility inheritance utilities plus expanded `getPublicMachineById` tests to enforce anonymous gating rules; template updated to mock `getDb()` so DAL suites inherit worker-scoped clients.

## Security / RLS Spec
- Organization scoping: All DB access is org‑scoped; RLS enforces `organization_id` matching throughout. See `docs/CORE/DATABASE_SECURITY_SPEC.md`.
- Anonymous/guest permissions:
  - Guests may create issues within visibility limits; anonymous content is immutable by the author.
  - Post‑creation uploads require `attachment:create` (or the spec’s `issue:attachment_upload` equivalent). Current implementation uses `attachment:create` and does not allow uploads through `publicCreate`.
- Soft‑delete guard: Inserting against soft‑deleted machines is rejected by policy/constraint.
- Default resources: Creation requires an org default status and priority; validation fails if missing or cross‑org.
- Comments: Anonymous comments allowed only if `allow_anonymous_comments = TRUE` and issue is effectively public; anonymous authors cannot edit/delete.

References: `docs/CORE/DATABASE_SECURITY_SPEC.md`, `docs/CORE/CUJS_LIST.md` (Anonymous reporting and member internal reporting CUJs).

## Test Spec
- Unit (pure logic)
  - `validateIssueCreation` happy/edge cases: invalid/missing title, cross‑org machine, missing defaults, invalid reporterEmail, success path.
  - Default resource validators: status/priority org mismatch, not default, missing.

- Integration (server boundaries)
  - tRPC `issue.core.create`: authorized member creates issue → inserted with correct org/machine, defaults applied, activity recorded, notification called.
  - tRPC `issue.core.publicCreate`: anonymous create with valid machine in accessible org → inserted with `createdById = null`, defaults applied, activity skipped, notification called.
  - Negative cases: missing defaults; soft‑deleted machine; cross‑org access.
  - Server Action `createIssueAction`: validation error surfacing and success path wiring.

- E2E (journeys)
  - Member flow: Navigate to `/issues/create` → submit valid form → redirected to detail/list; issue visible with correct status/priority.
  - QR anonymous flow: GET `/api/qr/[qrCodeId]` → redirected to machine report page → submit minimal report → success confirmation; issue appears in org public listing where applicable.
  - Permissions/visibility: Guest cannot access internal/private machines; member can report issues for private locations.

- Acceptance criteria
  - Creation always binds to a machine in the same org and applies default status/priority.
  - Anonymous creation never records activity and never allows post‑creation mutation by the author.
  - Soft‑deleted machines reject new issues.
  - Notifications to machine owner fire on success when configured.

## Associated Test Files
- Current (as of 2025-11-08)
  - `src/lib/actions/issue-actions.server.test.ts` - Server Action create flow validation
  - `src/lib/actions/issue-actions.createIssueAction.integration.test.ts` - Server Action integration tests with whitespace validation
  - `src/server/api/routers/issue.core.create.integration.test.ts` - Member tRPC procedure integration tests with canonical context helpers
  - `src/server/api/routers/issue.core.publicCreate.integration.test.ts` - Anonymous tRPC procedure integration tests with visibility coverage
  - `e2e/issues/issue-create-member.e2e.test.ts` - Member flow E2E tests with severity field coverage
  - `e2e/issues/issue-create-anon-qr.e2e.test.ts` - Anonymous QR flow E2E tests using sanctioned APIs
  - `src/test/helpers/test-context.ts` - Canonical test context helper for integration tests

- Planned
  - `src/lib/issues/assignmentValidation.issueCreation.unit.test.ts` - Pure business logic unit tests for issue creation validation

## UI Spec (concise)
- Screens & Routes
  - Member: `/issues/create` (breadcrumbs: Home → Issues → Create). Success → detail/list page (as implemented by form action). Failure → stay with inline errors. Includes severity and priority fields.
  - Anonymous: `/machines/[machineId]/report-issue` (target of QR resolution, implemented as of 2025-11-08). Success → confirmation page or public issue view; Failure → stay with inline errors.

- States
  - Loading: initial server data fetch; render skeleton or disabled form until machines/users load.
  - Empty: if no machines, disable submit and show “No machines available” helper.
  - Error: validation errors under fields; generic submit failure toast; auth-gated fallback via `AuthGuard` on member route.
  - Validation: client-side hints if present; server action returns field errors mapped to inputs.

- Form Contract
  - Member: fields — machine (required), title (required), description (optional), **severity** (required: low/medium/high/critical), priority (shown when full permission granted), assignee (shown when gating allows). Submit enabled only when required fields valid.
  - Anonymous: fields — title (required), description (optional), **severity** (required: low/medium/high/critical), reporterEmail (required), submitterName (optional); machineId derives from route.
  - Messages: use Zod schema messages for title/email; show one-line inline errors; keep button disabled during submission.
  - Attachments: not in create form; public path does not allow uploads.

- Components & A11y
  - shadcn/ui: `Input`, `Textarea`, `Select/Combobox`, `Button`, `Form` primitives.
  - Labels associated with inputs; required indicators; error text in elements with `role="alert"` where applicable; focus first invalid field on submit.

- Responsive
  - Single column on mobile; two-column layout allowed at ≥md if listing optional controls (priority/assignee).

- Copy
  - Page title: “Create New Issue”; CTA: “Create Issue”; common errors: “Issue title cannot be empty”, “Invalid reporter email format”.

- Selectors (use for E2E)
  - `data-testid="issue-form"`
  - `data-testid="machine-select"`, `data-testid="title-input"`, `data-testid="description-input"`
  - `data-testid="severity-select"` (shown on both member and anonymous forms as of 2025-11-08)
  - `data-testid="priority-select"`, `data-testid="assignee-select"` (shown when gated, member only)
  - `data-testid="reporter-email-input"`, `data-testid="submitter-name-input"` (anonymous route)
  - `data-testid="submit-button"`, `data-testid="error-summary"`

- Analytics
  - None presently; add event hooks if/when analytics are introduced.
