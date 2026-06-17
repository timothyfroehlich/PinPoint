# User Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add authenticated-only public user profile pages at `/u/[id]` (with inline self-edit, bio/pronouns, avatar upload, activity counts, and a capped owned-machines list linking into the existing collection view), plus a reusable person hover card wherever people are referenced.

**Architecture:** A new Server Component route under `(app)` reads profile data through a small `src/lib/profiles` query module. Self-edit is a client leaf wrapping progressive-enhancement `<form action={serverAction}>`s — one for text fields, one (`FormData` file) for avatar upload that mirrors the existing issue-image Blob flow. The hover card is a client leaf over a new shadcn/Radix `HoverCard` primitive whose body lazy-fetches a JSON payload from a route handler, keeping list queries untouched. Editing of public fields **moves off** the settings page.

**Tech Stack:** Next.js 16 App Router (async `params`), Drizzle ORM + Postgres, Supabase SSR auth, Vercel Blob, `@radix-ui/react-hover-card` (new dep), Zod, Vitest (PGlite integration + RTL), Playwright (E2E).

## Global Constraints

- **Drizzle migrations only** (CORE-ARCH-009): `pnpm db:generate` + `pnpm db:migrate`. Never `drizzle-kit push`.
- **Server Components default** (CORE-ARCH-001); `"use client"` only on interaction leaves.
- **Progressive enhancement** (CORE-ARCH-002): `<form action={serverAction}>`, no inline submit handlers for the text form.
- **Supabase SSR** (CORE-SSR-001/002): `createClient()` then `auth.getUser()` immediately, no logic between.
- **Type safety** (CORE-TS-007): ts-strictest, no `any`, no `!`, no unsafe `as`.
- **Path aliases** (CORE-TS-008): always `~/`.
- **Email privacy** (CORE-SEC-007): profile pages and the hover card never render email.
- **`localhost`, never `127.0.0.1`** (CORE-SEC-008).
- **Accessibility floor** (CORE-A11Y): person-reference triggers are real `<a>`/`<Link>`, never `<div role="button">`.
- **Test at the cheapest layer** (CORE-TEST-005); **worker-scoped PGlite** for integration (CORE-TEST-001).
- Shared helpers (verbatim import paths): `import { type Result, ok, err } from "~/lib/result";` · `import { db } from "~/server/db";` · `import { createClient } from "~/lib/supabase/server";` · `import { serverActionError, reportError } from "~/lib/observability/report-error";` · `import { uploadToBlob, deleteFromBlob } from "~/lib/blob/client";` · `import { validateImageFile } from "~/lib/blob/validation";` · schema from `~/server/db/schema`.
- **Tracks bead PinPoint-5r7** (avatar upload), retitled to "profile".

---

### Task 1: DB migration — add `bio` and `pronouns`

**Files:**

- Modify: `src/server/db/schema.ts` (the `userProfiles` table, after `avatarUrl` ~line 60)
- Create (generated): `drizzle/NNNN_*.sql` + `drizzle/meta/*` via `db:generate`

**Interfaces:**

- Produces: `userProfiles.bio` (`text`, nullable) and `userProfiles.pronouns` (`text`, nullable), consumed by every later task.

- [ ] **Step 1: Add the columns to the schema**

In `src/server/db/schema.ts`, inside the `userProfiles` `pgTable` column object, add directly after the `avatarUrl: text("avatar_url"),` line:

```ts
    bio: text("bio"),
    pronouns: text("pronouns"),
```

- [ ] **Step 2: Generate the migration**

Run: `pnpm db:generate`
Expected: a new `drizzle/NNNN_*.sql` containing `ALTER TABLE "user_profiles" ADD COLUMN "bio" text;` and `... ADD COLUMN "pronouns" text;`, plus a matching `_snapshot.json`.

- [ ] **Step 3: Apply the migration locally**

Run: `pnpm db:migrate`
Expected: applies cleanly, no errors.

- [ ] **Step 4: Verify no drift**

Run: `pnpm db:generate`
Expected: "No schema changes, nothing to migrate."

- [ ] **Step 5: Commit**

```bash
git add src/server/db/schema.ts drizzle/
git commit -m "feat(profiles): add bio and pronouns columns to user_profiles"
```

---

### Task 2: Profile query module

**Files:**

- Create: `src/lib/profiles/queries.ts`
- Test: `src/test/integration/profiles-queries.test.ts`

**Interfaces:**

- Produces:
  - `getProfileById(userId: string): Promise<ProfileRow | null>` where `ProfileRow = { id: string; firstName: string; lastName: string; name: string; avatarUrl: string | null; bio: string | null; pronouns: string | null; role: "guest"|"member"|"technician"|"admin"; createdAt: Date }`
  - `getProfileActivityCounts(userId: string): Promise<{ reported: number; comments: number }>`
  - `PROFILE_MACHINE_CAP = 6`
  - `getCappedOwnedMachines(userId: string): Promise<{ machines: { id: string; initials: string; name: string }[]; total: number; hasMore: boolean }>` — fetches `PROFILE_MACHINE_CAP + 1` to detect overflow; `machines` is sliced to the cap, `hasMore` true when a 7th exists, `total` is a separate exact `count()`.

- [ ] **Step 1: Write the failing integration test**

Create `src/test/integration/profiles-queries.test.ts`. Follow the repo PGlite integration pattern (worker-scoped db, seed via inserts). Use the existing integration harness the same way `src/test/integration/*` files do (import the shared test db helper used by sibling tests in that folder; match their `beforeAll`/seed style).

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import {
  userProfiles,
  machines,
  issues,
  issueComments,
} from "~/server/db/schema";
import {
  getProfileById,
  getProfileActivityCounts,
  getCappedOwnedMachines,
  PROFILE_MACHINE_CAP,
} from "~/lib/profiles/queries";

const USER = "00000000-0000-0000-0000-0000000000a1";

