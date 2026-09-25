import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { asDbOrTx, getTestDb, setupTestDb } from "~/test/setup/pglite";
import { createTestUser } from "~/test/helpers/factories";
import {
  collections,
  machineViewSavedViews,
  userProfiles,
} from "~/server/db/schema";
import type { MachineViewSavedState } from "~/lib/types";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

const {
  createSavedMachineView,
  deleteSavedMachineView,
  listSavedMachineViews,
  renameSavedMachineView,
  setSavedMachineViewDefault,
  updateSavedMachineViewState,
} = await import("~/lib/machines/view/saved-views");

const state: MachineViewSavedState = {
  q: "",
  presence: ["on_the_floor"],
  status: ["unplayable"],
  owner: [],
  sort: "machine",
  dir: "asc",
  pageSize: 25,
  columns: ["machine", "playability"],
};

describe("machine view saved views persistence", () => {
  setupTestDb();

  const userId = randomUUID();
  const otherUserId = randomUUID();
  const collectionId = randomUUID();
  const otherCollectionId = randomUUID();

  beforeEach(async () => {
    const db = await getTestDb();
    await db
      .insert(userProfiles)
      .values([
        createTestUser({ id: userId }),
        createTestUser({ id: otherUserId }),
      ]);
    await db.insert(collections).values([
      { id: collectionId, name: "One", ownerId: userId },
      { id: otherCollectionId, name: "Two", ownerId: userId },
    ]);
  });

  async function create(
    name: string,
    key: Parameters<typeof createSavedMachineView>[1]["key"] = {
      surface: "machines",
    },
    options: { userId?: string; makeDefault?: boolean } = {}
  ): Promise<string> {
    const db = await getTestDb();
    const result = await createSavedMachineView(asDbOrTx(db), {
      userId: options.userId ?? userId,
      key,
      name,
      state,
      makeDefault: options.makeDefault ?? false,
    });
    if (!result.ok) throw new Error(result.message);
    return result.value.id;
  }

  it("lists only the account's views on the requested Surface, by name", async () => {
    const db = asDbOrTx(await getTestDb());
    await create("zeta");
    await create("Alpha");
    await create("In collection", { surface: "collection", collectionId });
    await create(
      "Other account",
      { surface: "machines" },
      {
        userId: otherUserId,
      }
    );

    const machines = await listSavedMachineViews(db, userId, {
      surface: "machines",
    });
    expect(machines.map((view) => view.name)).toEqual(["Alpha", "zeta"]);
    expect(machines[0]?.state).toEqual(state);

    const inCollection = await listSavedMachineViews(db, userId, {
      surface: "collection",
      collectionId,
    });
    expect(inCollection.map((view) => view.name)).toEqual(["In collection"]);
    const otherCollection = await listSavedMachineViews(db, userId, {
      surface: "collection",
      collectionId: otherCollectionId,
    });
    expect(otherCollection).toEqual([]);
  });

  it("rejects a colliding name on the same Surface, ignoring case", async () => {
    const db = asDbOrTx(await getTestDb());
    await create("Needs attention");

    const collision = await createSavedMachineView(db, {
      userId,
      key: { surface: "machines" },
      name: "  needs ATTENTION ",
      state,
      makeDefault: false,
    });
    expect(collision).toMatchObject({ ok: false, code: "NAME_TAKEN" });

    // The same name is free on another Surface and for another account.
    await create("Needs attention", { surface: "collection", collectionId });
    await create(
      "Needs attention",
      { surface: "machines" },
      {
        userId: otherUserId,
      }
    );
  });

  it("rejects a blank name", async () => {
    const db = asDbOrTx(await getTestDb());
    const result = await createSavedMachineView(db, {
      userId,
      key: { surface: "machines" },
      name: "   ",
      state,
      makeDefault: false,
    });
    expect(result).toMatchObject({ ok: false, code: "INVALID_NAME" });
  });

  it("keeps at most one default per Surface", async () => {
    const db = asDbOrTx(await getTestDb());
    const first = await create(
      "First",
      { surface: "machines" },
      {
        makeDefault: true,
      }
    );
    const second = await create(
      "Second",
      { surface: "machines" },
      {
        makeDefault: true,
      }
    );
    const collectionDefault = await create(
      "Collection",
      { surface: "collection", collectionId },
      { makeDefault: true }
    );

    const views = await listSavedMachineViews(db, userId, {
      surface: "machines",
    });
    expect(
      views.filter((view) => view.isDefault).map((view) => view.id)
    ).toEqual([second]);

    await setSavedMachineViewDefault(db, {
      userId,
      id: first,
      isDefault: true,
    });
    const afterSwitch = await listSavedMachineViews(db, userId, {
      surface: "machines",
    });
    expect(
      afterSwitch.filter((view) => view.isDefault).map((view) => view.id)
    ).toEqual([first]);

    // Defaults on other Surfaces are independent (spec §8.10).
    const [collectionView] = await listSavedMachineViews(db, userId, {
      surface: "collection",
      collectionId,
    });
    expect(collectionView).toMatchObject({
      id: collectionDefault,
      isDefault: true,
    });
  });

  it("leaves the Surface without a default when the default is deleted", async () => {
    const db = asDbOrTx(await getTestDb());
    const defaultId = await create(
      "Default",
      { surface: "machines" },
      {
        makeDefault: true,
      }
    );
    await create("Other");

    await deleteSavedMachineView(db, { userId, id: defaultId });
    const views = await listSavedMachineViews(db, userId, {
      surface: "machines",
    });
    expect(views.map((view) => [view.name, view.isDefault])).toEqual([
      ["Other", false],
    ]);
  });

  it("only lets the owning account change a view", async () => {
    const db = asDbOrTx(await getTestDb());
    const id = await create("Mine");

    expect(
      await renameSavedMachineView(db, {
        userId: otherUserId,
        id,
        name: "Theirs",
      })
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(
      await updateSavedMachineViewState(db, {
        userId: otherUserId,
        id,
        state: { ...state, q: "hijack" },
      })
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(
      await setSavedMachineViewDefault(db, {
        userId: otherUserId,
        id,
        isDefault: true,
      })
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(
      await deleteSavedMachineView(db, { userId: otherUserId, id })
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });

    const [view] = await listSavedMachineViews(db, userId, {
      surface: "machines",
    });
    expect(view).toMatchObject({ name: "Mine", isDefault: false, state });
  });

  it("renames and saves changes for the owner", async () => {
    const db = asDbOrTx(await getTestDb());
    const id = await create("Before");
    await create("Taken");

    expect(
      await renameSavedMachineView(db, { userId, id, name: "taken" })
    ).toMatchObject({ ok: false, code: "NAME_TAKEN" });
    // Renaming a view to a different case of its own name is allowed.
    expect(
      await renameSavedMachineView(db, { userId, id, name: "BEFORE" })
    ).toMatchObject({ ok: true });

    await updateSavedMachineViewState(db, {
      userId,
      id,
      state: { ...state, q: "stern" },
    });
    const views = await listSavedMachineViews(db, userId, {
      surface: "machines",
    });
    expect(views.find((view) => view.id === id)).toMatchObject({
      name: "BEFORE",
      state: { ...state, q: "stern" },
    });
  });

  it("deletes a Collection's views with the Collection", async () => {
    const db = await getTestDb();
    await create("In collection", { surface: "collection", collectionId });
    await db.delete(collections).where(eq(collections.id, collectionId));

    const rows = await db
      .select({ id: machineViewSavedViews.id })
      .from(machineViewSavedViews);
    expect(rows).toEqual([]);
  });
});
