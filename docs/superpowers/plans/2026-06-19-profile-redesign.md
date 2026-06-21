# Profile Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `/u/[id]` real presence — hero identity zone, stat tiles, machine cards, and a recent-activity feed reusing the machine-timeline pipeline — and restyle `PersonHoverCard` to match.

**Architecture:** Data layer extends the existing `getMachineTimeline` query with an author scope so a profile feed is the same query/render/bucket pipeline scoped by person instead of machine; new page-local Server/presentational components compose the read view; the hover card adopts the new role-pill styling. No new routes, no schema/migration changes.

**Tech Stack:** Next.js 16 App Router (Server Components, async params), Drizzle ORM + Postgres, Tailwind v4 semantic tokens, shadcn/ui, lucide-react, Vitest + PGlite (worker-scoped), React Testing Library.

## Global Constraints

- **CORE-SEC-007**: never render user email on the profile page, hover card, or `/api/users/[id]/card` payload — names, pronouns, role only.
- **CORE-ARCH-001/002**: Server Components by default; profile page + feed stay server-rendered; edit form stays progressive-enhancement (`<form action={serverAction}>`).
- **Design tokens only** (design-bible §1/§18): `bg-card`, `text-primary`, `text-secondary`, `text-muted-foreground`, `bg-primary-container`, `border-outline-variant`. No raw palette classes, no hex, no `dark:`.
- **Icons**: `lucide-react` only; size with `size-*`, never `h-*/w-*`. Stat icons: `Flag`, `MessageSquare`, `Gamepad2`, `CircleCheck`.
- **Glow**: `hover:glow-primary` only on navigable cards (linking stat tiles, machine cards). Never on the hero band or static elements.
- **Responsive**: viewport breakpoints (`grid-cols-2 md:grid-cols-4`) for page structure; container queries (`@lg:`) for component internals. No `useMediaQuery`/`window.innerWidth`. Profile smoke spec's `assertNoHorizontalOverflow` must stay green.
- **Transitions**: `duration-150` hover/color, `duration-300` layout; pair non-essential animations with `motion-reduce:`.
- **TS strictest**: no `any`, no non-null `!`, no unsafe `as`. Path alias `~/`.
- **Tests**: worker-scoped PGlite (CORE-TEST-001); integration for queries, RTL for presentational components.

## File Structure

| File                                             | Responsibility                                                                                        |
| :----------------------------------------------- | :---------------------------------------------------------------------------------------------------- |
| `src/lib/timeline/machine-events.ts`             | (modify) optional `authorId` scope on `getMachineTimeline`                                            |
| `src/lib/profiles/queries.ts`                    | (modify) `getUserTimeline`, `resolveFeedMachineLabels`, `fixed` count, `getOpenIssueCountsByInitials` |
| `src/app/(app)/u/[id]/profile-hero.tsx`          | (create) hero identity band                                                                           |
| `src/app/(app)/u/[id]/profile-stat-grid.tsx`     | (create) 4 stat tiles                                                                                 |
| `src/app/(app)/u/[id]/owned-machines.tsx`        | (create) machine-card grid                                                                            |
| `src/app/(app)/u/[id]/profile-activity-feed.tsx` | (create) async feed reusing `TimelineRow`/`bucketTimelineRows`                                        |
| `src/app/(app)/u/[id]/page.tsx`                  | (modify) compose hero + stats + bio + machines + feed                                                 |
| `src/components/people/PersonHoverCard.tsx`      | (modify) role-pill restyle                                                                            |

Tests: `src/test/integration/*.test.ts` (queries), `src/test/unit/components/profiles/*.test.tsx` (RTL).

---

### Task 1: Author scope on `getMachineTimeline`

**Files:**

- Modify: `src/lib/timeline/machine-events.ts` (`GetMachineTimelineArgs` ~233-249, `getMachineTimeline` ~297-345)
- Test: `src/test/integration/timeline-author-scope.test.ts`

**Interfaces:**

- Consumes: existing `getMachineTimeline(tx, args)`, `createMachineComment`, `createMachineTimelineEvent` from this file.
- Produces: `GetMachineTimelineArgs` with optional `machineId?: string | string[]` and new optional `authorId?: string`; at least one scope required (else `[]`). Return type `MachineTimelineRow[]` unchanged.

- [ ] **Step 1: Write the failing test**

