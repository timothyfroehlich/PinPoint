/**
 * Integration: @mentions show the mentioned person's current name (PP-0fg0.2).
 *
 * A mention node stores `{ id, label }`, the label frozen at the moment of
 * writing. The loaders resolve every label from `user_profiles` by id, so a
 * rename shows everywhere the doc is read. These tests rename the mentioned
 * person AFTER the content is stored and assert the loaders' output.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import {
  issueComments,
  issues,
  machines,
  userProfiles,
} from "~/server/db/schema";
import {
  createTestComment,
  createTestIssue,
  createTestMachine,
  createTestUser,
} from "~/test/helpers/factories";
import { docToPlainText, type ProseMirrorDoc } from "~/lib/tiptap/types";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

const { loadMentionNames } = await import("~/lib/tiptap/mention-names");
const { getIssueForDetail } =
  await import("~/app/(app)/m/[initials]/i/[issueNumber]/_data");
const { getMachineForLayout } = await import("~/app/(app)/m/[initials]/_data");

/** A one-paragraph doc: `text` followed by a mention carrying `label`. */
function mentionDoc(text: string, id: string, label: string): ProseMirrorDoc {
  return {
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
  };
}

async function insertPerson(firstName: string, lastName: string) {
  const db = await getTestDb();
  const [person] = await db
    .insert(userProfiles)
    .values(createTestUser({ firstName, lastName }))
    .returning({ id: userProfiles.id });
  if (!person) throw new Error("profile insert returned no row");
  return person.id;
}

async function rename(id: string, firstName: string, lastName: string) {
  const db = await getTestDb();
  await db
    .update(userProfiles)
    .set({ firstName, lastName })
    .where(eq(userProfiles.id, id));
}

describe("@mention labels resolve to current names", () => {
  setupTestDb();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("loadMentionNames", () => {
    it("resolves every mention across many docs with one lookup", async () => {
      const db = await getTestDb();
      const ana = await insertPerson("Ana", "Lee");
      const bo = await insertPerson("Bo", "Park");
      await rename(ana, "Anastasia", "Lee");
      const select = vi.spyOn(db, "select");

      const names = await loadMentionNames([
        mentionDoc("Ask ", ana, "Ana Lee"),
        mentionDoc("Ask ", bo, "Bo Park"),
        mentionDoc("Again ", ana, "Ana Lee"),
        null,
      ]);

      expect(Object.fromEntries(names)).toEqual({
        [ana]: "Anastasia Lee",
        [bo]: "Bo Park",
      });
      expect(select).toHaveBeenCalledTimes(1);
    });

    it("names a deleted account 'Former user' and leaves a malformed id out", async () => {
      const deletedId = "00000000-0000-0000-0000-00000000dead";

      const names = await loadMentionNames([
        mentionDoc("Ask ", deletedId, "Old Name"),
        mentionDoc("Ask ", "not-a-uuid", "Legacy"),
      ]);

      expect(Object.fromEntries(names)).toEqual({ [deletedId]: "Former user" });
    });

    it("does not query when no doc holds a mention", async () => {
      const db = await getTestDb();
      const select = vi.spyOn(db, "select");

      const names = await loadMentionNames([
        { type: "doc", content: [{ type: "paragraph" }] },
        undefined,
      ]);

      expect(names.size).toBe(0);
      expect(select).not.toHaveBeenCalled();
    });
  });

  it("issue detail: the description, owner requirements, and comments show the renamed person", async () => {
    const db = await getTestDb();
    const ana = await insertPerson("Ana", "Lee");
    await db.insert(machines).values(
      createTestMachine({
        initials: "MNT",
        ownerRequirements: mentionDoc("Call ", ana, "Ana Lee"),
      })
    );
    const issue = createTestIssue("MNT", {
      description: mentionDoc("Reported to ", ana, "Ana Lee"),
    });
    await db.insert(issues).values(issue);
    await db.insert(issueComments).values([
      createTestComment(issue.id, {
        content: mentionDoc("Thanks ", ana, "Ana Lee"),
      }),
      createTestComment(issue.id, {
        content: mentionDoc("Ping ", ana, "Ana Lee"),
      }),
    ]);
    await rename(ana, "Anastasia", "Lee");

    const loaded = await getIssueForDetail("MNT", 1);

    expect(docToPlainText(loaded?.description)).toBe(
      "Reported to @Anastasia Lee"
    );
    expect(docToPlainText(loaded?.machine.ownerRequirements)).toBe(
      "Call @Anastasia Lee"
    );
    expect(loaded?.comments.map((c) => docToPlainText(c.content))).toEqual([
      "Thanks @Anastasia Lee",
      "Ping @Anastasia Lee",
    ]);
  });

  it("machine page: the description and settings fields show the renamed person", async () => {
    const db = await getTestDb();
    const ana = await insertPerson("Ana", "Lee");
    await db.insert(machines).values(
      createTestMachine({
        initials: "MND",
        description: mentionDoc("Owned with ", ana, "Ana Lee"),
        settingsRequests: mentionDoc("Ask ", ana, "Ana Lee"),
        settingsInstructions: mentionDoc("Set by ", ana, "Ana Lee"),
      })
    );
    await rename(ana, "Anastasia", "Lee");

    const { machine } = await getMachineForLayout("MND");

    expect(docToPlainText(machine?.description)).toBe(
      "Owned with @Anastasia Lee"
    );
    expect(docToPlainText(machine?.settingsRequests)).toBe(
      "Ask @Anastasia Lee"
    );
    expect(docToPlainText(machine?.settingsInstructions)).toBe(
      "Set by @Anastasia Lee"
    );
  });
});