beforeAll(async () => {
  await db.insert(userProfiles).values({
    id: USER,
    email: "p1@example.com",
    firstName: "Pat",
    lastName: "Quinn",
    role: "technician",
    bio: "EM games",
    pronouns: "they/them",
  });
  // 8 owned machines to exercise the cap (cap=6, fetch 7, hasMore=true, total=8)
  for (let i = 0; i < 8; i++) {
    await db.insert(machines).values({
      initials: `OWN${i}`,
      name: `Machine ${i}`,
      ownerId: USER,
    });
  }
  // 2 reported issues
  for (let i = 0; i < 2; i++) {
    await db.insert(issues).values({
      machineInitials: "OWN0",
      issueNumber: i + 1,
      title: `Issue ${i}`,
      reportedBy: USER,
    });
  }
  // need an issue to attach a comment to
  const [iss] = await db
    .insert(issues)
    .values({
      machineInitials: "OWN1",
      issueNumber: 1,
      title: "C",
      reportedBy: USER,
    })
    .returning();
  await db
    .insert(issueComments)
    .values({ issueId: iss.id, authorId: USER, isSystem: false });
});

describe("profile queries", () => {
  it("getProfileById returns the public-safe row", async () => {
    const row = await getProfileById(USER);
    expect(row?.name).toBe("Pat Quinn");
    expect(row?.pronouns).toBe("they/them");
    expect(row?.role).toBe("technician");
  });

  it("getProfileById returns null for unknown id", async () => {
    expect(
      await getProfileById("00000000-0000-0000-0000-0000000000ff")
    ).toBeNull();
  });

  it("getProfileActivityCounts counts reported issues and comments", async () => {
    const counts = await getProfileActivityCounts(USER);
    expect(counts.reported).toBe(3);
    expect(counts.comments).toBe(1);
  });

  it("getCappedOwnedMachines caps at 6 and flags overflow", async () => {
    const res = await getCappedOwnedMachines(USER);
    expect(res.machines).toHaveLength(PROFILE_MACHINE_CAP);
    expect(res.hasMore).toBe(true);
    expect(res.total).toBe(8);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/test/integration/profiles-queries.test.ts`
Expected: FAIL — `~/lib/profiles/queries` cannot be resolved.

- [ ] **Step 3: Implement the query module**

Create `src/lib/profiles/queries.ts`:

```ts
import { eq, count, asc } from "drizzle-orm";
import { db } from "~/server/db";
import {
  userProfiles,
  machines,
  issues,
  issueComments,
} from "~/server/db/schema";

export const PROFILE_MACHINE_CAP = 6;

export interface ProfileRow {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  pronouns: string | null;
  role: "guest" | "member" | "technician" | "admin";
  createdAt: Date;
}

export async function getProfileById(
  userId: string
): Promise<ProfileRow | null> {
  const row = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, userId),
    columns: {
      id: true,
      firstName: true,
      lastName: true,
      name: true,
      avatarUrl: true,
      bio: true,
      pronouns: true,
      role: true,
      createdAt: true,
    },
  });
  return row ?? null;
}

export async function getProfileActivityCounts(
  userId: string
): Promise<{ reported: number; comments: number }> {
  const [reportedRows, commentRows] = await Promise.all([
    db.select({ c: count() }).from(issues).where(eq(issues.reportedBy, userId)),
    db
      .select({ c: count() })
      .from(issueComments)
      .where(eq(issueComments.authorId, userId)),
  ]);
  return {
    reported: reportedRows[0]?.c ?? 0,
    comments: commentRows[0]?.c ?? 0,
  };
}

export async function getCappedOwnedMachines(userId: string): Promise<{
  machines: { id: string; initials: string; name: string }[];
  total: number;
  hasMore: boolean;
}> {
  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: machines.id,
        initials: machines.initials,
        name: machines.name,
      })
      .from(machines)
      .where(eq(machines.ownerId, userId))
      .orderBy(asc(machines.name))
      .limit(PROFILE_MACHINE_CAP + 1),
    db
      .select({ c: count() })
      .from(machines)
      .where(eq(machines.ownerId, userId)),
  ]);
  const total = totalRows[0]?.c ?? 0;
  return {
    machines: rows.slice(0, PROFILE_MACHINE_CAP),
    total,
    hasMore: rows.length > PROFILE_MACHINE_CAP,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/test/integration/profiles-queries.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/profiles/queries.ts src/test/integration/profiles-queries.test.ts
git commit -m "feat(profiles): profile query module (row, activity counts, capped machines)"
```

---

### Task 3: Profile text-edit server action

**Files:**

- Create: `src/app/(app)/u/[id]/actions.ts`
- Test: `src/test/integration/profile-update-action.test.ts`

**Interfaces:**

- Consumes: `userProfiles` schema; `Result`/`ok`/`err`; `createClient`.
- Produces: `updateProfileAction(_prev: UpdateProfileResult | undefined, formData: FormData): Promise<UpdateProfileResult>` where `UpdateProfileResult = Result<{ success: boolean }, "UNAUTHORIZED" | "VALIDATION" | "SERVER">`. Reads fields `firstName`, `lastName`, `pronouns`, `bio`; writes only the caller's own row (no id param — ownership is implicit).

- [ ] **Step 1: Write the failing integration test**

Create `src/test/integration/profile-update-action.test.ts`. The action calls `createClient()` → `auth.getUser()`; mock that to return a seeded user id (match how sibling action tests mock Supabase auth — reuse the same mock helper they use for `~/lib/supabase/server`).

```ts
import { describe, it, expect, beforeAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";

const ME = "00000000-0000-0000-0000-0000000000b1";

vi.mock("~/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: ME } }, error: null }),
    },
  }),
}));

import { updateProfileAction } from "~/app/(app)/u/[id]/actions";

beforeAll(async () => {
  await db.insert(userProfiles).values({
    id: ME,
    email: "me@example.com",
    firstName: "Old",
    lastName: "Name",
    role: "member",
  });
});

function fd(values: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.append(k, v);
  return f;
}

