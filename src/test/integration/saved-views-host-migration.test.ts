import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { collections, userProfiles } from "~/server/db/schema";
import { isPgErrorCode } from "~/lib/db/postgres-errors";
import { createTestUser } from "~/test/helpers/factories";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";

function statements(file: string): string[] {
  return readFileSync(resolve("drizzle", file), "utf8")
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

const state = JSON.stringify({ q: "", presence: "all" });

/**
 * 0098 moves Saved Views from Surfaces to List Hosts (list-views §10.5,
 * §10.7, §10.9, §10.10): Collection and owner-Collection views merge into
 * the account's machine set, renamed on a collision, and only Machines-page
 * defaults survive.
 */
describe("0098 list-host saved views migration", () => {
  setupTestDb();

  it("merges Collection views into the machine set and keeps only Machines defaults", async () => {
    const db = await getTestDb();
    const alice = randomUUID();
    const bob = randomUUID();
    const carol = randomUUID();
    const backRoom = randomUUID();
    const bar = randomUUID();
    await db
      .insert(userProfiles)
      .values([
        createTestUser({ id: alice }),
        createTestUser({ id: bob, firstName: "Bob", lastName: "Pinball" }),
        createTestUser({ id: carol }),
      ]);
    await db.insert(collections).values([
      { id: backRoom, name: "Back room", ownerId: alice },
      { id: bar, name: "Bar", ownerId: alice },
    ]);

    // Recreate the pre-0098 tables from their own migration, so the data
    // transformation runs against the shape production has rather than the
    // schema-derived PGlite export. 0093–0097 do not touch these tables.
    await db.execute(sql`DROP TABLE machine_view_defaults`);
    await db.execute(sql`DROP TABLE machine_view_saved_views`);
    for (const statement of statements("0092_machine-view-saved-views.sql")) {
      await db.execute(sql.raw(statement));
    }

    async function legacyView(
      userId: string,
      name: string,
      surface: { collectionId?: string; ownerId?: string } = {}
    ): Promise<string> {
      const id = randomUUID();
      const kind = surface.collectionId
        ? "collection"
        : surface.ownerId
          ? "owner"
          : "machines";
      await db.execute(sql`
        INSERT INTO machine_view_saved_views (
          id, user_id, surface, collection_id, owner_collection_user_id,
          name, state
        ) VALUES (
          ${id}, ${userId}, ${kind}, ${surface.collectionId ?? null},
          ${surface.ownerId ?? null}, ${name}, ${state}::jsonb
        )
      `);
      return id;
    }

    const aliceBroken = await legacyView(alice, "Broken");
    await legacyView(alice, "Broken (Back room)");
    const aliceBackRoomBroken = await legacyView(alice, "broken", {
      collectionId: backRoom,
    });
    await legacyView(alice, "Unique", { collectionId: backRoom });
    await legacyView(alice, "Broken", { collectionId: bar });
    await legacyView(alice, "Broken", { ownerId: bob });
    const carolView = await legacyView(carol, "Broken", {
      collectionId: backRoom,
    });

    await db.execute(sql`
      INSERT INTO machine_view_defaults
        (user_id, surface, collection_id, saved_view_id, built_in_view_id)
      VALUES
        (${alice}, 'machines', NULL, ${aliceBroken}, NULL),
        (${alice}, 'collection', ${backRoom}, NULL, 'on-the-floor'),
        (${carol}, 'collection', ${backRoom}, ${carolView}, NULL)
    `);

    for (const statement of statements("0098_list-host-saved-views.sql")) {
      await db.execute(sql.raw(statement));
    }

    const views = await db.execute<{
      user_id: string;
      name: string;
      host: string;
      surface: string;
      collection_id: string | null;
      owner_collection_user_id: string | null;
    }>(sql`
      SELECT user_id, name, host, surface, collection_id,
             owner_collection_user_id
        FROM machine_view_saved_views
       ORDER BY user_id = ${alice} DESC, lower(name)
    `);
    expect(
      views.rows.map(({ user_id, name }) => ({
        user: user_id === alice ? "alice" : "carol",
        name,
      }))
    ).toEqual([
      { user: "alice", name: "Broken" },
      { user: "alice", name: "Broken (Back room)" },
      { user: "alice", name: "broken (Back room) 2" },
      { user: "alice", name: "Broken (Bar)" },
      { user: "alice", name: "Broken (Bob Pinball's Machines)" },
      { user: "alice", name: "Unique" },
      // Another account's names never collide with Alice's.
      { user: "carol", name: "Broken" },
    ]);
    for (const view of views.rows) {
      expect(view).toMatchObject({
        host: "machines",
        surface: "machines",
        collection_id: null,
        owner_collection_user_id: null,
      });
    }

    const defaults = await db.execute<{
      user_id: string;
      host: string;
      saved_view_id: string | null;
    }>(sql`SELECT user_id, host, saved_view_id FROM machine_view_defaults`);
    expect(defaults.rows).toEqual([
      { user_id: alice, host: "machines", saved_view_id: aliceBroken },
    ]);

    // The merged view keeps its id, so its `view` URLs keep working.
    const merged = await db.execute<{ name: string }>(sql`
      SELECT name FROM machine_view_saved_views WHERE id = ${aliceBackRoomBroken}
    `);
    expect(merged.rows).toEqual([{ name: "broken (Back room) 2" }]);
  });

  it("keeps the previous runtime's Machines writes working and refuses its Collection writes", async () => {
    const db = await getTestDb();
    const alice = randomUUID();
    const backRoom = randomUUID();
    await db.insert(userProfiles).values(createTestUser({ id: alice }));
    await db
      .insert(collections)
      .values({ id: backRoom, name: "Back room", ownerId: alice });
    await db.execute(sql`DROP TABLE machine_view_defaults`);
    await db.execute(sql`DROP TABLE machine_view_saved_views`);
    for (const statement of [
      ...statements("0092_machine-view-saved-views.sql"),
      ...statements("0098_list-host-saved-views.sql"),
    ]) {
      await db.execute(sql.raw(statement));
    }

    // The deployment still serving during the build inserts without `host`
    // and names its Surface; a Machines-page write lands in the machine set.
    await db.execute(sql`
      INSERT INTO machine_view_saved_views
        (user_id, surface, collection_id, owner_collection_user_id, name, state)
      VALUES (${alice}, 'machines', NULL, NULL, 'Old runtime', ${state}::jsonb)
    `);
    const written = await db.execute<{ host: string }>(sql`
      SELECT host FROM machine_view_saved_views WHERE name = 'Old runtime'
    `);
    expect(written.rows).toEqual([{ host: "machines" }]);

    // A Collection default from that runtime would read as the host default
    // here, so the legacy check refuses it.
    const collectionDefault: unknown = await db
      .execute(
        sql`
          INSERT INTO machine_view_defaults
            (user_id, surface, collection_id, built_in_view_id)
          VALUES (${alice}, 'collection', ${backRoom}, 'on-the-floor')
        `
      )
      .then(
        () => null,
        (caught: unknown) => caught
      );
    expect(isPgErrorCode(collectionDefault, "23514")).toBe(true);

    // Issue views share the table without colliding with machine names.
    await db.execute(sql`
      INSERT INTO machine_view_saved_views (user_id, host, name, state)
      VALUES (${alice}, 'issues', 'Old runtime', '{}'::jsonb)
    `);
  });
});
