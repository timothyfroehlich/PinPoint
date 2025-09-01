## High-Priority RLS Test Coverage Issues (Drafts)

Source spec: `docs/security/rls-assertions.md`
Purpose: Authoritative draft bodies to open as GitHub issues (4 grouped areas). Copy each section verbatim when creating issues. Each test file references spec sections ("§") in pgTAP descriptions.

---
### Issue 1: RLS Visibility Inheritance Edge Cases (§6)
**Goal:** Extend coverage for untested visibility inheritance permutations and regression guards.

**New File:** `supabase/tests/rls/visibility-inheritance-extended.test.sql`
**Scenarios:**
1. Org public + `public_issue_default='private'` + all NULL chain ⇒ issue private (fallback default private).
2. Explicit TRUE under private ancestor inert (org public, location FALSE, issue TRUE ⇒ effective private).
3. Org private + issue TRUE ⇒ private (explicit TRUE cannot override private org).
4. Machine TRUE, location NULL, org public ⇒ machine public; issue inherits TRUE.
5. Precedence: location NULL, machine FALSE, issue TRUE ⇒ private (first explicit FALSE wins).
6. Location TRUE + issue NULL + org default private ⇒ issue public (TRUE beats default private; no FALSE found).
7. Mid-txn flip org `is_public` TRUE→FALSE: previously effective public issue becomes private without cascading updates (helper recomputation).

**Assertions:** Use `fn_effective_location_public`, `fn_effective_machine_public`, `fn_effective_issue_public`; expect BOOLEAN never NULL. Each test description includes "§6 visibility inheritance".
**Failure Handling:** If expectation mismatch, keep assertion (spec-aligned) and append `-- BUG NOTE:` with actual value.
**Acceptance:** All pass `npm run test:rls`; plan count accurate.

---
### Issue 2: Ownership & Permission Enforcement (§§7–9)
**Goal:** Validate ownership-based allowances, denial paths for missing permissions, and anonymous immutability.

**New File:** `supabase/tests/rls/ownership-policies.test.sql`
**Scenarios:**
1. Machine owner can UPDATE & soft delete machine; non-owner denied.
2. Issue reporter (created_by) and assignee (if model supports; else reporter only) can UPDATE / DELETE; non-owner denied.
3. Anonymous-created issue UPDATE / DELETE attempts (anon & authenticated) denied.
4. Anonymous-created comment UPDATE / DELETE attempts denied (immutability).
5. Missing permission (`issue:delete`, `machine:delete`, `comment:delete`) denies; with permission allows.
6. Machine soft delete by owner vs non-owner.
7. Ensure guests cannot leverage ownership to see private data (ownership row does not bypass visibility if ancestor private) — create private chain, add guest ownership, verify 0 rows visible as anon.

**Assertions:** `lives_ok`/`throws_ok` plus row count invariants; cite "§7–8 ownership/permissions".
**Failure Handling:** Record mismatches with `-- BUG NOTE:`.

---
### Issue 3: Attachments & Comment Moderation / Deletion (§§8–9)
**Goal:** Add attachment permission gating tests and full comment mutation matrix.

**New File:** `supabase/tests/rls/attachments-and-comments-policies.test.sql`
**Scenarios:**
1. Anonymous initial issue creation may include attachment (if allowed) but subsequent anonymous attachment INSERT denied.
2. Auth user without `issue:attachment_upload` denied; with permission allowed.
3. Attachment deletion requires `attachment:delete` (deny without, allow with).
4. Comment author DELETE own comment allowed.
5. Moderator (`comment:moderate`) DELETE any comment (different author) allowed.
6. Member can read comments on private issue (same org); anon cannot.
7. Anonymous comment immutable (UPDATE / DELETE attempts no-op or denied).
8. Auth non-member (guest) can create comment only on effectively public issue; attempt on private issue denied.

**Assertions:** `throws_ok` for permission failures, content unchanged checks, spec citations ("§9.5 comments", "§9.6 attachments").
**Failure Handling:** Add `-- BUG NOTE:` lines for discrepancies.

---
### Issue 4: Structural Guards, Soft Delete Visibility & Superadmin Bypass (§§5,9,10)
**Goal:** Cover structural deletion rules, soft-deleted visibility, intra-org movement success path, intake immutability, and superadmin bypass breadth.

**New File:** `supabase/tests/rls/structural-guards-and-soft-delete.test.sql`
**Scenarios:**
1. Location DELETE blocked while non-deleted machine exists; succeeds after soft-deleting machine (or confirmed blocked by design—document actual behavior).
2. Soft-deleted machines excluded from anon/member default queries; admin with proper permissions can see via explicit filter.
3. Intra-org machine move (change location within same org) succeeds; cross-org already covered elsewhere.
4. Intake location: attempt to set `is_public = TRUE` rejected (or remains FALSE); confirm invariant.
5. Superadmin (RESET role) can see all locations/machines/issues/comments (RLS bypass) — counts > 0 for both orgs.
6. Mid-transaction visibility flag change re-check via helpers (no manual cascade required).

**Assertions:** `throws_ok`, `lives_ok`, row counts; cite "§5 invariants", "§9.3", "§9.8", "§10 superadmin".
**Failure Handling:** `-- BUG NOTE:` for mismatches.

---
### Shared Implementation Notes
Use existing helpers in `supabase/tests/constants.sql` (`set_primary_org_context`, `set_competitor_org_context`, `set_jwt_claims_for_test`). Wrap each file in `BEGIN; ... SELECT * FROM finish(); ROLLBACK;`.
Prefer specific SQLSTATE codes:
- RLS policy denial: `42501`
- CHECK / FK violation: `23514` / `23503`

Each test description should start with the spec citation for easy grep (e.g., "§6 visibility inheritance: ...").

On discovering a bug, do NOT adjust expectation to current behavior; leave the spec-aligned assertion and add a trailing `-- BUG NOTE:` block showing actual result query.

---
### Optional Follow-Up Issue (Not Included Above)
Add an `RLS_COVERAGE_INDEX.md` mapping each spec section to test filenames, enforced in CI via grep (future improvement).

---
Prepared: {{DATE}} (update date when filing issues)
