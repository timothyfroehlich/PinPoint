# Test coverage map

_Last updated: 2026-10-02 (first produced by the nightly routine for bead
PP-b1n). This map is **hand-maintained** — no job regenerates it, so edits here
are safe and will not be clobbered._

This is the **inverse** of the spec audits: for each user-facing feature
surface, where is it tested? The per-spec view ("does this spec violate the
'Test What We Own' principle?") lives in
[e2e-audit-2026-05.md](./e2e-audit-2026-05.md) and
[unit-test-audit-2026-06.md](./unit-test-audit-2026-06.md). This map answers the
other direction — "for feature X, which layers cover it?" — so coverage gaps are
visible at a glance.

## How to read it

Columns are the four test layers, cheapest-to-run first:

- **Unit** — Vitest unit / RTL component tests (`src/**/*.test.ts(x)` outside
  `integration/`). Pure logic, form-state lifecycle, component UI state.
- **Integration** — PGlite / Supabase integration tests
  (`src/test/integration/**`, plus a few colocated `*.integration.test.ts`).
  Server Action wiring, DB query correctness, permission enforcement, RLS.
- **Smoke** — fast Playwright smoke specs (`e2e/smoke/**`): "renders without
  500" + a thin happy path.
- **Full E2E** — full Playwright journeys (`e2e/full/**`): multi-step
  cross-page flows (bug class F).

A ✓ means **at least one test file at that layer maps to the surface** — it is a
presence signal, not a completeness or quality score. A blank cell is a surface
with no test file at that layer; read it as "look here before assuming it's
covered," not "definitely untested." The bug-class → cheapest-layer mapping (so
a blank Full-E2E cell is often correct by design) is in the
[`pinpoint-testing`](../../.agents/skills/pinpoint-testing/SKILL.md) skill.

> **Maintenance.** This map was grounded in the test files that existed when it
> was last updated, bucketed by feature surface. It is hand-maintained: when you
> add a feature surface, or add a test layer for an existing one, add or tick the
> row in the same PR. Representative files are cited to make a cell checkable, not
> to list every test — a cited file may later be renamed or pruned (several E2E
> specs are slated for that in the `e2e-audit-2026-05.md` backlog) without the ✓
> changing, since the ✓ only claims that _some_ file covers the surface at that
> layer; prefer the stabler unit/integration file when reciting.

## Authentication & onboarding

| Feature surface                     | Unit | Integration | Smoke | Full E2E | Representative tests                                                                                                     |
| ----------------------------------- | :--: | :---------: | :---: | :------: | ------------------------------------------------------------------------------------------------------------------------ |
| Sign up / log in / log out          |  ✓   |      ✓      |   ✓   |          | `(auth)/actions.test.ts`, `supabase/auth-actions.test.ts`, `e2e/smoke/auth-flows.spec.ts`                                |
| Password reset / change             |  ✓   |      ✓      |       |    ✓     | `settings/change-password-action.test.ts`, `supabase/password-reset.test.ts`, `e2e/full/change-password.spec.ts`         |
| OAuth sign-in & provider callbacks  |  ✓   |      ✓      |       |          | `(auth)/oauth-actions.test.ts`, `auth/callback/route.test.ts`, `(auth)/oauth-actions.integration.test.ts`                |
| OAuth consent / MCP authorization   |  ✓   |      ✓      |       |          | `oauth/consent/actions.test.ts`, `.well-known/oauth-protected-resource/route.test.ts`, `supabase/mcp-oauth-hook.test.ts` |
| Invite → signup conversion          |  ✓   |      ✓      |       |    ✓     | `test/unit/invite-user-validation.test.ts`, `invited_users.test.ts`, `e2e/full/invite-signup.spec.ts`                    |
| Account deletion                    |  ✓   |      ✓      |       |          | `settings/delete-account-action.test.ts`, `account-deletion.test.ts`                                                     |
| Identity guards / internal accounts |  ✓   |             |       |    ✓     | `lib/auth/identity-guards.test.ts`, `lib/auth/internal-accounts.test.ts`, `e2e/full/privilege-reset.spec.ts`             |

## Issues

