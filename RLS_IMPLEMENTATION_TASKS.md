# RLS & Visibility Implementation Task List

Purpose: Concrete action items to bring the database schema, RLS policies, and documentation into alignment with the assertions in `docs/security/rls-assertions.md` and planned CUJs.

Status Legend (update as you work):
- [ ] TODO
- [~] In Progress
- [x] Done
- [!] Decision / Needs Call

---
## 1. Schema Changes

### 1.1 Visibility Foundations
- [ ] Add `organizations.is_public boolean NOT NULL DEFAULT true`.
- [ ] Add `organizations.public_issue_default text NOT NULL DEFAULT 'private' CHECK (public_issue_default IN ('public','private'))`.
- [ ] Alter `locations.is_public` to nullable (drop NOT NULL & default).
- [ ] Alter `machines.is_public` to nullable (drop NOT NULL & default).
- [ ] Alter `issues.is_public` to nullable (drop NOT NULL & default).
- [ ] (Optional, later) Backfill NULL for rows whose explicit value equals inherited effective value to reduce noise.

### 1.2 Ownership & Relationships
- [ ] Introduce `machine_owners` join table `(machine_id, user_id, created_at)`.
- [ ] Migrate existing `machines.owner_id` into `machine_owners` (one row) or decide to retain both temporarily.
- [!] Decide deprecation path for `machines.owner_id` (keep as primary owner? remove? mirror via trigger?).

### 1.3 Soft Delete / Lifecycle
- [ ] Add `machines.deleted_at timestamp NULL` (soft delete instead of hard delete).
- [ ] Add CHECK / trigger preventing actions on soft-deleted machines except restore.
- [!] Decide whether to add `locations.deleted_at` and/or `issues.deleted_at` now or defer.
- [ ] Enforce: Cannot soft-delete location if machines exist (unless all are soft-deleted first).

### 1.4 Cross-Org Transfer Support (Future-Proofing)
- [ ] Add `locations.is_intake boolean NOT NULL DEFAULT false` (to mark special intake locations) OR introduce `location_type enum('normal','intake')`.
- [ ] Create invariant that an "intake" location is always `is_public = FALSE`.
- [ ] Add trigger (or documented procedure) to clear `machines.is_public` (set NULL) and remove non-shared owners during cross-org transfer.
- [ ] Placeholder stored procedure: `transfer_machine_to_org(machine_id, target_org_id)` (future stub – may raise until implemented).

### 1.5 Integrity & Invariants
- [ ] Trigger: On insert/update machines -> `machines.organization_id` must equal `locations.organization_id`.
- [ ] Trigger: On insert/update issues -> `issues.organization_id` must equal `machines.organization_id`.
- [ ] Trigger: On insert/update comments -> `comments.organization_id` must equal `issues.organization_id`.
- [ ] Trigger: Block direct change of `machines.organization_id` except via approved transfer function.
- [ ] (Optional) Foreign keys referencing org/location/machine chain once IDs are stable.

### 1.6 Permissions Seeding
- [ ] Define canonical permission names (`entity:action` pattern).
- [ ] Seed base permissions (see Section 5 below).
- [ ] Map permissions to initial roles (admin, technician, owner, member, guest) in seed script.
- [ ] Add photo attachment permission names.

### 1.7 Auxiliary Columns / Views
- [ ] (Optional) Add view or materialized view for `effective_machine_visibility`.
- [ ] (Optional) Add view for `effective_issue_visibility` including: explicit vs inherited vs org default applied.
- [ ] Add root listing view `public_organizations_minimal (id, name, subdomain)` restricted to public orgs.
- [ ] (Optional) Add `issue.visibility_origin` enum later if analytics need to differentiate maintenance vs user report.

---
## 2. Functions (SQL / PLpgSQL)
- [ ] `fn_current_org()` – derive org ID from subdomain/session.
- [ ] `fn_is_org_member(user_id, org_id)`.
- [ ] `fn_has_permission(user_id, org_id, permission_name)` (joins roles/permissions).
- [ ] `fn_effective_location_public(location_id)`.
- [ ] `fn_effective_machine_public(machine_id)`.
- [ ] `fn_effective_issue_public(issue_id)` (applies org default if pure inheritance path & org public).
- [ ] `fn_is_machine_owner(user_id, machine_id)`.
- [ ] (Optional) `fn_is_issue_owner(user_id, issue_id)` (reporter or assignee).
- [ ] (Optional) `fn_current_anonymous_session()` if using anonymous session gating.