Create `src/test/integration/timeline-author-scope.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { userProfiles, machines } from "~/server/db/schema";
import { createTestUser, createTestMachine } from "~/test/helpers/factories";

vi.mock("server-only", () => ({}));
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

const { getMachineTimeline, createMachineComment } =
  await import("~/lib/timeline/machine-events");

const ALICE = "00000000-0000-0000-0000-00000000a001";
const BOB = "00000000-0000-0000-0000-00000000b002";
const doc = (t: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: t }] }],
});

describe("getMachineTimeline author scope", () => {
  setupTestDb();
  let m1 = "";
  let m2 = "";

  beforeEach(async () => {
    const db = await getTestDb();
    await db
      .insert(userProfiles)
      .values([
        createTestUser({ id: ALICE, firstName: "Alice", lastName: "A" }),
        createTestUser({ id: BOB, firstName: "Bob", lastName: "B" }),
      ]);
    const [a] = await db
      .insert(machines)
      .values(createTestMachine({ initials: "AA", name: "Game A" }))
      .returning({ id: machines.id });
    const [b] = await db
      .insert(machines)
      .values(createTestMachine({ initials: "BB", name: "Game B" }))
      .returning({ id: machines.id });
    m1 = a!.id;
    m2 = b!.id;
    // Alice notes on two machines; Bob notes on one.
    await createMachineComment(
      m1,
      { content: doc("alice on A"), tag: "note", authorId: ALICE },
      db
    );
    await createMachineComment(
      m2,
      { content: doc("alice on B"), tag: "note", authorId: ALICE },
      db
    );
    await createMachineComment(
      m1,
      { content: doc("bob on A"), tag: "note", authorId: BOB },
      db
    );
  });

  it("returns only the author's events, across machines", async () => {
    const db = await getTestDb();
    const rows = await getMachineTimeline(db, { authorId: ALICE });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.authorId === ALICE)).toBe(true);
    expect(new Set(rows.map((r) => r.machineId))).toEqual(new Set([m1, m2]));
  });

  it("machineId scope still works unchanged", async () => {
    const db = await getTestDb();
    const rows = await getMachineTimeline(db, { machineId: m1 });
    expect(rows).toHaveLength(2); // alice + bob on A
  });

  it("returns [] when no scope is given", async () => {
    const db = await getTestDb();
    const rows = await getMachineTimeline(db, {});
    expect(rows).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/test/integration/timeline-author-scope.test.ts`
Expected: FAIL — `authorId` not accepted / type error or wrong row counts.

- [ ] **Step 3: Implement the author scope**

In `src/lib/timeline/machine-events.ts`, change `GetMachineTimelineArgs` so `machineId` is optional and add `authorId`:

```ts
export interface GetMachineTimelineArgs {
  /** One machine id, or a list for combined (collection) feeds. Optional when
   *  scoping by author instead (profile activity feed). */
  machineId?: string | string[];
  /** Author scope — events authored by this user, across any machine
   *  (profile activity feed). At least one of machineId / authorId required. */
  authorId?: string;
  tags?: TimelineTag[];
  limit?: number;
  offset?: number;
}
```

Replace the early guard + WHERE composition at the top of `getMachineTimeline`:

```ts
// Empty machine list = no scope from that axis.
const hasMachineScope = Array.isArray(args.machineId)
  ? args.machineId.length > 0
  : args.machineId !== undefined;
const hasAuthorScope = args.authorId !== undefined;
if (!hasMachineScope && !hasAuthorScope) return [];
```

Then build the machine predicate and add it to the existing `and(...)` only when present:

```ts
  const machinePredicate = hasMachineScope
    ? Array.isArray(args.machineId)
      ? inArray(timelineEvents.machineId, args.machineId)
      : eq(timelineEvents.machineId, args.machineId as string)
    : undefined;

  // ...in the .where(and(...)):
    .where(
      and(
        machinePredicate,
        hasAuthorScope ? eq(timelineEvents.authorId, args.authorId as string) : undefined,
        args.tags && args.tags.length > 0
          ? inArray(timelineEvents.tag, args.tags)
          : undefined
      )
    )
```