describe("updateProfileAction", () => {
  it("updates the caller's own profile fields", async () => {
    const res = await updateProfileAction(
      undefined,
      fd({
        firstName: "New",
        lastName: "Person",
        pronouns: "she/her",
        bio: "hi",
      })
    );
    expect(res.ok).toBe(true);
    const row = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, ME),
    });
    expect(row?.firstName).toBe("New");
    expect(row?.pronouns).toBe("she/her");
    expect(row?.bio).toBe("hi");
  });

  it("rejects an over-length first name", async () => {
    const res = await updateProfileAction(
      undefined,
      fd({ firstName: "x".repeat(51) })
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("VALIDATION");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/test/integration/profile-update-action.test.ts`
Expected: FAIL — module `~/app/(app)/u/[id]/actions` not found.

- [ ] **Step 3: Implement the action**

Create `src/app/(app)/u/[id]/actions.ts`:

```ts
"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { createClient } from "~/lib/supabase/server";
import { type Result, ok, err } from "~/lib/result";
import { serverActionError } from "~/lib/observability/report-error";

const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(50).optional(),
  lastName: z.string().trim().min(1).max(50).optional(),
  pronouns: z.string().trim().max(40).optional(),
  bio: z.string().trim().max(500).optional(),
});

export type UpdateProfileResult = Result<
  { success: boolean },
  "UNAUTHORIZED" | "VALIDATION" | "SERVER"
>;

function str(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  return typeof v === "string" ? v : undefined;
}

export async function updateProfileAction(
  _prevState: UpdateProfileResult | undefined,
  formData: FormData
): Promise<UpdateProfileResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("UNAUTHORIZED", "Unauthorized");

  const validation = updateProfileSchema.safeParse({
    firstName: str(formData, "firstName"),
    lastName: str(formData, "lastName"),
    pronouns: str(formData, "pronouns"),
    bio: str(formData, "bio"),
  });
  if (!validation.success) return err("VALIDATION", "Invalid input");

  const { firstName, lastName, pronouns, bio } = validation.data;
  try {
    await db
      .update(userProfiles)
      .set({ firstName, lastName, pronouns, bio, updatedAt: new Date() })
      .where(eq(userProfiles.id, user.id));
    revalidatePath(`/u/${user.id}`);
    revalidatePath("/", "layout");
    return ok({ success: true });
  } catch (error) {
    return serverActionError(error, "SERVER", "Failed to update profile", {
      action: "updateProfileAction",
    });
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/test/integration/profile-update-action.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/u/[id]/actions.ts" src/test/integration/profile-update-action.test.ts
git commit -m "feat(profiles): updateProfileAction for inline self-edit (name, pronouns, bio)"
```

---

### Task 4: Avatar upload server action (PinPoint-5r7)

**Files:**

- Create: `src/server/actions/avatar.ts`
- Test: `src/test/integration/avatar-upload-action.test.ts`

**Interfaces:**

- Consumes: `uploadToBlob`, `deleteFromBlob`, `validateImageFile`, `userProfiles`.
- Produces: `uploadAvatarAction(formData: FormData): Promise<UploadAvatarResult>` where `UploadAvatarResult = Result<{ avatarUrl: string }, "AUTH" | "VALIDATION" | "BLOB" | "DATABASE">`. Reads file under key `"avatar"`; uploads to `user-avatars/${userId}/${ts}-${name}`; best-effort deletes the previous avatar; writes `userProfiles.avatarUrl`.

- [ ] **Step 1: Write the failing integration test**

Create `src/test/integration/avatar-upload-action.test.ts`. Mock Supabase auth (as in Task 3) and mock the blob client so no network/token is needed.

```ts
import { describe, it, expect, beforeAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";

const ME = "00000000-0000-0000-0000-0000000000c1";

vi.mock("~/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: ME } }, error: null }),
    },
  }),
}));

const deleteFromBlob = vi.fn(async () => undefined);
vi.mock("~/lib/blob/client", () => ({
  uploadToBlob: async (_file: File, pathname: string) => ({
    url: `https://x.public.blob.vercel-storage.com/${pathname}`,
    pathname,
  }),
  deleteFromBlob: (...args: unknown[]) => deleteFromBlob(...args),
}));

import { uploadAvatarAction } from "~/server/actions/avatar";

beforeAll(async () => {
  await db.insert(userProfiles).values({
    id: ME,
    email: "av@example.com",
    firstName: "Av",
    lastName: "Tar",
    role: "member",
    avatarUrl: "https://x.public.blob.vercel-storage.com/user-avatars/old.png",
  });
});

function fileForm(name: string, type: string, bytes = 2048): FormData {
  const f = new FormData();
  f.append("avatar", new File([new Uint8Array(bytes)], name, { type }));
  return f;
}

describe("uploadAvatarAction", () => {
  it("uploads a valid image, stores the url, and cleans up the old avatar", async () => {
    const res = await uploadAvatarAction(fileForm("me.png", "image/png"));
    expect(res.ok).toBe(true);
    const row = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, ME),
    });
    expect(row?.avatarUrl).toContain("user-avatars/");
    expect(deleteFromBlob).toHaveBeenCalledWith(
      "https://x.public.blob.vercel-storage.com/user-avatars/old.png"
    );
  });

  it("rejects a non-image file", async () => {
    const res = await uploadAvatarAction(fileForm("x.txt", "text/plain"));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("VALIDATION");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/test/integration/avatar-upload-action.test.ts`
Expected: FAIL — `~/server/actions/avatar` not found.

- [ ] **Step 3: Implement the action**

Create `src/server/actions/avatar.ts`:

```ts
"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { createClient } from "~/lib/supabase/server";
import { uploadToBlob, deleteFromBlob } from "~/lib/blob/client";
import { validateImageFile } from "~/lib/blob/validation";
import { type Result, ok, err } from "~/lib/result";
import {
  serverActionError,
  reportError,
} from "~/lib/observability/report-error";

export type UploadAvatarResult = Result<
  { avatarUrl: string },
  "AUTH" | "VALIDATION" | "BLOB" | "DATABASE"
>;

export async function uploadAvatarAction(
  formData: FormData
): Promise<UploadAvatarResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("AUTH", "Unauthorized");

  const file = formData.get("avatar");
  if (!(file instanceof File)) return err("VALIDATION", "No file provided");

  const validation = validateImageFile(file);
  if (!validation.valid)
    return err("VALIDATION", validation.error ?? "Invalid image");

  const existing = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { avatarUrl: true },
  });

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const pathname = `user-avatars/${user.id}/${Date.now()}-${safeName}`;

  let blobUrl: string;
  try {
    const blob = await uploadToBlob(file, pathname);
    blobUrl = blob.url;
  } catch (error) {
    return serverActionError(error, "BLOB", "Failed to upload avatar", {
      action: "uploadAvatarAction",
      userId: user.id,
    });
  }

  try {
    await db
      .update(userProfiles)
      .set({ avatarUrl: blobUrl, updatedAt: new Date() })
      .where(eq(userProfiles.id, user.id));
  } catch (error) {
    return serverActionError(error, "DATABASE", "Failed to save avatar", {
      action: "uploadAvatarAction",
      userId: user.id,
    });
  }

  if (existing?.avatarUrl && existing.avatarUrl !== blobUrl) {
    try {
      await deleteFromBlob(existing.avatarUrl);
    } catch (error) {
      reportError(error, {
        action: "uploadAvatarAction.cleanup",
        bestEffort: true,
        userId: user.id,
      });
    }
  }

  revalidatePath(`/u/${user.id}`);
  revalidatePath("/", "layout");
  return ok({ avatarUrl: blobUrl });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/test/integration/avatar-upload-action.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/actions/avatar.ts src/test/integration/avatar-upload-action.test.ts