---
## 3. RLS Policy Implementation

### 3.1 Organizations
- [ ] Select policy: allow if requesting subdomain matches OR listing via root context limited projection (names only for public orgs).
- [ ] Update policy: org admin / role with `organization:update` (visibility toggling included here; no separate permission).

### 3.2 Locations
- [ ] Select: org member OR (org public AND effective location public).
- [ ] Insert/Update/Delete: role-based (`location:create|update|delete`).
- [ ] Prevent delete if machines exist (enforced via BEFORE DELETE trigger; RLS additional safety).

### 3.3 Machines
- [ ] Select: org member OR effective machine public.
- [ ] Insert: role `machine:create`.
- [ ] Update: role `machine:update` OR machine owner for limited fields (notifications, name maybe) – define field whitelist.
- [ ] Soft delete: role `machine:delete` (sets deleted_at) OR machine owner (per spec owner allowance).
- [ ] Transfer (future): only role `machine:transfer` using function.

### 3.4 Issues
- [ ] Select: org member OR effective issue public.
- [ ] Insert (member): `issue:create`.
- [ ] Insert (guest / anonymous): machine effective public AND org allows anonymous issues.
- [ ] Update: issue owner (reporter or assignee) for certain fields; technicians/admin broader via `issue:update`.
- [ ] Delete: role `issue:delete` OR issue owner (reporter or assignee).
- [ ] Merge (future): `issue:merge` permission.

### 3.5 Comments
- [ ] Select: same visibility as parent issue.
- [ ] Insert (member): `comment:create` OR implicit if `issue:create`? Decide.
- [ ] Insert (anonymous): allowed if org permits anonymous comments AND issue effective public.
- [ ] Update/Delete: author (if authenticated). Anonymous authors have no subsequent rights (no session check) per spec.
- [ ] Moderation state changes: role `comment:moderate`.

### 3.6 Attachments
- [ ] Insert with new issue creation: allow if (creating user allowed to create issue) AND (has `issue:attachment_upload` OR guest creation path) AND (for guests restricted to same transaction).
- [ ] Post-creation add: require permission `issue:attachment_upload`.
- [ ] Delete: role `attachment:delete` only (ownership exception TBD).

### 3.7 Machine Owners
- [ ] Select: machine owners table accessible to org members.
- [ ] Insert/Delete: `machine:owner_manage` permission OR admin.

### 3.8 Anonymous Rate Limits
- [ ] Insert: open; RLS ensures org matches; selection maybe restricted or truncated.

### 3.9 Soft-Deleted Filtering
- [ ] Add default policies to hide `deleted_at IS NOT NULL` from non-admin queries.

### 3.10 RLS Setup Scripts (Consolidation)
- [x] Consolidate to a single script: `src/server/db/setup-rls-secure.sql` (runner: `npm run db:setup-rls`).
- [x] Mark `src/server/db/setup-rls-local-supabase.sql` as deprecated (do not modify further).
- [ ] Remove or archive any remaining duplicate policy definitions in snapshots or seeds; ensure no other script creates policies.

---
## 4. Documentation Updates
- [x] Replace any legacy "issue_visibility setting" phrasing with `public_issue_default`.
- [x] Add explicit FALSE scope clarification (self + descendants).
- [x] Clarify guest image upload: allowed ONLY during initial issue creation (no post-add by guest).
- [x] Add cross-org transfer narrative (intake location, clearing visibility, owner filtering, issue migration TBD).
- [x] Insert Explicit Invariants section into `docs/security/rls-assertions.md`.
- [x] Add Permission Catalog section + naming convention.
- [ ] Rename document to `SECURITY_AND_RLS_SPEC.md` (optional) after stabilization.
- [x] Clarify terminology: use “public / not public” (avoid “internal / external”).
- [x] Superadmin bypass explanation (operates outside RLS / dedicated connection role).
- [x] Anonymous ownership: state clearly that anonymous creators have no control after submit (no edit/delete for anon content).
- [x] Document badge decision (Issues list): MVP shows single badge (Public / Not Public) based on effective visibility.
- [x] (Deferred) Enhanced badge semantics: indicate explicit vs inherited visibility origin (design + UI copy + optional view columns).