(`and(...)` ignores `undefined` predicates, so the existing machine-only callers are unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/test/integration/timeline-author-scope.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Verify no caller broke + commit**

Run: `pnpm typecheck`
Expected: clean (all existing callers pass `machineId`).

```bash
git add src/lib/timeline/machine-events.ts src/test/integration/timeline-author-scope.test.ts
git commit -m "refactor(timeline): add optional authorId scope to getMachineTimeline"
```

---

### Task 2: `getUserTimeline` + feed machine-label resolution

**Files:**

- Modify: `src/lib/profiles/queries.ts`
- Test: `src/test/integration/profile-feed-queries.test.ts`

**Interfaces:**

- Consumes: `getMachineTimeline(db, { authorId, limit })` and `MachineTimelineRow` from Task 1; `machines` schema.
- Produces:
  - `getUserTimeline(userId: string, opts?: { limit?: number }): Promise<MachineTimelineRow[]>` (default limit 8)
  - `resolveFeedMachineLabels(rows: MachineTimelineRow[]): Promise<Map<string, { name: string; href: string; initials: string }>>`

- [ ] **Step 1: Write the failing test**

Create `src/test/integration/profile-feed-queries.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { userProfiles, machines } from "~/server/db/schema";
import { createTestUser, createTestMachine } from "~/test/helpers/factories";

vi.mock("server-only", () => ({}));
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

const { getUserTimeline, resolveFeedMachineLabels } =
  await import("~/lib/profiles/queries");
const { createMachineComment } = await import("~/lib/timeline/machine-events");

const USER = "00000000-0000-0000-0000-00000000c001";
const doc = (t: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: t }] }],
});

describe("profile feed queries", () => {
  setupTestDb();
  let m1 = "";

  beforeEach(async () => {
    const db = await getTestDb();
    await db
      .insert(userProfiles)
      .values(createTestUser({ id: USER, firstName: "Cam", lastName: "C" }));
    const [a] = await db
      .insert(machines)
      .values(createTestMachine({ initials: "CC", name: "Game C" }))
      .returning({ id: machines.id });
    m1 = a!.id;
    for (let i = 0; i < 3; i++) {
      await createMachineComment(
        m1,
        { content: doc(`n${i}`), tag: "note", authorId: USER },
        db
      );
    }
  });

  it("getUserTimeline returns the user's events, capped by limit", async () => {
    const rows = await getUserTimeline(USER, { limit: 2 });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.authorId === USER)).toBe(true);
  });

  it("resolveFeedMachineLabels maps machineId -> name/href/initials", async () => {
    const rows = await getUserTimeline(USER, { limit: 8 });
    const labels = await resolveFeedMachineLabels(rows);
    expect(labels.get(m1)).toEqual({
      name: "Game C",
      href: "/m/CC",
      initials: "CC",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/test/integration/profile-feed-queries.test.ts`
Expected: FAIL — `getUserTimeline` / `resolveFeedMachineLabels` not exported.

- [ ] **Step 3: Implement in `src/lib/profiles/queries.ts`**

Add imports at the top (merge with existing):

```ts
import { eq, count, asc, inArray } from "drizzle-orm";
import {
  getMachineTimeline,
  type MachineTimelineRow,
} from "~/lib/timeline/machine-events";
```

Append:

```ts
export const PROFILE_FEED_LIMIT = 8;

/** Recent timeline events authored by this user, across any machine. */
export async function getUserTimeline(
  userId: string,
  opts?: { limit?: number }
): Promise<MachineTimelineRow[]> {
  return getMachineTimeline(db, {
    authorId: userId,
    limit: opts?.limit ?? PROFILE_FEED_LIMIT,
  });
}

export interface FeedMachineLabel {
  name: string;
  href: string;
  initials: string;
}

/** Resolve the machine name/initials/href for the distinct machineIds present
 *  in a feed page, for each row's attribution line. One query, not N. */
export async function resolveFeedMachineLabels(
  rows: MachineTimelineRow[]
): Promise<Map<string, FeedMachineLabel>> {
  const ids = [
    ...new Set(
      rows.map((r) => r.machineId).filter((id): id is string => id !== null)
    ),
  ];
  const map = new Map<string, FeedMachineLabel>();
  if (ids.length === 0) return map;
  const labelRows = await db
    .select({
      id: machines.id,
      name: machines.name,
      initials: machines.initials,
    })
    .from(machines)
    .where(inArray(machines.id, ids));
  for (const m of labelRows) {
    map.set(m.id, {
      name: m.name,
      href: `/m/${m.initials}`,
      initials: m.initials,
    });
  }
  return map;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/test/integration/profile-feed-queries.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/profiles/queries.ts src/test/integration/profile-feed-queries.test.ts
git commit -m "feat(profiles): getUserTimeline + feed machine-label resolution"
```

---

### Task 3: "Issues fixed" count + per-machine open-issue counts

**Files:**

- Modify: `src/lib/profiles/queries.ts`
- Test: `src/test/integration/profiles-queries.test.ts` (extend) + new cases

**Interfaces:**

- Consumes: `issues`, `issueComments` schema; `CLOSED_STATUSES` / `OPEN_STATUSES` from `~/lib/issues/status`.
- Produces:
  - `getProfileActivityCounts(userId)` return type extended to `{ reported: number; comments: number; fixed: number }`
  - `getOpenIssueCountsByInitials(initials: string[]): Promise<Map<string, number>>`

- [ ] **Step 1: Write the failing tests**

Append to `src/test/integration/profiles-queries.test.ts` inside the `describe`:

```ts
it("getProfileActivityCounts counts issues fixed by the user", async () => {
  const db = await getTestDb();
  // A system status_changed -> fixed comment authored by USER on the OWN1 issue.
  const [iss] = await db
    .insert(issues)
    .values(
      createTestIssue("OWN1", { issueNumber: 2, title: "F", status: "fixed" })
    )
    .returning({ id: issues.id });
  await db.insert(issueComments).values(
    createTestComment(iss!.id, {
      authorId: USER,
      isSystem: true,
      content: null,
      eventData: { type: "status_changed", from: "new", to: "fixed" },
    })
  );
  const counts = await getProfileActivityCounts(USER);
  expect(counts.fixed).toBe(1);
});

it("getOpenIssueCountsByInitials counts only open-status issues", async () => {
  const db = await getTestDb();
  // OWN0 already has 2 reported issues (status 'new' = open from the base seed).
  const map = await getOpenIssueCountsByInitials(["OWN0", "OWN1"]);
  expect(map.get("OWN0")).toBe(2);
});
```

Add `getOpenIssueCountsByInitials` to the import destructure at the top of the file.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/test/integration/profiles-queries.test.ts`
Expected: FAIL — `counts.fixed` undefined / `getOpenIssueCountsByInitials` not exported.

- [ ] **Step 3: Implement in `src/lib/profiles/queries.ts`**

Add imports (merge): `import { eq, count, asc, inArray, and, sql } from "drizzle-orm";` and `import { CLOSED_STATUSES, OPEN_STATUSES } from "~/lib/issues/status";`.

Replace `getProfileActivityCounts` with the three-count version:

```ts
export async function getProfileActivityCounts(
  userId: string
): Promise<{ reported: number; comments: number; fixed: number }> {
  const [reportedRows, commentRows, fixedRows] = await Promise.all([
    db.select({ c: count() }).from(issues).where(eq(issues.reportedBy, userId)),
    db
      .select({ c: count() })
      .from(issueComments)
      .where(
        and(
          eq(issueComments.authorId, userId),
          eq(issueComments.isSystem, false)
        )
      ),
    // Distinct issues this user moved to a closed/resolved status, from system
    // status_changed rows. Closed set from status.ts (no hardcoded strings).
    db
      .select({ c: sql<number>`count(distinct ${issueComments.issueId})` })
      .from(issueComments)
      .where(
        and(
          eq(issueComments.authorId, userId),
          eq(issueComments.isSystem, true),
          sql`${issueComments.eventData}->>'type' = 'status_changed'`,
          sql`${issueComments.eventData}->>'to' = ANY(${[...CLOSED_STATUSES]})`
        )
      ),
  ]);
  return {
    reported: reportedRows[0]?.c ?? 0,
    comments: commentRows[0]?.c ?? 0,
    fixed: Number(fixedRows[0]?.c ?? 0),
  };
}

/** Open-issue count per machine initials (open = new/in-progress groups). */
export async function getOpenIssueCountsByInitials(
  initials: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (initials.length === 0) return map;
  const rows = await db
    .select({ initials: issues.machineInitials, c: count() })
    .from(issues)
    .where(
      and(
        inArray(issues.machineInitials, initials),
        inArray(issues.status, [...OPEN_STATUSES])
      )
    )
    .groupBy(issues.machineInitials);
  for (const r of rows) map.set(r.initials, r.c);
  return map;
}
```

> Note: the base test seed authors a non-system comment, so the existing `comments` assertion (`toBe(1)`) still holds with the new `isSystem=false` filter.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/test/integration/profiles-queries.test.ts`
Expected: PASS (all cases incl. the two new ones).

- [ ] **Step 5: Commit**

```bash
git add src/lib/profiles/queries.ts src/test/integration/profiles-queries.test.ts
git commit -m "feat(profiles): issues-fixed count + per-machine open-issue counts"
```

---

### Task 4: `ProfileHero` component

**Files:**

- Create: `src/app/(app)/u/[id]/profile-hero.tsx`
- Test: `src/test/unit/components/profiles/profile-hero.test.tsx`

**Interfaces:**

- Produces: `ProfileHero({ name, pronouns, role, avatarUrl, memberSince, isOwn, editHref }): React.JSX.Element` — sync presentational.

- [ ] **Step 1: Write the failing test**

Create `src/test/unit/components/profiles/profile-hero.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileHero } from "~/app/(app)/u/[id]/profile-hero";

describe("ProfileHero", () => {
  const base = {
    name: "Admin User",
    pronouns: "they/them",
    role: "admin" as const,
    avatarUrl: null,
    memberSince: "Jun 2026",
  };

  it("shows name, pronouns, role pill and member-since", () => {
    render(<ProfileHero {...base} isOwn={false} editHref="/u/x?edit=1" />);
    expect(
      screen.getByRole("heading", { name: /Admin User/ })
    ).toBeInTheDocument();
    expect(screen.getByText("they/them")).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();
    expect(screen.getByText(/Jun 2026/)).toBeInTheDocument();
  });

  it("shows the Edit link only for the owner", () => {
    const { rerender } = render(
      <ProfileHero {...base} isOwn={false} editHref="/u/x?edit=1" />
    );
    expect(screen.queryByRole("link", { name: /edit profile/i })).toBeNull();
    rerender(<ProfileHero {...base} isOwn={true} editHref="/u/x?edit=1" />);
    expect(screen.getByRole("link", { name: /edit profile/i })).toHaveAttribute(
      "href",
      "/u/x?edit=1"
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/test/unit/components/profiles/profile-hero.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/app/(app)/u/[id]/profile-hero.tsx`**

```tsx
import type React from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";

interface ProfileHeroProps {
  name: string;
  pronouns: string | null;
  role: "guest" | "member" | "technician" | "admin";
  avatarUrl: string | null;
  memberSince: string;
  isOwn: boolean;
  editHref: string;
}

export function ProfileHero({
  name,
  pronouns,
  role,
  avatarUrl,
  memberSince,
  isOwn,
  editHref,
}: ProfileHeroProps): React.JSX.Element {
  return (
    <header className="relative overflow-hidden rounded-2xl border border-outline-variant bg-card bg-[radial-gradient(120%_140%_at_0%_0%,color-mix(in_srgb,var(--color-primary)_14%,transparent),transparent_55%),radial-gradient(120%_140%_at_100%_0%,color-mix(in_srgb,var(--color-secondary)_12%,transparent),transparent_55%)] p-6">
      <div className="flex flex-col gap-4 @lg:flex-row @lg:items-center">
        <Avatar className="size-20">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
          <AvatarFallback className="text-2xl">{name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-balance">
            {name}
            {pronouns ? (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {pronouns}
              </span>
            ) : null}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-primary-container px-2.5 py-0.5 text-xs font-semibold capitalize text-primary">
              {role}
            </span>
            <span className="text-sm text-muted-foreground">
              member since {memberSince}
            </span>
          </div>
        </div>
        {isOwn ? (
          <Link
            href={editHref}
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-md border border-primary/45 px-3 py-1.5 text-sm font-semibold text-primary transition-colors duration-150 hover:bg-primary/10 @lg:self-auto"
          >
            <Pencil className="size-4" aria-hidden="true" />
            Edit profile
          </Link>
        ) : null}
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/test/unit/components/profiles/profile-hero.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/u/[id]/profile-hero.tsx" src/test/unit/components/profiles/profile-hero.test.tsx
git commit -m "feat(profiles): ProfileHero identity band"
```

---

### Task 5: `ProfileStatGrid` component

**Files:**

- Create: `src/app/(app)/u/[id]/profile-stat-grid.tsx`
- Test: `src/test/unit/components/profiles/profile-stat-grid.test.tsx`

**Interfaces:**

- Produces: `ProfileStatGrid({ reported, comments, machinesOwned, fixed, collectionHref }): React.JSX.Element` — sync presentational.

- [ ] **Step 1: Write the failing test**

Create `src/test/unit/components/profiles/profile-stat-grid.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileStatGrid } from "~/app/(app)/u/[id]/profile-stat-grid";

describe("ProfileStatGrid", () => {
  it("renders all four stats with labels", () => {
    render(
      <ProfileStatGrid
        reported={4}
        comments={9}
        machinesOwned={4}
        fixed={2}
        collectionHref="/c/owner/x"
      />
    );
    expect(screen.getByText("Issues reported")).toBeInTheDocument();
    expect(screen.getByText("Comments")).toBeInTheDocument();
    expect(screen.getByText("Machines owned")).toBeInTheDocument();
    expect(screen.getByText("Issues fixed")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("links the machines tile to the collection", () => {
    render(
      <ProfileStatGrid
        reported={0}
        comments={0}
        machinesOwned={3}
        fixed={0}
        collectionHref="/c/owner/x"
      />
    );
    expect(
      screen.getByRole("link", { name: /machines owned/i })
    ).toHaveAttribute("href", "/c/owner/x");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/test/unit/components/profiles/profile-stat-grid.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/app/(app)/u/[id]/profile-stat-grid.tsx`**

```tsx
import type React from "react";
import Link from "next/link";
import { Flag, MessageSquare, Gamepad2, CircleCheck } from "lucide-react";

interface ProfileStatGridProps {
  reported: number;
  comments: number;
  machinesOwned: number;
  fixed: number;
  collectionHref: string;
}

const tileBase = "rounded-xl border border-outline-variant bg-card p-4";
const linkTile =
  "transition-[border-color,box-shadow] duration-150 hover:border-primary/50 hover:glow-primary";

function Stat({
  icon,
  value,
  label,
  accent,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  accent?: "primary" | "secondary";
}): React.JSX.Element {
  const numClass =
    accent === "secondary"
      ? "text-secondary"
      : accent === "primary"
        ? "text-primary"
        : "text-foreground";
  return (
    <>
      <div className={`text-2xl font-bold ${numClass}`}>{value}</div>
      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
    </>
  );
}

export function ProfileStatGrid({
  reported,
  comments,
  machinesOwned,
  fixed,
  collectionHref,
}: ProfileStatGridProps): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div className={tileBase}>
        <Stat
          icon={<Flag className="size-3.5" aria-hidden="true" />}
          value={reported}
          label="Issues reported"
          accent="primary"
        />
      </div>
      <div className={tileBase}>
        <Stat
          icon={<MessageSquare className="size-3.5" aria-hidden="true" />}
          value={comments}
          label="Comments"
        />
      </div>
      <Link href={collectionHref} className={`${tileBase} ${linkTile}`}>
        <Stat
          icon={<Gamepad2 className="size-3.5" aria-hidden="true" />}
          value={machinesOwned}
          label="Machines owned"
          accent="primary"
        />
      </Link>
      <div className={tileBase}>
        <Stat
          icon={<CircleCheck className="size-3.5" aria-hidden="true" />}
          value={fixed}
          label="Issues fixed"
          accent="secondary"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/test/unit/components/profiles/profile-stat-grid.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/u/[id]/profile-stat-grid.tsx" src/test/unit/components/profiles/profile-stat-grid.test.tsx
git commit -m "feat(profiles): ProfileStatGrid stat tiles"
```

---

### Task 6: `OwnedMachines` card grid

**Files:**

- Create: `src/app/(app)/u/[id]/owned-machines.tsx`
- Test: `src/test/unit/components/profiles/owned-machines.test.tsx`

**Interfaces:**

- Consumes: shape from `getCappedOwnedMachines` + open-count map from `getOpenIssueCountsByInitials`.
- Produces: `OwnedMachines({ machines, total, hasMore, ownerId, openCounts }): React.JSX.Element | null` — sync; returns `null` when `total === 0`.

- [ ] **Step 1: Write the failing test**

Create `src/test/unit/components/profiles/owned-machines.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OwnedMachines } from "~/app/(app)/u/[id]/owned-machines";

const machines = [
  { id: "1", initials: "GDZ", name: "Godzilla" },
  { id: "2", initials: "MM", name: "Medieval Madness" },
];

describe("OwnedMachines", () => {
  it("renders cards with chip, name, and open-issue count", () => {
    render(
      <OwnedMachines
        machines={machines}
        total={2}
        hasMore={false}
        ownerId="x"
        openCounts={new Map([["GDZ", 3]])}
      />
    );
    expect(screen.getByText("Godzilla")).toBeInTheDocument();
    expect(screen.getByText("GDZ")).toBeInTheDocument();
    expect(screen.getByText(/3 open/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Godzilla/ })).toHaveAttribute(
      "href",
      "/m/GDZ"
    );
  });

  it("returns null when nothing is owned", () => {
    const { container } = render(
      <OwnedMachines
        machines={[]}
        total={0}
        hasMore={false}
        ownerId="x"
        openCounts={new Map()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows 'View all N' when capped", () => {
    render(
      <OwnedMachines
        machines={machines}
        total={9}
        hasMore={true}
        ownerId="x"
        openCounts={new Map()}
      />
    );
    expect(screen.getByRole("link", { name: /view all 9/i })).toHaveAttribute(
      "href",
      "/c/owner/x"
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/test/unit/components/profiles/owned-machines.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/app/(app)/u/[id]/owned-machines.tsx`**

```tsx
import type React from "react";
import Link from "next/link";

interface OwnedMachinesProps {
  machines: { id: string; initials: string; name: string }[];
  total: number;
  hasMore: boolean;
  ownerId: string;
  openCounts: Map<string, number>;
}

export function OwnedMachines({
  machines,
  total,
  hasMore,
  ownerId,
  openCounts,
}: OwnedMachinesProps): React.JSX.Element | null {
  if (total === 0) return null;
  return (
    <section>
      <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Owned machines · {total}
      </h2>
      <div className="mt-2 grid gap-3 @lg:grid-cols-2">
        {machines.map((m) => {
          const open = openCounts.get(m.initials) ?? 0;
          return (
            <Link
              key={m.id}
              href={`/m/${m.initials}`}
              className="flex items-center gap-3 rounded-xl border border-outline-variant bg-card p-3 transition-[border-color,box-shadow] duration-150 hover:border-primary/50 hover:glow-primary"
            >
              <span className="shrink-0 rounded-lg border border-secondary/30 bg-secondary/15 px-2 py-1 font-mono text-xs font-bold text-secondary">
                {m.initials}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  {m.name}
                </span>
                {open > 0 ? (
                  <span className="text-xs text-muted-foreground">
                    {open} open issue{open === 1 ? "" : "s"}
                  </span>
                ) : null}
              </span>
            </Link>
          );
        })}
      </div>
      <Link
        href={`/c/owner/${ownerId}`}
        className="mt-2 inline-block text-sm text-primary hover:underline"
      >
        {hasMore ? `View all ${total} →` : "View full collection →"}
      </Link>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/test/unit/components/profiles/owned-machines.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/u/[id]/owned-machines.tsx" src/test/unit/components/profiles/owned-machines.test.tsx
git commit -m "feat(profiles): OwnedMachines card grid"
```

---

### Task 7: `ProfileActivityFeed` (reuses TimelineRow)

**Files:**

- Create: `src/app/(app)/u/[id]/profile-activity-feed.tsx`
- Test: covered by Task 2 integration (`getUserTimeline`) + the Task 8 page render/smoke. No RTL (async server component; mirrors `MachineRecentActivity`, which has no RTL test).

**Interfaces:**

- Consumes: `getUserTimeline`, `resolveFeedMachineLabels` (Task 2); `bucketTimelineRows` (`~/lib/timeline/bucket-rows`); `TimelineRow` (`~/components/machines/timeline/TimelineRow`); `EmptyState` (`~/components/ui/empty-state`); `isToday` (`date-fns`).
- Produces: `ProfileActivityFeed({ userId }): Promise<React.JSX.Element>` — async server component.

- [ ] **Step 1: Implement `src/app/(app)/u/[id]/profile-activity-feed.tsx`**

(No separate failing test — this is composition over already-tested units. Verified via build + the existing profile smoke E2E in Task 8.)

```tsx
import type React from "react";
import { isToday } from "date-fns";
import { Activity } from "lucide-react";

import { EmptyState } from "~/components/ui/empty-state";
import { TimelineRow } from "~/components/machines/timeline/TimelineRow";
import { bucketTimelineRows } from "~/lib/timeline/bucket-rows";
import {
  getUserTimeline,
  resolveFeedMachineLabels,
} from "~/lib/profiles/queries";

export async function ProfileActivityFeed({
  userId,
}: {
  userId: string;
}): Promise<React.JSX.Element> {
  const rows = await getUserTimeline(userId, { limit: 8 });
  const labels = await resolveFeedMachineLabels(rows);
  const groups = bucketTimelineRows(rows);

  return (
    <section aria-labelledby="profile-activity-heading">
      <h2
        id="profile-activity-heading"
        className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
      >
        Recent activity
      </h2>
      {rows.length === 0 ? (
        <div className="mt-2">
          <EmptyState
            variant="bare"
            icon={Activity}
            title="No activity yet"
            description="Notes, reports, and updates will show up here."
          />
        </div>
      ) : (
        <div className="mt-2 flex flex-col">
          {groups.map((group) => {
            const first = group.entries[0];
            const showRelativeTime =
              group.bucket.tier === "day" &&
              first !== undefined &&
              isToday(first.row.createdAt);
            return (
              <div key={group.bucket.key}>
                {group.entries.map((entry) => {
                  const label = entry.row.machineId
                    ? labels.get(entry.row.machineId)
                    : undefined;
                  return (
                    <TimelineRow
                      key={entry.row.id}
                      row={entry.row}
                      showRelativeTime={showRelativeTime}
                      rowDateLabel={entry.bucket.rowDateLabel}
                      commentCanEdit={false}
                      commentCanDelete={false}
                      {...(label
                        ? {
                            machineLabel: {
                              name: label.name,
                              href: label.href,
                            },
                            machineInitials: label.initials,
                          }
                        : {})}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
```

> Verify `EmptyState` accepts `icon` as a lucide component and supports `variant="bare"` (design-bible §13). If the prop name differs, match the existing `EmptyState` signature — do not change `EmptyState`.

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/u/[id]/profile-activity-feed.tsx"
git commit -m "feat(profiles): ProfileActivityFeed reusing the timeline pipeline"
```

---

### Task 8: Compose the profile page

**Files:**

- Modify: `src/app/(app)/u/[id]/page.tsx`
- Test: `e2e/smoke/profile.spec.ts` (already exists — must stay green)

**Interfaces:**

- Consumes: `ProfileHero`, `ProfileStatGrid`, `OwnedMachines`, `ProfileActivityFeed`, `getProfileById`, `getProfileActivityCounts` (now returns `fixed`), `getCappedOwnedMachines`, `getOpenIssueCountsByInitials`.

- [ ] **Step 1: Rewrite the read view in `src/app/(app)/u/[id]/page.tsx`**

Keep the existing imports for `notFound`, `createClient`, `getProfileById`, `getCappedOwnedMachines`, `ProfileEditor`. Update the activity-counts import and add the new components/queries:

```tsx
import { notFound } from "next/navigation";
import type React from "react";
import { createClient } from "~/lib/supabase/server";
import {
  getProfileById,
  getProfileActivityCounts,
  getCappedOwnedMachines,
  getOpenIssueCountsByInitials,
} from "~/lib/profiles/queries";
import { ProfileEditor } from "./profile-editor";
import { ProfileHero } from "./profile-hero";
import { ProfileStatGrid } from "./profile-stat-grid";
import { OwnedMachines } from "./owned-machines";
import { ProfileActivityFeed } from "./profile-activity-feed";

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  const { edit } = await searchParams;

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
  const openCounts = await getOpenIssueCountsByInitials(
    owned.machines.map((m) => m.initials)
  );
  const isOwn = user?.id === id;
  const memberSince = profile.createdAt.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  return (
    <div className="@container mx-auto w-full max-w-2xl space-y-6 p-4">
      <ProfileHero
        name={profile.name}
        pronouns={profile.pronouns}
        role={profile.role}
        avatarUrl={profile.avatarUrl}
        memberSince={memberSince}
        isOwn={isOwn}
        editHref={`/u/${id}?edit=1`}
      />

      {isOwn && edit ? (
        <ProfileEditor
          profileId={id}
          initial={{
            firstName: profile.firstName,
            lastName: profile.lastName,
            pronouns: profile.pronouns,
            bio: profile.bio,
            avatarUrl: profile.avatarUrl,
          }}
        />
      ) : (
        <>
          <ProfileStatGrid
            reported={counts.reported}
            comments={counts.comments}
            machinesOwned={owned.total}
            fixed={counts.fixed}
            collectionHref={`/c/owner/${id}`}
          />

          {profile.bio ? (
            <p className="rounded-xl border border-outline-variant bg-card p-4 whitespace-pre-line text-pretty">
              {profile.bio}
            </p>
          ) : null}

          <OwnedMachines
            machines={owned.machines}
            total={owned.total}
            hasMore={owned.hasMore}
            ownerId={id}
            openCounts={openCounts}
          />

          <ProfileActivityFeed userId={id} />
        </>
      )}
    </div>
  );
}
```

(`@container` on the wrapper makes the `@lg:` grids in hero/machines resolve against the page column.)

- [ ] **Step 2: Typecheck + build**

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 3: Run the profile smoke E2E**

Run: `pnpm exec playwright test e2e/smoke/profile.spec.ts --project=chromium`
Expected: PASS (renders without 500, no horizontal overflow).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/u/[id]/page.tsx"
git commit -m "feat(profiles): compose redesigned profile read view"
```