git commit -m "feat(profiles): uploadAvatarAction via Vercel Blob (PinPoint-5r7)"
```

---

### Task 5: HoverCard UI primitive

**Files:**

- Modify: `package.json` (add `@radix-ui/react-hover-card`)
- Create: `src/components/ui/hover-card.tsx`

**Interfaces:**

- Produces: `HoverCard`, `HoverCardTrigger`, `HoverCardContent` exports (shadcn pattern).

- [ ] **Step 1: Add the dependency**

Run: `pnpm add @radix-ui/react-hover-card`
Expected: package.json + lockfile updated.

- [ ] **Step 2: Create the primitive**

Create `src/components/ui/hover-card.tsx` (standard shadcn wrapper; match the existing `src/components/ui/*` style — `data-slot`, `cn`):

```tsx
"use client";

import * as React from "react";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import { cn } from "~/lib/utils";

function HoverCard(
  props: React.ComponentProps<typeof HoverCardPrimitive.Root>
) {
  return (
    <HoverCardPrimitive.Root
      data-slot="hover-card"
      openDelay={150}
      closeDelay={100}
      {...props}
    />
  );
}

function HoverCardTrigger(
  props: React.ComponentProps<typeof HoverCardPrimitive.Trigger>
) {
  return (
    <HoverCardPrimitive.Trigger data-slot="hover-card-trigger" {...props} />
  );
}

function HoverCardContent({
  className,
  align = "start",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Content>) {
  return (
    <HoverCardPrimitive.Portal>
      <HoverCardPrimitive.Content
        data-slot="hover-card-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "bg-popover text-popover-foreground z-50 w-64 rounded-md border p-3 shadow-md outline-none",
          className
        )}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  );
}

export { HoverCard, HoverCardTrigger, HoverCardContent };
```

- [ ] **Step 3: Verify it type-checks**

Run: `pnpm typecheck`
Expected: PASS (no errors).

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml src/components/ui/hover-card.tsx
git commit -m "feat(ui): add shadcn HoverCard primitive"
```

---

### Task 6: Person hover card — data route + component

**Files:**

- Create: `src/app/api/users/[id]/card/route.ts`
- Create: `src/components/people/PersonHoverCard.tsx`
- Test: `src/test/integration/person-card-route.test.ts`
- Test: `src/components/people/PersonHoverCard.test.tsx`

**Interfaces:**

- Consumes: `getProfileById`, `getCappedOwnedMachines` (`.total`) from Task 2; `Avatar`/`AvatarImage`/`AvatarFallback`; HoverCard primitive (Task 5).
- Produces:
  - Route `GET /api/users/[id]/card` → JSON `PersonCardPayload = { name: string; avatarUrl: string | null; pronouns: string | null; role: string; machineCount: number }`, 404 when no profile, 401 when unauthenticated.
  - `PersonHoverCard(props: { userId: string | null; invitedId?: string | null; displayName: string; className?: string }): JSX.Element` — real user (`userId` set) → `<Link href={/u/${userId}}>` trigger + lazy-loaded card; otherwise plain `<span>{displayName}</span>`.

- [ ] **Step 1: Write the failing route integration test**

Create `src/test/integration/person-card-route.test.ts`:

```ts
import { describe, it, expect, beforeAll, vi } from "vitest";
import { db } from "~/server/db";
import { userProfiles, machines } from "~/server/db/schema";

const VIEWER = "00000000-0000-0000-0000-0000000000d0";
const TARGET = "00000000-0000-0000-0000-0000000000d1";

vi.mock("~/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: VIEWER } }, error: null }),
    },
  }),
}));

import { GET } from "~/app/api/users/[id]/card/route";

beforeAll(async () => {
  await db.insert(userProfiles).values({
    id: TARGET,
    email: "t@example.com",
    firstName: "Tar",
    lastName: "Get",
    role: "technician",
    pronouns: "she/they",
  });
  await db
    .insert(machines)
    .values({ initials: "CARD1", name: "M", ownerId: TARGET });
});

function req() {
  return new Request("http://localhost/api/users/x/card");
}

describe("GET /api/users/[id]/card", () => {
  it("returns the card payload for an existing profile", async () => {
    const res = await GET(req(), { params: Promise.resolve({ id: TARGET }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      name: "Tar Get",
      role: "technician",
      pronouns: "she/they",
      machineCount: 1,
    });
  });

  it("404s for an unknown id", async () => {
    const res = await GET(req(), { params: Promise.resolve({ id: VIEWER }) });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/test/integration/person-card-route.test.ts`
Expected: FAIL — route module not found.

- [ ] **Step 3: Implement the route handler**

Create `src/app/api/users/[id]/card/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createClient } from "~/lib/supabase/server";
import { getProfileById, getCappedOwnedMachines } from "~/lib/profiles/queries";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const profile = await getProfileById(id);
  if (!profile)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const machines = await getCappedOwnedMachines(id);
  return NextResponse.json({
    name: profile.name,
    avatarUrl: profile.avatarUrl,
    pronouns: profile.pronouns,
    role: profile.role,
    machineCount: machines.total,
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/test/integration/person-card-route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the failing RTL component test**

Create `src/components/people/PersonHoverCard.test.tsx`:

```tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PersonHoverCard } from "./PersonHoverCard";

describe("PersonHoverCard", () => {
  it("renders a profile link for a real user", () => {
    render(<PersonHoverCard userId="abc" displayName="Sarah Chen" />);
    const link = screen.getByRole("link", { name: "Sarah Chen" });
    expect(link).toHaveAttribute("href", "/u/abc");
  });

  it("renders plain text (no link) for an invited user", () => {
    render(
      <PersonHoverCard
        userId={null}
        invitedId="inv1"
        displayName="Invited Person"
      />
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Invited Person")).toBeInTheDocument();
  });

  it("renders plain text for a former user", () => {
    render(<PersonHoverCard userId={null} displayName="Former user" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Former user")).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `pnpm vitest run src/components/people/PersonHoverCard.test.tsx`
Expected: FAIL — component not found.

- [ ] **Step 7: Implement the component**

Create `src/components/people/PersonHoverCard.tsx`:

```tsx
"use client";

import * as React from "react";
import Link from "next/link";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "~/components/ui/hover-card";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";

interface PersonCardPayload {
  name: string;
  avatarUrl: string | null;
  pronouns: string | null;
  role: string;
  machineCount: number;
}

interface PersonHoverCardProps {
  userId: string | null;
  invitedId?: string | null;
  displayName: string;
  className?: string;
}

export function PersonHoverCard({
  userId,
  displayName,
  className,
}: PersonHoverCardProps): React.JSX.Element {
  // Invited or former users: no profile, no card, plain text.
  if (!userId) return <span className={className}>{displayName}</span>;

  const [data, setData] = React.useState<PersonCardPayload | null>(null);
  const [loading, setLoading] = React.useState(false);

  function loadOnce(): void {
    if (data || loading) return;
    setLoading(true);
    fetch(`/api/users/${userId}/card`)
      .then((r) => (r.ok ? r.json() : null))
      .then((payload: PersonCardPayload | null) => setData(payload))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }

  return (
    <HoverCard onOpenChange={(open) => open && loadOnce()}>
      <HoverCardTrigger asChild>
        <Link href={`/u/${userId}`} className={className}>
          {displayName}
        </Link>
      </HoverCardTrigger>
      <HoverCardContent>
        <div className="flex items-center gap-3">
          <Avatar className="size-10">
            {data?.avatarUrl ? (
              <AvatarImage src={data.avatarUrl} alt="" />
            ) : null}
            <AvatarFallback>{displayName.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-semibold">
              {data?.name ?? displayName}
              {data?.pronouns ? (
                <span className="text-muted-foreground ml-1 text-xs font-normal">
                  ({data.pronouns})
                </span>
              ) : null}
            </div>
            {data ? (
              <div className="text-muted-foreground text-xs capitalize">
                {data.role}
              </div>
            ) : null}
          </div>
        </div>
        {data && data.machineCount > 0 ? (
          <Link
            href={`/c/owner/${userId}`}
            className="text-muted-foreground mt-2 block text-xs hover:underline"
          >
            Owns {data.machineCount} machine{data.machineCount === 1 ? "" : "s"}
          </Link>
        ) : null}
        <Link
          href={`/u/${userId}`}
          className="text-primary mt-2 block text-sm hover:underline"
        >
          View profile →
        </Link>
      </HoverCardContent>
    </HoverCard>
  );
}
```

- [ ] **Step 8: Run both test files to verify pass**

Run: `pnpm vitest run src/components/people/PersonHoverCard.test.tsx src/test/integration/person-card-route.test.ts`
Expected: PASS (5 tests total).

- [ ] **Step 9: Commit**

```bash
git add "src/app/api/users/[id]/card/route.ts" src/components/people/PersonHoverCard.tsx src/components/people/PersonHoverCard.test.tsx src/test/integration/person-card-route.test.ts
git commit -m "feat(profiles): PersonHoverCard + lazy card data route"
```

---

### Task 7: Profile page (Server Component, read view)

**Files:**

- Create: `src/app/(app)/u/[id]/page.tsx`
- Create: `src/app/(app)/u/[id]/profile-machines.tsx` (presentational; small)

**Interfaces:**

- Consumes: `getProfileById`, `getProfileActivityCounts`, `getCappedOwnedMachines`, `PROFILE_MACHINE_CAP`; `createClient`; `Avatar*`; the inline-edit client component from Task 8 (`ProfileEditor`) — built next; for this task render read-only and add the editor in Task 8.
- Produces: the `/u/[id]` route. `notFound()` when the profile doesn't exist. Computes `isOwn = user?.id === id`.

- [ ] **Step 1: Implement the page**

Create `src/app/(app)/u/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type React from "react";
import { createClient } from "~/lib/supabase/server";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import {
  getProfileById,
  getProfileActivityCounts,
  getCappedOwnedMachines,
} from "~/lib/profiles/queries";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = await getProfileById(id);
  if (!profile) notFound();

  const [counts, owned] = await Promise.all([
    getProfileActivityCounts(id),
    getCappedOwnedMachines(id),
  ]);
  const isOwn = user?.id === id;
  const memberSince = profile.createdAt.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  return (
    <div className="mx-auto w-full max-w-2xl p-4">
      <header className="flex items-center gap-4">
        <Avatar className="size-16">
          {profile.avatarUrl ? (
            <AvatarImage src={profile.avatarUrl} alt="" />
          ) : null}
          <AvatarFallback>{profile.firstName.charAt(0)}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-xl font-bold">
            {profile.name}
            {profile.pronouns ? (
              <span className="text-muted-foreground ml-2 text-sm font-normal">
                ({profile.pronouns})
              </span>
            ) : null}
          </h1>
          <p className="text-muted-foreground text-sm">
            <span className="capitalize">{profile.role}</span> · member since{" "}
            {memberSince}
          </p>
        </div>
        {isOwn ? (
          <Link
            href={`/u/${id}?edit=1`}
            className="text-primary ml-auto text-sm hover:underline"
          >
            Edit profile
          </Link>
        ) : null}
      </header>

      {profile.bio ? (
        <p className="mt-4 whitespace-pre-line">{profile.bio}</p>
      ) : null}

      <section className="mt-6">
        <h2 className="text-muted-foreground text-xs font-semibold uppercase">
          Activity
        </h2>
        <div className="mt-2 flex gap-6">
          <div>
            <strong>{counts.reported}</strong>{" "}
            <span className="text-muted-foreground text-sm">
              issues reported
            </span>
          </div>
          <div>
            <strong>{counts.comments}</strong>{" "}
            <span className="text-muted-foreground text-sm">comments</span>
          </div>
        </div>
      </section>

      {owned.total > 0 ? (
        <section className="mt-6">
          <h2 className="text-muted-foreground text-xs font-semibold uppercase">
            Owned machines ({owned.total})
          </h2>
          <ul className="mt-2 space-y-1">
            {owned.machines.map((m) => (
              <li key={m.id}>
                <Link href={`/m/${m.initials}`} className="hover:underline">
                  {m.name}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href={`/c/owner/${id}`}
            className="text-primary mt-2 inline-block text-sm hover:underline"
          >
            {owned.hasMore
              ? `View all ${owned.total} →`
              : "View full collection →"}
          </Link>
        </section>
      ) : null}
    </div>
  );
}
```

(The `?edit=1` "Edit profile" link becomes the editor toggle in Task 8; for now it is an inert link — the page must render and pass the smoke check.)

- [ ] **Step 2: Type-check and lint**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 3: Manually verify it renders**

Start the stack if needed (`supabase start`, `pnpm dev`), log in, visit `/u/<your-own-id>`. Confirm header, activity counts, and (if you own machines) the capped list + collection link render; no 500.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/u/[id]/page.tsx"
git commit -m "feat(profiles): /u/[id] profile read view"
```

---

### Task 8: Inline edit client component

**Files:**

- Create: `src/app/(app)/u/[id]/profile-editor.tsx`
- Modify: `src/app/(app)/u/[id]/page.tsx` (render `ProfileEditor` when `isOwn` and `searchParams.edit`)
- Test: `src/app/(app)/u/[id]/profile-editor.test.tsx`

**Interfaces:**

- Consumes: `updateProfileAction` (Task 3), `uploadAvatarAction` (Task 4).
- Produces: `ProfileEditor(props: { initial: { firstName: string; lastName: string; pronouns: string | null; bio: string | null; avatarUrl: string | null } }): JSX.Element`.

- [ ] **Step 1: Write the failing RTL test**

Create `src/app/(app)/u/[id]/profile-editor.test.tsx`. Mock both actions so the form renders without server calls.

```tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("~/app/(app)/u/[id]/actions", () => ({ updateProfileAction: vi.fn() }));
vi.mock("~/server/actions/avatar", () => ({ uploadAvatarAction: vi.fn() }));

import { ProfileEditor } from "./profile-editor";

const initial = {
  firstName: "Pat",
  lastName: "Quinn",
  pronouns: "they/them",
  bio: "EM games",
  avatarUrl: null,
};

describe("ProfileEditor", () => {
  it("pre-fills the form fields from initial values", () => {
    render(<ProfileEditor initial={initial} />);
    expect(screen.getByLabelText(/first name/i)).toHaveValue("Pat");
    expect(screen.getByLabelText(/pronouns/i)).toHaveValue("they/them");
    expect(screen.getByLabelText(/bio/i)).toHaveValue("EM games");
  });

  it("exposes a file input for the avatar", () => {
    render(<ProfileEditor initial={initial} />);
    expect(screen.getByLabelText(/avatar/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run "src/app/(app)/u/[id]/profile-editor.test.tsx"`
Expected: FAIL — component not found.

- [ ] **Step 3: Implement the editor**

Create `src/app/(app)/u/[id]/profile-editor.tsx`:

```tsx
"use client";

import * as React from "react";
import { useActionState } from "react";
import { updateProfileAction, type UpdateProfileResult } from "./actions";
import { uploadAvatarAction } from "~/server/actions/avatar";
import { Input } from "~/components/ui/input";

interface ProfileEditorProps {
  initial: {
    firstName: string;
    lastName: string;
    pronouns: string | null;
    bio: string | null;
    avatarUrl: string | null;
  };
}

export function ProfileEditor({
  initial,
}: ProfileEditorProps): React.JSX.Element {
  const [state, action] = useActionState<
    UpdateProfileResult | undefined,
    FormData
  >(updateProfileAction, undefined);

  return (
    <div className="space-y-6">
      {/* Avatar upload — its own form, posts a File to the avatar action */}
      <form action={uploadAvatarAction} className="space-y-2">
        <label htmlFor="avatar" className="text-sm font-medium">
          Avatar
        </label>
        <input
          id="avatar"
          name="avatar"
          type="file"
          accept="image/jpeg,image/png,image/webp"
        />
        <button
          type="submit"
          className="text-primary block text-sm hover:underline"
        >
          Upload
        </button>
      </form>

      {/* Text fields — progressive-enhancement form */}
      <form action={action} className="space-y-3">
        {state && !state.ok ? (
          <p role="alert" className="text-destructive text-sm">
            Could not save. Check your input.
          </p>
        ) : null}
        <div>
          <label htmlFor="firstName" className="text-sm font-medium">
            First name
          </label>
          <Input
            id="firstName"
            name="firstName"
            defaultValue={initial.firstName}
            required
          />
        </div>
        <div>
          <label htmlFor="lastName" className="text-sm font-medium">
            Last name
          </label>
          <Input
            id="lastName"
            name="lastName"
            defaultValue={initial.lastName}
            required
          />
        </div>
        <div>
          <label htmlFor="pronouns" className="text-sm font-medium">
            Pronouns
          </label>
          <Input
            id="pronouns"
            name="pronouns"
            defaultValue={initial.pronouns ?? ""}
          />
        </div>
        <div>
          <label htmlFor="bio" className="text-sm font-medium">
            Bio
          </label>
          <textarea
            id="bio"
            name="bio"
            defaultValue={initial.bio ?? ""}
            maxLength={500}
            className="border-input w-full rounded-md border p-2"
            rows={3}
          />
        </div>
        <button
          type="submit"
          className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm"
        >
          Save
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run "src/app/(app)/u/[id]/profile-editor.test.tsx"`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire the editor into the page**

In `src/app/(app)/u/[id]/page.tsx`, change the signature to also accept `searchParams`, and render the editor instead of the read body when the owner is in edit mode. Add at the top of the component:

```tsx
export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  const { edit } = await searchParams;
```

Add the import: `import { ProfileEditor } from "./profile-editor";`

Then, immediately after computing `isOwn`, when `isOwn && edit` render the editor (return early with the same outer container + header, but `<ProfileEditor initial={{ firstName: profile.firstName, lastName: profile.lastName, pronouns: profile.pronouns, bio: profile.bio, avatarUrl: profile.avatarUrl }} />` in place of the read sections). Keep the existing read-only render for all other cases.

- [ ] **Step 6: Type-check + manual verify**

Run: `pnpm check`
Expected: PASS. Then visit `/u/<own-id>?edit=1`, change pronouns/bio, Save; confirm the read view reflects the change. Upload a small PNG; confirm the avatar updates.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/u/[id]/profile-editor.tsx" "src/app/(app)/u/[id]/profile-editor.test.tsx" "src/app/(app)/u/[id]/page.tsx"
git commit -m "feat(profiles): inline self-edit (text fields + avatar upload)"
```

