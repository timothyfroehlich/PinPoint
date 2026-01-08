# Machine QR Codes via Initials Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Switch QR-generated public report links to use machine initials (slug) while keeping the public form public and preselected, and continue storing machineId on submission.

**Architecture:** QR links point to `/report?machineInitials=ABC&source=qr`; the public report page resolves the requested machine by initials and sets the select default accordingly. Form submission still posts `machineId` (UUID) for creation; server action continues deriving initials from DB. Update helpers/tests accordingly.

**Tech Stack:** Next.js 16 Server Components, TypeScript strictest, Drizzle for machine lookup, existing public report flow, qrcode helper.

---

### Task 1: Update URL helper to use initials

**Files:**

- Modify: `src/lib/machines/report-url.ts`
- Modify: `src/lib/machines/report-url.test.ts`

**Steps:**

1. Adjust builder signature to accept `machineInitials` (string) instead of `machineId` and generate `/report?machineInitials=ABC[&source=qr]`.
2. Update tests to expect initials-based URLs.
3. Run targeted tests: `pnpm test -- src/lib/machines/report-url.test.ts`.

---

### Task 2: Public report page honors machineInitials

**Files:**

- Modify: `src/app/report/default-machine.ts`
- Modify: `src/app/report/default-machine.test.ts`
- Modify: `src/app/report/page.tsx`

**Steps:**

1. Extend resolver to accept `requestedMachineId` OR `requestedMachineInitials`, preferring a matching machine by initials, then id, else first.
2. Update tests to cover initials selection and fallback behavior.
3. In `page.tsx`, parse `machineInitials` from `searchParams` and pass both `machineId` and `machineInitials` into resolver; keep `source` handling.
4. Keep form submission field `machineId` unchanged; only default selection changes.
5. Run targeted tests: `pnpm test -- src/app/report/default-machine.test.ts`.

---

### Task 3: QR generation uses initials

**Files:**

- Modify: `src/app/(app)/m/[initials]/qr-section.tsx`
- Modify: `src/app/(app)/m/[initials]/page.tsx`
- Modify: `src/lib/machines/qr.test.ts` (if needed for data URL still fine)

**Steps:**

1. Build report URL with `machineInitials` (slug) instead of UUID.
2. Ensure QR card shows the initials-based URL; keep wording accurate.
3. Verify layout remains two-column (no code change expected).

---

### Task 4: Verification

**Steps:**

1. Targeted: `pnpm test -- src/lib/machines/report-url.test.ts src/app/report/default-machine.test.ts`.
2. Quick gate: `pnpm run check`.
3. If time, rerun `pnpm run preflight` (already clean, but preferred before PR update).

---

Plan ready. Proceed with superpowers:executing-plans. Which execution approach—run here now?\*\*\*