| Feature surface                         | Unit | Integration | Smoke | Full E2E | Representative tests                                                                                                                                                  |
| --------------------------------------- | :--: | :---------: | :---: | :------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Report / quick report                   |  ✓   |      ✓      |   ✓   |    ✓     | `report/unified-report-form.test.tsx`, `quick-report-action.test.ts`, `e2e/smoke/quick-report.spec.ts`, `e2e/full/report-modes.spec.ts`                               |
| Issue detail / comments                 |  ✓   |      ✓      |   ✓   |    ✓     | `components/issues/StickyCommentComposer.test.tsx`, `issue-comment-actions.test.ts`, `e2e/smoke/issues-crud.spec.ts`, `e2e/full/issue-detail-sticky-composer.spec.ts` |
| Issue list / filters / pagination       |  ✓   |      ✓      |   ✓   |    ✓     | `components/issues/IssueListPagination.test.tsx`, `issue-list-summary.test.ts`, `e2e/smoke/issue-list.spec.ts`, `e2e/full/issue-list-extended.spec.ts`                |
| Metadata (status / severity / assignee) |  ✓   |      ✓      |       |    ✓     | `components/issues/IssueMetadata.test.tsx`, `issue-services.test.ts`, `e2e/full/status-overhaul.spec.ts`                                                              |
| Watch / subscribe                       |  ✓   |      ✓      |       |          | `test/unit/components/issues/WatchButton.test.tsx`, `notifications.test.ts`                                                                                           |
| Export (CSV)                            |  ✓   |             |       |          | `(app)/issues/export-action.test.ts`, `lib/export/csv.test.ts`, `components/issues/ExportButton.test.tsx`                                                             |
| Summary widgets                         |  ✓   |      ✓      |       |          | `components/issues/IssueSummaryWidgets.test.tsx`, `issue-list-summary.test.ts`                                                                                        |
| Issue / comment images                  |  ✓   |      ✓      |   ✓   |          | `server/actions/images.test.ts`, `report-image-dedup.test.ts`, `e2e/smoke/image-upload.spec.ts`                                                                       |
| Reassign issue to another machine       |      |      ✓      |       |    ✓     | `issue-services.test.ts`, `e2e/full/issues-reassign-machine.spec.ts`                                                                                                  |

## Machines

| Feature surface                          | Unit | Integration | Smoke | Full E2E | Representative tests                                                                                                                                   |
| ---------------------------------------- | :--: | :---------: | :---: | :------: | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Roster / machine view & saved views      |  ✓   |      ✓      |       |    ✓     | `components/machines/view/MachineViewTable.test.tsx`, `machine-view-saved-views.test.ts`, `e2e/full/machine-view-saved-views.spec.ts`                  |
| Machine info / hero / scan hub           |  ✓   |      ✓      |   ✓   |    ✓     | `m/[initials]/(tabs)/info-hero.test.tsx`, `machine-services.test.ts`, `e2e/smoke/machine-scan-hub.spec.ts`, `e2e/full/machine-info.spec.ts`            |
| Machine create / edit form               |  ✓   |      ✓      |       |          | `m/new/create-machine-form.test.tsx`, `machine-form-actions.test.ts`                                                                                   |
| Machine settings tab (inline / autosave) |  ✓   |      ✓      |       |    ✓     | `test/unit/components/machines/use-auto-save.test.ts`, `machine-settings-actions.test.ts`, `e2e/full/machine-settings.spec.ts`                         |
| Owner select / transfer / promotion      |  ✓   |      ✓      |       |    ✓     | `m/[initials]/(tabs)/edit/machine-owner-transfer.test.tsx`, `machine-owner-promotion.test.ts`, `e2e/full/machine-owner-picker.spec.ts`                 |
| Presence / status                        |  ✓   |      ✓      |       |          | `lib/machines/presence.test.ts`, `machine-presence-action.test.ts`                                                                                     |
| Apron cards                              |  ✓   |      ✓      |   ✓   |    ✓     | `components/machines/apron/ApronCardFace.test.tsx`, `apron-card-actions.test.ts`, `e2e/smoke/apron-card-stress.spec.ts`, `e2e/full/apron-card.spec.ts` |
| Machine deletion                         |  ✓   |      ✓      |       |          | `test/unit/components/machines/ConfirmingDeleteButton.test.tsx`, `machine-deletion-action.test.ts`                                                     |
| Canonical path / proxy / hub URL         |  ✓   |             |   ✓   |          | `lib/machines/canonical-path.test.ts`, `test/unit/proxy-machine-canonical.test.ts`, `e2e/smoke/proxy-boundary.spec.ts`                                 |
| Manufacturer / OPDB tags                 |  ✓   |      ✓      |       |          | `lib/machines/manufacturer.test.ts`, `manufacturer-tags.test.ts`, `opdb-tags.test.ts`                                                                  |

