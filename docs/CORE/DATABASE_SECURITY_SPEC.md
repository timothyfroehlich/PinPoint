# Database Security Specification

**Last Updated**: September 1, 2025  
**Last Reviewed**: September 1, 2025  

Authoritative specification for data visibility, containment, permissions, and row‑level security (RLS) behavior in PinPoint.

---
## 1. Purpose & Scope
Defines the rules that MUST be enforced at the database (Postgres RLS + constraints) and respected by application logic. Anything not specified here is out of scope or deferred.

---
## 2. Terminology
- Anonymous user: Request with no authenticated identity.
- Guest: Any user (anonymous OR authenticated) lacking membership in the current organization. All anonymous users are guests; some guests are authenticated.
- Member: Authenticated user with a membership row in the organization.
- Admin: Member role with broad organization‑scoped management authority.
- Machine Owner: User listed in machine ownership who has machine/issue privileges independent of other role permissions.
- Issue Owner: Reporter or current assignee (both authenticated users).
- Superadmin: Out‑of‑band privileged operator executing outside normal RLS constraints.

---
## 3. Core Principles
1. Least privilege: Guests see only public data; members see organization data; admins manage most data within their org.
2. Declarative visibility: `is_public` inheritance + `public_issue_default`; no stored “effective” flags.
3. Deterministic containment: Every issue ties to one machine → location → organization.
4. Soft over hard delete: Preserve history; reversible where feasible via `deleted_at`.
5. Enforced invariants: Use FK, CHECK, triggers, and RLS helpers over conventions.
6. Operational separation: Superadmin actions are exceptional and never part of normal request paths.

---
## 4. Containment Hierarchy (Authoritative)
Organization → Location → Machine → Issue

Rules:
- Each Location has exactly one Organization.
- Each Machine has exactly one Location (hence one Organization).
- Each Issue has exactly one Machine (hence one Location & Organization).
- Denormalized `organization_id` on lower tables MUST match ancestry for performant RLS filtering.
- No “floating” issues or machines outside the chain.

---
## 5. Invariants (Must Always Hold)
Enforce via FK, CHECK, triggers, policy predicates:
- `machines.organization_id = locations.organization_id` for its `location_id`.
- `issues.organization_id = machines.organization_id`.
- `comments.organization_id = issues.organization_id`.
- No direct UPDATE to `machines.organization_id` (future transfers go through a controlled function).
- Intake locations are permanently non‑public.
- Soft‑deleted machines (`deleted_at IS NOT NULL`) reject new issues.
- Guests never rely on ownership; only effective public visibility grants access.
- Location deletion is blocked if any non‑deleted machines exist.

---
## 6. Visibility / `is_public` Inheritance
Hierarchy: Organization (root) → Location → Machine → Issue

Behavior:
- Organization `is_public` is required (non‑NULL root).
- Descendants use nullable `is_public`; NULL = inherit parent effective visibility.
- Explicit `FALSE`: node + descendants are private (does not alter siblings/ancestors).
- Explicit `TRUE`: opt‑in to being public if ancestors allow (cannot override a private ancestor).
- Issue fallback: If chain down to Issue is all NULL and org is public, apply `public_issue_default` (`public` | `private`).
- Recomputations are logical; no cascading updates are required.

Simplified algorithm (Issue perspective):
1. If org private ⇒ private.
2. Walk Location → Machine → Issue: first explicit FALSE ⇒ private; first explicit TRUE remembered.
3. If no explicit FALSE and at least one TRUE ⇒ public.
4. If no explicit TRUE/FALSE ⇒ use `public_issue_default` (org must be public).

Edge notes:
- Missing intermediate (e.g., machine without a location) inherits from nearest ancestor.
- Setting TRUE under a private ancestor is inert but allowed.
- Issue explicit FALSE always overrides org default.

Reference examples:
- Private org + anything ⇒ all private.
- Public org + all NULL + default=public ⇒ issue public.
- Public org + location FALSE ⇒ descendants private.
- Public org + chain NULL + issue FALSE ⇒ issue private.

---
## 7. Roles & Permission Model
Conceptual layers:
- Guest: Read public; may create issues (and initial attachments) within visibility limits; no post‑creation mutation.
- Member: Organization data access per RLS; mutations gated by permissions/ownership.
- Admin: Elevated; bypass visibility filters within org where specified; manage configuration & assets.
- Superadmin: Operational emergency/maintenance only (outside normal RLS path).

Ownership (machine & issue) augments but does not replace explicit permissions.

---
## 8. Permission Catalog (Authoritative)
Pattern: `resource:action`.

Organization/Governance:
- `organization:update`

Location:
- `location:create`
- `location:update`
- `location:delete`

Machine:
- `machine:create`
- `machine:update`
- `machine:delete` (soft)
- `machine:transfer` (future)
- `machine:owner_manage`

Issue:
- `issue:create`
- `issue:update`
- `issue:delete`
- `issue:merge` (future)
- `issue:attachment_upload`

Comment/Moderation:
- `comment:create`
- `comment:delete`
- `comment:moderate`
- `attachment:delete`
- `moderation:override`

Notes:
- Ownership grants limited overlapping powers (e.g., issue owner can perform basic edits) but administrative permissions remain authoritative.
- All new permissions MUST follow the naming pattern.

---
## 9. Entity Rules