---

### Task 9: Settings page — complete the split

**Files:**

- Modify: `src/app/(app)/settings/page.tsx`
- Modify: `src/app/(app)/settings/actions.ts` (remove now-dead `updateProfileAction` + unused imports)
- Delete: `src/app/(app)/settings/profile-form.tsx` (and any colocated test)

**Interfaces:**

- Consumes: nothing new. Removes the settings-side profile editing and owned-machines count; adds a link to the public profile.

- [ ] **Step 1: Confirm the settings profile-form is only used by settings**

Run: `rg -n "profile-form|ProfileForm" src`
Expected: references only under `src/app/(app)/settings/`. (If anything else imports it, stop and reassess.)

- [ ] **Step 2: Remove the profile-form section from the settings page**

In `src/app/(app)/settings/page.tsx`: delete the `<ProfileForm .../>` block and its `import`. Delete the owned-machines `count()` query (`ownedMachinesResult`) and the `ownedMachineCount` usage. Add, in the profile area of the page, a link to the public profile:

```tsx
<Link href={`/u/${user.id}`} className="text-primary text-sm hover:underline">
  View your public profile →
</Link>
```

(Ensure `Link` is imported from `next/link`. Keep the email read-only display, connected accounts, notifications, security, and danger-zone sections untouched.)