## Machine timeline

| Feature surface                     | Unit | Integration | Smoke | Full E2E | Representative tests                                                                                                                    |
| ----------------------------------- | :--: | :---------: | :---: | :------: | --------------------------------------------------------------------------------------------------------------------------------------- |
| Timeline rows, composer & filters   |  ✓   |      ✓      |       |    ✓     | `components/machines/timeline/MachineTimelineComposer.test.tsx`, `machine-timeline-events.test.ts`, `e2e/full/machine-timeline.spec.ts` |
| Timeline event formatting           |  ✓   |      ✓      |       |          | `lib/timeline/format-machine-event.test.ts`, `machine-timeline-actions.test.ts`                                                         |
| Timeline permissions / author scope |      |      ✓      |       |          | `machine-timeline-permissions.test.ts`, `timeline-author-scope.test.ts`                                                                 |

## Collections & tags

| Feature surface                    | Unit | Integration | Smoke | Full E2E | Representative tests                                                                                                                                                                             |
| ---------------------------------- | :--: | :---------: | :---: | :------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Collections CRUD & view            |  ✓   |      ✓      |   ✓   |    ✓     | `components/collections/CreateCollectionDialog.test.tsx`, `collections-actions.test.ts`, `collections-user.test.ts`, `e2e/smoke/collections.spec.ts`, `e2e/full/collection-edit-sharing.spec.ts` |
| Collaborators & share / view links |  ✓   |      ✓      |       |    ✓     | `components/collections/CollectionShareDialog.test.tsx`, `collections-collaborators.test.ts`, `e2e/full/collection-edit-sharing.spec.ts`                                                         |
| A person's machines (Owner filter) |  ✓   |      ✓      |   ✓   |          | `test/unit/components/profiles/owned-machines.test.tsx`, `issue-export-scope.test.ts`, `e2e/smoke/owner-machines.spec.ts`                                                                        |
| Tags (OPDB / manufacturer)         |  ✓   |      ✓      |       |          | `lib/tags/opdb.test.ts`, `opdb-tags.test.ts`, `manufacturer-tags.test.ts`                                                                                                                        |

## PinballMap integration

| Feature surface                | Unit | Integration | Smoke | Full E2E | Representative tests                                                                                                                                       |
| ------------------------------ | :--: | :---------: | :---: | :------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Machine ↔ PBM linking          |  ✓   |      ✓      |       |          | `lib/pinballmap/linking.test.ts`, `pinballmap-linking.test.ts` (member-account linking is the Connected-accounts row, not this one)                        |
| Listing control / intent       |  ✓   |      ✓      |       |          | `components/machines/PinballmapListingControl.test.tsx`, `pinballmap-intent.test.ts`                                                                       |
| Insider Connected              |  ✓   |      ✓      |       |    ✓     | `lib/pinballmap/insider-connected.test.ts`, `pinballmap-insider-connected.test.ts`, `e2e/full/machine-pinballmap-insider-connected.spec.ts`                |
| Lineup comparison & confirm    |  ✓   |      ✓      |       |    ✓     | `lib/pinballmap/lineup-comparison.test.ts`, `pinballmap-state.test.ts`, `e2e/full/pinballmap-lineup.spec.ts`                                               |
| Abandoned listings             |  ✓   |      ✓      |       |    ✓     | `components/machines/PinballmapAbandonedEntries.test.tsx`, `pinballmap-abandoned-listings.test.ts`, `e2e/full/machine-pinballmap-abandoned-notice.spec.ts` |
| Comment import / conversion    |  ✓   |      ✓      |       |    ✓     | `lib/pinballmap/comment-conversion.test.ts`, `pinballmap-comment-import.test.ts`, `e2e/full/machine-pinballmap-comment-convert.spec.ts`                    |
| Region alerts                  |  ✓   |      ✓      |       |          | `lib/pinballmap/region-alert-message.test.ts`, `pinballmap-region-alerts.test.ts`                                                                          |
| Outbound write / sync throttle |  ✓   |      ✓      |       |          | `lib/pinballmap/api-token.test.ts`, `pinballmap-outbound-write.test.ts`, `supabase/pinballmap-sync-throttle.test.ts`                                       |
| User credentials (Vault RPC)   |  ✓   |      ✓      |       |          | `settings/connected-accounts/pinballmap-account-row.test.tsx`, `supabase/pinballmap-credentials-rpc.test.ts`                                               |