### 9.1 Organization Access & Public Listing
- Organization data is accessed only within its subdomain context.
- Public listing (root, no subdomain) returns only: `id`, `name`, `subdomain` (optional lightweight logo) for rows with `organizations.is_public = TRUE`.
- Members may view their own memberships; org admins may list their members.
  
Note: Organization visibility toggling is governed by general organization update authority (admin role / `organization:update`), not a separate permission.

Implementation note: Anon listing is exposed via a dedicated minimal view/function pair (`public_organizations_minimal` / `fn_public_organizations_minimal`) that returns only public organizations with minimal fields. The base `organizations` table remains unavailable to anonymous users.


### 9.2 Locations
- Belong to an organization; nullable `is_public` with inherit semantics. `TRUE` is effective only if the org is public; `FALSE` hides the location and all descendants.

### 9.3 Machines
- Belong to a Location → Organization; nullable `is_public`.
- Machine Owners: users with an ownership row; gain machine and related issue management within defined bounds.
- Prefer soft delete (see 9.3.2) over hard delete.

#### 9.3.1 Movement (Intra‑Org)
- Reassign by updating `location_id` within the same `organization_id` only.
- Direct `organization_id` mutation is blocked.
- Visibility recalculates via inheritance after move.

#### 9.3.2 Soft Delete
- `deleted_at` (+ optional `deleted_by`) marks inactive.
- Hidden from guest/member default queries; visible to admins when explicitly requested.
- No new issues while soft‑deleted; issue INSERT must validate the target machine is not soft‑deleted (policy/constraint enforced).
- Restoration clears `deleted_at`.

#### 9.3.3 Future Cross‑Org Transfer (Deferred)
- Dedicated function (not raw UPDATE). Intake location (`is_public = FALSE` / `is_intake = TRUE`).
- Clear machine `is_public` (set NULL); strip owners not in destination org.
- Cascade `organization_id` changes across machine and issues atomically.

### 9.4 Issues
- Tie to a single Machine; nullable `is_public` inherits upward; fallback uses org `public_issue_default`.
- Internal/Not Public: any issue whose effective visibility is private (explicit FALSE or inherited private). No extra flag required.
- Creation guard: creating an issue against a soft‑deleted machine is rejected.

#### 9.4.1 Visibility Badges
- MVP: Public | Not Public. Future enhancement may distinguish explicit vs inherited private.

#### 9.4.2 Admin Analytics & Fleet History
- Admins bypass visibility filters inside their org for analytical views.
- Movement history must be logged (activity or future `machine_location_history`).
- Candidate metrics: time in private intake, MTBF, issue churn.

### 9.5 Comments
- Belong to Issues. Authors may soft delete their own comments; moderation may override.
- Public read: guests and authenticated non‑members may read comments for issues they can access (effective public).
- Member read: organization members may read all comments for issues in their organization.
- Authenticated create: authenticated users (members or non‑members) may create comments on issues they can access, subject to organization policy; non‑members limited to issues with effective public visibility.
- Anonymous create: allowed only when `organizations.allow_anonymous_comments = TRUE` and the issue is effectively public; anonymous authors cannot edit/delete afterward.
- Author modify: the original author may update/delete their own authenticated comments; anonymous comments are immutable by their creator.
- Moderator override: users with `comment:moderate` may update/delete any comment within their organization.

### 9.6 Attachments
- Belong to Issues. Guests may attach only during initial issue creation.
- Post‑creation uploads require `issue:attachment_upload`.
- Deletions require `attachment:delete` (ownership exception TBD; currently none).

### 9.7 Anonymous Content
- Anonymous users can create issues (+ initial attachments) and comments; cannot edit/delete afterward.
- No ownership persistence; rate limiting is enforced separately.

### 9.8 Deletion Rules (General)
- Use soft delete where defined; hard deletes are reserved for superadmin/retention tooling.
- Required permissions unless ownership exception applies:
  - Location: `location:delete`
  - Machine: `machine:delete` (soft)
  - Issue: `issue:delete`
  - Comment: `comment:delete`
  - Attachment: `attachment:delete`
- Owner allowances:
  - Machine owner may soft delete the machine.
  - Issue owner (reporter or assignee) may delete the issue barring moderation constraints.
  - Comment author may delete their own comment.
- Location deletion is blocked while non‑deleted machines exist.
- Cross‑org transfer (future) is separate from deletion.

### 9.9 Commercial Models
- Belong to the platform (no org) and are globally viewable; deletion restricted to superadmin.

---
## 10. Superadmin Bypass
- Executes outside RLS (privileged role/maintenance channel).
- Full visibility and mutation for corrective operations only.
- Not available to application request paths.

---
## 11. Future/Deferred Items
- Machine cross‑org transfer implementation.
- `machine:transfer` and `issue:merge` operational semantics.
- Enhanced visibility badge differentiation (explicit vs inherited private).
- Optional `visibility_origin`/`purpose` enums for issues.
- Dedicated movement history table.

---
## 12. Visibility Quick Examples
- Private org → everything private.
- Public org + all NULL + default=public → issue public.
- Public org + location FALSE → descendants private.
- Public org + chain NULL + issue FALSE → issue private.

---
## 13. Change Management
- Any modification to permissions or visibility semantics MUST update this document before implementation merges.
- Tests (RLS + application) should cite section numbers (for example, “§6 visibility inheritance: explicit FALSE precedence”).

---
End of specification.