- [ ] **Step 3: Delete the profile-form file**

Run: `git rm "src/app/(app)/settings/profile-form.tsx"`
(If a colocated `profile-form.test.tsx` exists, `git rm` it too.)

- [ ] **Step 4: Remove the dead settings action**

In `src/app/(app)/settings/actions.ts`: delete `updateProfileSchema`, `UpdateProfileResult`, and `updateProfileAction`. Remove imports left unused **only if no longer referenced** by the remaining actions in the file (verify each with a quick `rg` within the file before deleting — `userProfiles`, `eq`, `z`, etc. are likely still used by other actions; do not remove those).

- [ ] **Step 5: Verify the build is clean**

Run: `pnpm check`
Expected: PASS — no unused-import or type errors, no dangling references to `ProfileForm`/settings `updateProfileAction`.

- [ ] **Step 6: Commit**

```bash
git add -A "src/app/(app)/settings"
git commit -m "feat(profiles): move profile editing off settings; link to public profile"
```

---

### Task 10: Hover-card rollout — audit and apply

**Files (modify; confirm each during the audit):**

- `src/components/issues/IssueTimeline.tsx` (comment author ~line 294; issue reporter ~line 438)
- `src/components/machines/timeline/MachineTimelineCommentRow.tsx` (author ~line 139)
- `src/components/issues/IssueRow.tsx` (reporter ~line 74)
- `src/components/issues/IssueCard.tsx` (reporter ~line 97)
- `src/app/(app)/m/[initials]/(tabs)/page.tsx` (machine owner ~line 150)
- `src/app/(app)/admin/users/page.tsx` (user name ~line 34-40)
- **Deliberately plain (no change):** the assignee picker (`AssigneePicker.tsx` / `assign-issue-form.tsx`) and the collection header text (`c/owner/[userId]/(tabs)/layout.tsx`).