## Notifications

| Feature surface               | Unit | Integration | Smoke | Full E2E | Representative tests                                                                                                                                                                   |
| ----------------------------- | :--: | :---------: | :---: | :------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| In-app notification list      |  ✓   |      ✓      |       |    ✓     | `components/notifications/NotificationList.test.tsx`, `notifications.test.ts`, `e2e/full/email-and-notifications.spec.ts`                                                              |
| Email dispatch / threading    |  ✓   |      ✓      |       |          | `lib/notifications/email-threading.test.ts`, `supabase/email-transport.test.ts`, `supabase/mailpit.test.ts`                                                                            |
| Discord DM / channel delivery |  ✓   |      ✓      |   ✓   |    ✓     | `lib/notifications/channels/discord-channel.test.ts`, `notification-discord-batch.test.ts`, `e2e/smoke/admin-discord-integration.spec.ts`, `e2e/full/discord-dm-preferences.spec.ts`   |
| Preferences & unsubscribe     |  ✓   |      ✓      |       |    ✓     | `settings/notifications/notification-preferences-form.test.tsx`, `notification-preferences-action.test.ts`, `api/unsubscribe.route.test.ts`, `e2e/full/discord-dm-preferences.spec.ts` |
| Resource-URL deep links       |  ✓   |             |       |          | `lib/notifications/resource-url.test.ts`                                                                                                                                               |
| Discord activity summary      |  ✓   |      ✓      |       |          | `lib/discord/activity-summary/message.test.ts`, `schedule.test.ts`, `discord-activity-summary.test.ts`, `supabase/discord-activity-summary.test.ts`                                    |

## Admin

| Feature surface                    | Unit | Integration | Smoke | Full E2E | Representative tests                                                                                                                                     |
| ---------------------------------- | :--: | :---------: | :---: | :------: | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User management (promote / remove) |      |      ✓      |       |    ✓     | `admin/user-management.test.ts`, `e2e/full/admin-users.spec.ts`, `e2e/full/admin-remove-invited-user.spec.ts`                                            |
| Discord integration config         |  ✓   |      ✓      |   ✓   |          | `settings/connected-accounts/test-discord-dm-action.test.ts`, `admin/discord-integration-actions.test.ts`, `e2e/smoke/admin-discord-integration.spec.ts` |
| PinballMap integration config      |  ✓   |      ✓      |       |          | `admin/integrations/pinballmap/read-model.test.ts`, `admin/pinballmap-integration-actions.test.ts`                                                       |
| Region-alerts config               |  ✓   |      ✓      |       |          | `lib/pinballmap/region-alert-message.test.ts`, `admin/pinballmap-region-alerts-config.test.ts`                                                           |

## Profiles & people

| Feature surface                       | Unit | Integration | Smoke | Full E2E | Representative tests                                                                                                            |
| ------------------------------------- | :--: | :---------: | :---: | :------: | ------------------------------------------------------------------------------------------------------------------------------- |
| Profile view / edit                   |  ✓   |      ✓      |   ✓   |    ✓     | `u/[id]/profile-editor.test.tsx`, `profile-update-action.test.ts`, `e2e/smoke/profile.spec.ts`, `e2e/full/profile-edit.spec.ts` |
| Profile feed & stats                  |  ✓   |      ✓      |       |          | `test/unit/components/profiles/profile-stat-grid.test.tsx`, `profile-feed-queries.test.ts`                                      |
| Person hover card / person-card route |  ✓   |      ✓      |       |          | `components/people/PersonHoverCard.test.tsx`, `person-card-route.test.ts`                                                       |
| Username / account settings           |  ✓   |      ✓      |       |    ✓     | `settings/account-email.test.tsx`, `email-case.test.ts`, `e2e/full/username-account-settings.spec.ts`                           |

## Settings