---

### Task 9: Restyle `PersonHoverCard`

**Files:**

- Modify: `src/components/people/PersonHoverCard.tsx`
- Test: `src/test/unit/components/people/person-hover-card.test.tsx` (create or extend if present)

**Interfaces:**

- Consumes: existing `/api/users/[id]/card` payload `{ name, avatarUrl, pronouns, role, machineCount }`. No email.

- [ ] **Step 1: Write/extend the failing test**

Create `src/test/unit/components/people/person-hover-card.test.tsx`:

```tsx
import { describe, it, expect, afterEach, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import { PersonHoverCard } from "~/components/people/PersonHoverCard";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PersonHoverCard", () => {
  it("renders plain text (no link) for a null userId", () => {
    render(<PersonHoverCard userId={null} displayName="Anonymous" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Anonymous")).toBeInTheDocument();
  });

  it("links the trigger to the profile page", () => {
    render(<PersonHoverCard userId="abc" displayName="Admin User" />);
    expect(screen.getByRole("link", { name: "Admin User" })).toHaveAttribute(
      "href",
      "/u/abc"
    );
  });

  it("shows a capitalized role pill after fetch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          name: "Admin User",
          avatarUrl: null,
          pronouns: "they/them",
          role: "admin",
          machineCount: 4,
        }),
      })
    );
    render(<PersonHoverCard userId="abc" displayName="Admin User" />);
    fireEvent.pointerEnter(screen.getByRole("link", { name: "Admin User" }));
    await waitFor(() => expect(screen.getByText("admin")).toBeInTheDocument());
  });
});
```