**Interfaces:**

- Consumes: `PersonHoverCard` (Task 6). Each site must pass the person's `userId` (real-user id or null), optional `invitedId`, and the existing `displayName`.

- [ ] **Step 1: Produce the audit list**

Run: `rg -n "resolvePerson|resolveIssueReporter|\.author\b|owner\.name|authorName|reporter\.name" src`
Write the enumerated result into the PR description as a checklist: each hit marked **upgrade** or **plain**, matching the Files list above. Any new site not in the Files list must be classified before proceeding.

- [ ] **Step 2: Upgrade the issue timeline comment author**

In `src/components/issues/IssueTimeline.tsx`, replace the bare `<span className="font-semibold">{event.author.name}</span>` with:

```tsx
<PersonHoverCard
  userId={event.author.id ?? null}
  displayName={event.author.name}
  className="font-semibold"
/>
```

Add `import { PersonHoverCard } from "~/components/people/PersonHoverCard";`. Confirm `event.author` carries a real user id (it has `{ id, name, avatarFallback }`); if `id` is an invited/synthetic id rather than a `userProfiles.id`, pass `userId={null}` and `invitedId` instead so it degrades to plain text. **Verify the id provenance before wiring.**

- [ ] **Step 3: Upgrade the remaining read displays**

Apply the same substitution at each **upgrade** site from Step 1 (issue reporter in `IssueTimeline.tsx`, `IssueRow.tsx`, `IssueCard.tsx`; `MachineTimelineCommentRow.tsx`; machine owner in `m/[initials]/(tabs)/page.tsx`; admin users list). At each site pass the real `userProfiles.id` as `userId`, or `null` (+ `invitedId`) when the reference is an invited/former user. Leave the assignee picker and collection header unchanged.