| Feature surface        | Unit | Integration | Smoke | Full E2E | Representative tests                                                                                                                                    |
| ---------------------- | :--: | :---------: | :---: | :------: | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Settings shell loads   |      |             |   ✓   |          | `e2e/smoke/settings-loads.spec.ts`                                                                                                                      |
| Reporting default mode |  ✓   |             |       |          | `settings/reporting/default-report-mode-form.test.tsx`, `lib/report/default-mode.test.ts`                                                               |
| Connected accounts     |  ✓   |      ✓      |       |    ✓     | `settings/connected-accounts/connected-accounts-section.test.tsx`, `pinballmap-user-credentials.test.ts`, `e2e/full/pinballmap-account-linking.spec.ts` |

## Public / unauthenticated routes

| Feature surface                   | Unit | Integration | Smoke | Full E2E | Representative tests                                                                                                                                         |
| --------------------------------- | :--: | :---------: | :---: | :------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Public reporting                  |  ✓   |      ✓      |   ✓   |    ✓     | `test/unit/public-issue-security.test.ts`, `public-issue-submit.test.ts`, `e2e/smoke/public-reporting.spec.ts`, `e2e/full/public-reporting-extended.spec.ts` |
| Public machine access             |      |             |   ✓   |    ✓     | `e2e/smoke/proxy-boundary.spec.ts`, `e2e/full/machines-public-access.spec.ts`                                                                                |
| Route protection / middleware     |  ✓   |             |       |    ✓     | `lib/supabase/middleware.test.ts`, `e2e/full/public-routes-audit.spec.ts`                                                                                    |
| Landing / about / terms / privacy |      |             |   ✓   |    ✓     | `e2e/smoke/landing-page.spec.ts`, `e2e/full/about-page.spec.ts`                                                                                              |
| Legacy resource redirects         |  ✓   |             |   ✓   |          | `(auth)/login-redirect.test.ts`, `e2e/smoke/legacy-resource-redirects.spec.ts`                                                                               |
| Quick search                      |  ✓   |      ✓      |       |          | `components/layout/QuickSearch.test.tsx`, `quick-search.test.ts`                                                                                             |
| Cookie consent                    |  ✓   |             |       |    ✓     | `lib/cookies/preferences.test.ts`, `e2e/full/cookie-consent.spec.ts`                                                                                         |
| Help center & FAQ                 |      |             |       |    ✓     | `e2e/full/admin-help.spec.ts` (admin help page); the `help/*` MDX pages and FAQ have no dedicated test                                                       |
| What's New / changelog            |      |             |       |          | no dedicated test — `src/app/(site)/whats-new/` (page + `ChangelogSeenMarker` unread badge) is unmapped                                                      |

## Dashboard, navigation & app shell

| Feature surface              | Unit | Integration | Smoke | Full E2E | Representative tests                                                                                            |
| ---------------------------- | :--: | :---------: | :---: | :------: | --------------------------------------------------------------------------------------------------------------- |
| Dashboard                    |  ✓   |      ✓      |       |    ✓     | `components/issues/QuickRecentIssues.test.tsx`, `dashboard.test.ts`, `e2e/full/dashboard.spec.ts`               |
| Header / tab bar / nav       |  ✓   |             |   ✓   |    ✓     | `components/layout/AppHeader.test.tsx`, `e2e/smoke/navigation.spec.ts`, `e2e/full/soft-keyboard-reflow.spec.ts` |
| Responsive layout / overflow |      |             |   ✓   |    ✓     | `e2e/smoke/responsive-overflow.spec.ts` (canonical class D), `e2e/full/soft-keyboard-reflow.spec.ts`            |

## MCP server & API routes

| Feature surface                         | Unit | Integration | Smoke | Full E2E | Representative tests                                                                                 |
| --------------------------------------- | :--: | :---------: | :---: | :------: | ---------------------------------------------------------------------------------------------------- |
| MCP tools (create / update issue, etc.) |  ✓   |      ✓      |       |          | `lib/mcp/tools/create-issue.test.ts`, `lib/mcp/verify-token.test.ts`, `mcp-tools.test.ts`            |
| API routes (search, logs, mock uploads) |  ✓   |      ✓      |       |          | `api/quick-search/route.test.ts`, `api/client-logs.route.test.ts`, `uploads/[...path]/route.test.ts` |

## Cross-cutting: permissions & roles