> If hover-open doesn't trigger the fetch in jsdom (Radix HoverCard pointer behavior), drop the third test and rely on the existing card-API integration test for payload shape — keep the first two.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/test/unit/components/people/person-hover-card.test.tsx`
Expected: FAIL — pill text not styled / module expectations.

- [ ] **Step 3: Restyle the header in `src/components/people/PersonHoverCard.tsx`**

Replace the `HoverCardContent` header block (the `flex items-center gap-3` div) so the role renders as the pill and pronouns sit inline:

```tsx
<div className="flex items-center gap-3">
  <Avatar className="size-10">
    {data?.avatarUrl ? <AvatarImage src={data.avatarUrl} alt="" /> : null}
    <AvatarFallback>{displayName.charAt(0)}</AvatarFallback>
  </Avatar>
  <div className="min-w-0">
    <div className="truncate font-semibold">
      {data?.name ?? displayName}
      {data?.pronouns ? (
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          {data.pronouns}
        </span>
      ) : null}
    </div>
    {data ? (
      <span className="mt-0.5 inline-flex items-center rounded-full bg-primary-container px-2 py-0.5 text-[11px] font-semibold capitalize text-primary">
        {data.role}
      </span>
    ) : null}
  </div>
</div>
```

(The "Owns N machines" link below stays unchanged. No email anywhere — CORE-SEC-007.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/test/unit/components/people/person-hover-card.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/people/PersonHoverCard.tsx src/test/unit/components/people/person-hover-card.test.tsx
git commit -m "feat(profiles): restyle PersonHoverCard with role pill"
```

---

## Final verification (after all tasks)

- [ ] `pnpm run check` — types, lint, format, unit + integration. Expected: clean.
- [ ] `pnpm exec playwright test e2e/smoke/profile.spec.ts --project=chromium` — Expected: PASS.
- [ ] Manual: visit `/u/<admin-id>` (admin seeded with bio + pronouns) — hero, four stats incl. "Issues fixed", machine cards with open counts, recent-activity feed; edit → Save returns to read view, Cancel returns without saving; hover a person link elsewhere shows the role pill.
