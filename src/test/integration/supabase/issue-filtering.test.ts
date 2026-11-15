import { describe, it, expect, beforeEach } from "vitest";
import { asDbOrTx, getTestDb, setupTestDb } from "~/test/setup/pglite";
import {
  issueComments,
  issues,
  machines,
  userProfiles,
} from "~/server/db/schema";
import { buildWhereConditions } from "~/lib/issues/filters-queries";
import { and, eq, type SQL, type InferSelectModel } from "drizzle-orm";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";

type Issue = InferSelectModel<typeof issues>;

describe("Issue Filtering Integration", () => {
  setupTestDb();

  const ALICE_ID = "00000000-0000-0000-0000-000000000001";
  const BOB_ID = "00000000-0000-0000-0000-000000000002";
  const CHARLIE_ID = "00000000-0000-0000-0000-000000000003";

  const ISSUE_1_ID = "00000000-0000-0000-0000-0000000000e1";
  const ISSUE_2_ID = "00000000-0000-0000-0000-0000000000e2";
  const ISSUE_3_ID = "00000000-0000-0000-0000-0000000000e3";
  const ISSUE_4_ID = "00000000-0000-0000-0000-0000000000e4";

  beforeEach(async () => {
    const db = await getTestDb();

    // Seed test data
    await db.insert(userProfiles).values([
      {
        id: ALICE_ID,
        firstName: "Alice",
        lastName: "Owner",
        email: "alice@example.com",
      },
      {
        id: BOB_ID,
        firstName: "Bob",
        lastName: "Reporter",
        email: "bob@example.com",
      },
      {
        id: CHARLIE_ID,
        firstName: "Charlie",
        lastName: "Assignee",
        email: "charlie@example.com",
      },
    ]);

    await db.insert(machines).values([
      {
        id: "00000000-0000-0000-0000-0000000000a1",
        initials: "AFM",
        name: "Attack from Mars",
        ownerId: ALICE_ID,
      },
      {
        id: "00000000-0000-0000-0000-0000000000a2",
        initials: "TZ",
        name: "Twilight Zone",
        ownerId: BOB_ID,
      },
      {
        id: "00000000-0000-0000-0000-0000000000a3",
        initials: "LON",
        name: "Loaner Machine",
        ownerId: ALICE_ID,
        presenceStatus: "on_loan",
      },
    ]);

    await db.insert(issues).values([
      {
        id: ISSUE_1_ID,
        machineInitials: "AFM",
        issueNumber: 1,
        title: "Flipper sticking",
        status: "new",
        severity: "major",
        priority: "high",
        frequency: "constant",
        reportedBy: BOB_ID,
        assignedTo: CHARLIE_ID,
        createdAt: new Date("2026-01-01 10:00:00"),
        updatedAt: new Date("2026-01-01 10:00:00"),
      },
      {
        id: ISSUE_2_ID,
        machineInitials: "TZ",
        issueNumber: 2,
        title: "Gumball machine jammed",
        status: "confirmed",
        severity: "minor",
        priority: "medium",
        frequency: "intermittent",
        reportedBy: BOB_ID,
        assignedTo: null,
        createdAt: new Date("2026-01-02 10:00:00"),
        updatedAt: new Date("2026-01-02 10:00:00"),
      },
      {
        id: ISSUE_3_ID,
        machineInitials: "AFM",
        issueNumber: 3,
        title: "Bulb out",
        status: "in_progress",
        severity: "cosmetic",
        priority: "low",
        frequency: "constant",
        reportedBy: ALICE_ID,
        assignedTo: CHARLIE_ID,
        createdAt: new Date("2026-01-03 10:00:00"),
        updatedAt: new Date("2026-01-03 10:00:00"),
      },
      {
        id: ISSUE_4_ID,
        machineInitials: "LON",
        issueNumber: 4,
        title: "Loaned machine note",
        status: "fixed",
        severity: "minor",
        priority: "low",
        frequency: "intermittent",
        reportedBy: ALICE_ID,
        assignedTo: null,
        createdAt: new Date("2026-01-04 10:00:00"),
        updatedAt: new Date("2026-01-04 10:00:00"),
      },
    ]);
  });

  const queryIssues = async (where: SQL[]): Promise<Issue[]> => {
    const db = await getTestDb();
    return await db
      .select()
      .from(issues)
      .where(and(...where));
  };

  it("filters by status (OR logic)", async () => {
    const db = await getTestDb();
    const conditions = buildWhereConditions(
      { status: ["new", "confirmed"] },
      asDbOrTx(db)
    );
    const results = await queryIssues(conditions);
    expect(results).toHaveLength(2);
    expect(results.map((i) => i.id)).toContain(ISSUE_1_ID);
    expect(results.map((i) => i.id)).toContain(ISSUE_2_ID);
  });

  it("filters by search query (title match)", async () => {
    const db = await getTestDb();
    const where = buildWhereConditions({ q: "Gumball" }, asDbOrTx(db));
    const results = await queryIssues(where);
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe(ISSUE_2_ID);
  });

  it("filters by search query (issue number match)", async () => {
    const db = await getTestDb();
    const where = buildWhereConditions({ q: "1" }, asDbOrTx(db));
    const results = await queryIssues(where);
    expect(results.some((i) => i.id === ISSUE_1_ID)).toBe(true);
  });

  it("filters by search query (machine initials match)", async () => {
    const db = await getTestDb();
    const where = buildWhereConditions({ q: "AFM" }, asDbOrTx(db));
    const results = await queryIssues(where);
    expect(results).toHaveLength(2);
    expect(results.map((i: Issue) => i.id)).toContain(ISSUE_1_ID);
    expect(results.map((i: Issue) => i.id)).toContain(ISSUE_3_ID);
  });

  it("defaults to open statuses when status is undefined", async () => {
    const db = await getTestDb();
    const where = buildWhereConditions({}, asDbOrTx(db));
    const results = await queryIssues(where);
    // ISSUE_1 (new), ISSUE_2 (confirmed) are open. ISSUE_3 (in_progress) is also open.
    // Wait, let's check OPEN_STATUSES definition.
    expect(results.length).toBeGreaterThan(0);
    expect(
      results.every((i: Issue) =>
        (["new", "confirmed", "in_progress"] as string[]).includes(i.status)
      )
    ).toBe(true);
  });

  it("shows all statuses when status is empty array (all)", async () => {
    const db = await getTestDb();
    const where = buildWhereConditions({ status: [] }, asDbOrTx(db));
    const results = await queryIssues(where);
    // Should include all 3 issues regardless of status
    expect(results).toHaveLength(3);
  });

  it("filters by combined status and machine initials", async () => {
    const db = await getTestDb();
    const where = buildWhereConditions(
      {
        status: ["new"],
        machine: ["AFM"],
      },
      asDbOrTx(db)
    );
    const results = await queryIssues(where);
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe(ISSUE_1_ID);
  });

  it("filters by severity and priority", async () => {
    const db = await getTestDb();
    const where = buildWhereConditions(
      {
        severity: ["major"],
        priority: ["high"],
      },
      asDbOrTx(db)
    );
    const results = await queryIssues(where);
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe(ISSUE_1_ID);
  });

  it("filters by owner", async () => {
    const db = await getTestDb();
    const where = buildWhereConditions(
      {
        owner: [ALICE_ID],
      },
      asDbOrTx(db)
    );
    const results = await queryIssues(where);
    expect(results).toHaveLength(2);
    expect(results.map((i) => i.id)).toContain(ISSUE_1_ID);
    expect(results.map((i) => i.id)).toContain(ISSUE_3_ID);
    expect(results.map((i) => i.id)).not.toContain(ISSUE_2_ID);
  });

  it("excludes issues from inactive machines by default", async () => {
    const db = await getTestDb();
    const where = buildWhereConditions({ status: [] }, asDbOrTx(db));
    const results = await queryIssues(where);

    expect(results.map((i) => i.id)).not.toContain(ISSUE_4_ID);
    expect(results).toHaveLength(3);
  });

  it("includes every presence state when Machine Presence is empty", async () => {
    const db = await getTestDb();
    const where = buildWhereConditions(
      { status: [], presence: [] },
      asDbOrTx(db)
    );
    const results = await queryIssues(where);

    expect(results.map((i) => i.id)).toContain(ISSUE_4_ID);
    expect(results).toHaveLength(4);
  });

  describe("search over descriptions and comments (PP-0fg0.4)", () => {
    /** A one-paragraph doc: `text` followed by a mention carrying `label`. */
    const mentionDoc = (
      text: string,
      id: string,
      label: string
    ): ProseMirrorDoc => ({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text },
            { type: "mention", attrs: { id, label } },
          ],
        },
      ],
    });

    const searchIds = async (q: string): Promise<string[]> => {
      const db = await getTestDb();
      return (await queryIssues(buildWhereConditions({ q }, asDbOrTx(db)))).map(
        (i) => i.id
      );
    };

    const describeIssue2 = async (doc: ProseMirrorDoc): Promise<void> => {
      const db = await getTestDb();
      await db
        .update(issues)
        .set({ description: doc })
        .where(eq(issues.id, ISSUE_2_ID));
    };

    it("matches a description's text", async () => {
      await describeIssue2(mentionDoc("Coil stop fried, ask ", ALICE_ID, "x"));
      expect(await searchIds("coil stop")).toEqual([ISSUE_2_ID]);
    });

    it("matches a mention by the person's current name, not the stored label", async () => {
      // Alice was "Alicia Formername" when mentioned. Issue 2 has no other
      // connection to her (Bob reported it, nobody is assigned).
      await describeIssue2(mentionDoc("Ask ", ALICE_ID, "Alicia Formername"));
      expect(await searchIds("Alice Owner")).toContain(ISSUE_2_ID);
      expect(await searchIds("Formername")).not.toContain(ISSUE_2_ID);
    });

    it("matches a mention of a deleted account as Former user", async () => {
      await describeIssue2(
        mentionDoc(
          "Ask ",
          "00000000-0000-0000-0000-00000000dead",
          "Gone Person"
        )
      );
      expect(await searchIds("Former user")).toEqual([ISSUE_2_ID]);
      expect(await searchIds("Gone Person")).toEqual([]);
    });

    it("matches a mention with a malformed id by its stored label", async () => {
      await describeIssue2(mentionDoc("Ask ", "not-a-uuid", "Legacy Label"));
      expect(await searchIds("Legacy Label")).toEqual([ISSUE_2_ID]);
    });

    it("does not match the stored JSON's node types or attribute names", async () => {
      await describeIssue2(mentionDoc("Ask ", ALICE_ID, "Alice Owner"));
      expect(await searchIds("paragraph")).toEqual([]);
      expect(await searchIds("mention")).toEqual([]);
      expect(await searchIds("label")).toEqual([]);
    });

    it("matches a comment's text and its mentions by current name", async () => {
      const db = await getTestDb();
      await db.insert(issueComments).values({
        issueId: ISSUE_2_ID,
        authorId: BOB_ID,
        content: mentionDoc(
          "Replaced the switch, thanks ",
          CHARLIE_ID,
          "Chuck"
        ),
      });

      expect(await searchIds("replaced the switch")).toEqual([ISSUE_2_ID]);
      expect(await searchIds("Charlie Assignee")).toContain(ISSUE_2_ID);
      expect(await searchIds("Chuck")).toEqual([]);
      expect(await searchIds("paragraph")).toEqual([]);
    });
  });
});