| Feature surface                   | Unit | Integration | Smoke | Full E2E | Representative tests                                                                                                                                         |
| --------------------------------- | :--: | :---------: | :---: | :------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Permission matrix / role defaults |  ✓   |      ✓      |   ✓   |    ✓     | `test/unit/permissions-matrix.test.ts`, `issue-detail-permissions.test.ts`, `e2e/smoke/issue-detail-permissions.spec.ts`, `e2e/full/technician-role.spec.ts` |
| Resource predicates & RLS         |  ✓   |      ✓      |       |          | `lib/permissions/machines.test.ts`, `supabase/email-privacy-rls.test.ts`, `protected-action-pilots.test.ts`                                                  |

## Shared UI primitives & utilities

| Feature surface                           | Unit | Integration | Smoke | Full E2E | Representative tests                                                                                  |
| ----------------------------------------- | :--: | :---------: | :---: | :------: | ----------------------------------------------------------------------------------------------------- |
| UI primitives (button, input, selects…)   |  ✓   |             |       |          | `components/ui/button.test.tsx`, `components/ui/multi-select.test.tsx`                                |
| Form scaffolding (save / cancel / revert) |  ✓   |             |       |          | `components/save-cancel-buttons.test.tsx`, `test/unit/components/InlineEditableFieldPresets.test.tsx` |
| Rich text / TipTap / markdown             |  ✓   |             |       |    ✓     | `lib/tiptap/render.test.ts`, `lib/markdown.test.ts`, `e2e/full/rich-text.spec.ts`                     |
| Pure utilities (dates, url, result…)      |  ✓   |             |       |          | `lib/dates.test.ts`, `lib/url.test.ts`, `lib/result.test.ts`, `lib/sanitize-html-config.test.ts`      |
| Rate limiting / DB errors                 |  ✓   |      ✓      |       |          | `lib/rate-limit.test.ts`, `lib/db/postgres-errors.test.ts`, `transaction-tripwire.test.ts`            |

## Observability, config & tooling

| Feature surface                 | Unit | Integration | Smoke | Full E2E | Representative tests                                                                                                               |
| ------------------------------- | :--: | :---------: | :---: | :------: | ---------------------------------------------------------------------------------------------------------------------------------- |
| Error reporting / Sentry policy |  ✓   |      ✓      |       |          | `components/SentryInitializer.test.tsx`, `lib/observability/sentry-policy.test.ts`, `api/client-logs.route.test.ts`                |
| Config / env validation         |  ✓   |             |       |          | `test/config-validation.test.ts`, `test/unit/supabase-env.test.ts`                                                                 |
| Codebase lint rules             |  ✓   |             |       |          | `test/lint/action-naming.test.ts`, `test/lint/oxlint-fixtures.test.ts`                                                             |
| Script & hook guards            |  ✓   |             |       |          | `test/unit/scripts/db-target-guards.test.ts`, `test/unit/drizzle-push-guard.test.ts`, `test/unit/hooks/verify-guard-stack.test.ts` |

## Known gaps worth a second look

These are blank cells where the blank may be a real gap rather than a
by-design layer choice. None is a finding on its own — each is a prompt to
confirm the surface's bug class has a cheaper owner:

- **Machine create / edit form** has no Full-E2E row; creation is exercised
  only indirectly (e.g. `machine-with-invite.spec.ts`). Class B/C are correctly
  owned by integration + RTL, so this is likely fine.
- **Admin user management** has no unit row — expected, since it is class B/E
  (integration-owned), with Full-E2E for the journey.
- **Reporting default mode** and **Resource-URL deep links** are unit-only;
  both are pure logic (class G), so that is the cheapest correct layer.
- **Settings shell** is smoke-only (class D "renders"); the individual setting
  surfaces have their own deeper rows above.
- **What's New / changelog** (`src/app/(site)/whats-new/`) has no test at any
  layer, including the `ChangelogSeenMarker` unread-badge behavior — a genuine
  gap, not a by-design blank.
- **Help center** is Full-E2E-only via `admin-help.spec.ts`; the member-facing
  `help/*` MDX pages and the FAQ accordion have no test. Mostly static content,
  so the gap is low-risk, but the FAQ accordion is interactive (class H).
- **Machine maintenance tab** (`m/[initials]/(tabs)/maintenance`) has no
  dedicated row; it composes already-mapped pieces (issues card, machine
  timeline, apron, ops box), so it is covered indirectly rather than directly.