---
## 5. Permission Catalog (Initial)
Pattern: `resource:action` (lowercase, colon-separated).

Core resource actions:
- organization:update
- location:create
- location:update
- location:delete
- machine:create
- machine:update
- machine:delete (soft)
- machine:transfer (future)
- machine:owner_manage
- issue:create
- issue:update
- issue:delete
- issue:merge (future)
- issue:attachment_upload
- comment:create
- comment:delete
- comment:moderate
- attachment:delete
- moderation:override (broad emergency)

(Extend as needed; seed script must populate these.)

---
## 6. Testing / QA Matrix
- [ ] Visibility inheritance matrix (Org×Location×Machine×Issue explicit/null combos).
- [ ] Role-based CRUD scenarios for each table.
- [ ] Anonymous issue creation allowed / disallowed toggles.
- [ ] Guest attempted attachment after creation (should fail).
- [ ] Soft-deleted machine hidden from guest & member lists; visible to admin with flag.
- [ ] Cross-org transfer attempt blocked (until implemented path exists).
- [ ] Performance: ensure use of indexes for public listing queries.

---
## 7. Explicit Invariants (To Doc + Enforce)
- [ ] `location.organization_id = organizations.id` (FK).
- [ ] `machine.location_id -> location.organization_id = machine.organization_id`.
- [ ] `issue.machine_id -> machine.organization_id = issue.organization_id`.
- [ ] `comment.issue_id -> issue.organization_id = comment.organization_id`.
- [ ] No cross-org machine move by direct UPDATE (must use transfer flow once available).
- [ ] Intake location always `is_public = FALSE` and `is_intake = TRUE` (if that flag exists).
- [ ] A machine in intake location inherits private visibility; setting `machine.is_public = TRUE` is allowed but inert. (Optional normalization: clear to NULL via maintenance script; no trigger required.)

---
## 8. Open Decisions (Track & Resolve)
- [ ] Retain or remove `machines.owner_id` after join table rollout.
- [ ] Implement `issue.visibility_origin` now or later.
- [ ] Ownership vs permissions for attachment deletion (doc currently permission-only; revisit if ownership exception is desired).
- [ ] Whether attachments created by non-owner but with permission can later be deleted by issue owner.
- [ ] Naming of intake location(s) (convention: `__intake__`?).

---
## 9. Migration Sequencing (Pre-Beta Fresh Recreate)
Because we can recreate from scratch, implement in this order:
1. Modify schema DDL to new spec (include new columns nullable from start).
2. Add permission seeds & role mappings.
3. Add helper functions.
4. Add RLS policies referencing functions.
5. Create views for effective visibility (optional at start; can inline functions).
6. Update docs & rename file.
7. Populate sample data & run test matrix.

---
## 10. Nice-to-Have (Defer Unless Time Permits)
- [ ] Materialized visibility view with refresh triggers for analytics.
- [ ] Event log entries for visibility flips & transfers.
- [ ] Automatic backfill script to prune redundant explicit TRUEs once inheritance is validated.

---
## 11. Tracking
Update this file as items complete. Keep decisions documented inline above; do not silently change semantics.

---
## 12. Seed File Strategy (Short & Focused)
- [x] Use `supabase/seed.sql` as an aggregator only (`\i` includes) for local Supabase dev.
- [x] Split base vs dev seeds:
  - Base (prod-safe): `seeds/base/01-permissions.sql` (global permission catalog only).
  - Dev/test only: `seeds/dev/01-infrastructure.sql` (orgs/roles/root locations), `seeds/dev/02-metadata.sql` (org-scoped metadata), `seeds/dev/03-users.sql`, `seeds/dev/04-machines.sql`, `seeds/dev/05-issues.sql`, `seeds/dev/99-supabase-auth.sql` (auth test users + storage).
- [x] Script selection:
  - `./scripts/db-reset.sh local` runs dev seeds (from `seeds/dev`).
  - `./scripts/db-reset.sh preview` runs dev seeds (same as local).
  - `npm run db:reset:postgresql` runs base seeds only (CI/prod-safe).
- [ ] Remove any future duplication across seed files immediately.