- [ ] **Step 4: Verify**

Run: `pnpm check`
Expected: PASS. Then `pnpm smoke` to confirm the issue/machine pages still render.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "feat(profiles): roll out PersonHoverCard across person references"
```

---

### Task 11: E2E coverage

**Files:**

- Create: `e2e/smoke/profile.spec.ts`
- Create: `e2e/profiles/profile-edit.spec.ts`

**Interfaces:**

- Consumes: existing E2E helpers `loginAs`, `TEST_USERS` from `e2e/support/*`.

- [ ] **Step 1: Smoke — profile renders without 500**

Create `e2e/smoke/profile.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { loginAs } from "../support/actions.js";
import { TEST_USERS } from "../support/constants.js";

test.describe("Profile smoke", () => {
  test("own profile renders", async ({ page }, testInfo) => {
    await loginAs(page, testInfo, TEST_USERS.member);
    await page.goto("/settings");
    await page.getByRole("link", { name: /view your public profile/i }).click();
    await expect(page).toHaveURL(/\/u\//);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the smoke spec**

Run: `pnpm exec playwright test e2e/smoke/profile.spec.ts --project=chromium`
Expected: PASS.

- [ ] **Step 3: Edit journey**

Create `e2e/profiles/profile-edit.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { loginAs } from "../support/actions.js";
import { TEST_USERS } from "../support/constants.js";

test.describe("Profile edit", () => {
  test("member edits pronouns and bio", async ({ page }, testInfo) => {
    await loginAs(page, testInfo, TEST_USERS.member);
    await page.goto("/settings");
    await page.getByRole("link", { name: /view your public profile/i }).click();
    await page.getByRole("link", { name: /edit profile/i }).click();

    const pronouns = `they/them ${Date.now()}`;
    await page.getByLabel(/pronouns/i).fill(pronouns);
    await page.getByLabel(/bio/i).fill("Loves drop targets");
    await page.getByRole("button", { name: /save/i }).click();

    await expect(page.getByText(pronouns, { exact: false })).toBeVisible();
    await expect(page.getByText("Loves drop targets")).toBeVisible();
  });
});
```

- [ ] **Step 4: Run the edit spec**

Run: `pnpm exec playwright test e2e/profiles/profile-edit.spec.ts --project=chromium`
Expected: PASS. (Trigger link navigation is asserted; we do not assert hover-card reveal.)

- [ ] **Step 5: Commit**

```bash
git add e2e/smoke/profile.spec.ts e2e/profiles/profile-edit.spec.ts
git commit -m "test(profiles): e2e smoke + edit journey"
```

---

### Task 12: Full preflight + bead bookkeeping

- [ ] **Step 1: Run the full gate**

Run: `pnpm preflight`
Expected: PASS (types, lint, format, unit, integration, build).

- [ ] **Step 2: Update the bead**

Run: `bd update PinPoint-5r7 --status closed` (after merge) — and retitle now to match the new home:
`bd update PinPoint-5r7 --title 'Add user avatar upload to profile'`
(Retitle is pending Tim's confirmation; do not close until the PR merges.)

- [ ] **Step 3: Open the PR** following `pinpoint-pr-workflow` (the audit checklist from Task 10 Step 1 goes in the PR body).

---

## Self-Review

**Spec coverage:**

- Bio + pronouns columns → Task 1. ✓
- `/u/[id]` authenticated route, `notFound()` on missing → Task 7. ✓
- Inline self-edit (name/pronouns/bio) → Tasks 3, 8. ✓
- Avatar upload built fresh (PinPoint-5r7) → Task 4, 8. ✓
- Activity counts (reported, comments; resolved dropped) → Task 2, 7. ✓
- Capped owned-machines list (6, fetch-7 overflow) linking into `/c/owner/[id]` → Tasks 2, 7. ✓
- Hover card: primitive, lazy data route, component, degraded invited/former → Tasks 5, 6. ✓
- Hover-card rollout audit + apply, pickers/collection-header left plain → Task 10. ✓
- Settings split (remove form + count, add link, remove dead action) → Task 9. ✓
- Permissions: view = `(app)` auth gate (route lives under `(app)`); edit = caller writes own row only → Tasks 3, 4, 7. ✓
- Email never rendered → no email field is selected in `getProfileById` or the card payload. ✓
- Testing layers (integration actions/queries/route, RTL editor + card, E2E smoke + edit) → Tasks 2,3,4,6,8,11. ✓

**Placeholder scan:** No TBD/TODO; every code step has concrete code. The two "match the sibling pattern" notes (PGlite harness import in Task 2/3 and the Supabase auth mock) point at concrete existing files to copy rather than inventing an interface — acceptable, but the implementer must open a sibling integration test first.

**Type consistency:** `getCappedOwnedMachines` returns `{ machines, total, hasMore }` and is consumed with those exact names in Tasks 6 and 7. `UpdateProfileResult` defined in Task 3, imported in Task 8. `PersonHoverCard` prop names (`userId`, `invitedId`, `displayName`, `className`) consistent across Tasks 6 and 10. Card payload shape identical in the route (Task 6 Step 3) and the component interface (Task 6 Step 7).

**Known follow-ups (not v1):** vanity handles, user search, real activity feed, a resolved-by column to revive the "issues resolved" stat.
