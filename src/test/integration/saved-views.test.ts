import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { asDbOrTx, getTestDb, setupTestDb } from "~/test/setup/pglite";
import { createTestMachine, createTestUser } from "~/test/helpers/factories";
import {
  collectionMachines,
  collections,
  machines,
  savedViews,
  userProfiles,
} from "~/server/db/schema";
import type { ListHost, MachineViewSavedState } from "~/lib/types";
import { isPgErrorCode } from "~/lib/db/postgres-errors";
import { getViewer } from "~/lib/collections/viewer";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});
vi.mock("~/lib/collections/viewer", () => ({ getViewer: vi.fn() }));

const {
  createSavedView,
  deleteSavedView,
  getDefaultViewId,
  listSavedViews,
  renameSavedView,
  setDefaultView,
  updateSavedViewState,
} = await import("~/lib/list-view/saved-views");
const { listSavedMachineViews, loadMachineViewSavedViews } =
  await import("~/lib/machines/view/saved-views");
const { loadMachineViewFromDatabase } =
  await import("~/lib/machines/view/queries");
const {
  normalizeMachineViewSavedState,
  savedMachineViewSearchParams,
  toMachineViewSavedState,
} = await import("~/lib/machines/view/state");

const state: MachineViewSavedState = {
  q: "",
  presence: ["on_the_floor"],
  status: ["unplayable"],
  severity: ["major"],
  owner: [],
  sort: "machine",
  dir: "asc",
  pageSize: 25,
  columns: ["machine", "playability"],
};

const builtInViewIds = ["on-the-floor", "needs-attention"];

describe("saved view storage (list-views §10)", () => {
  setupTestDb();

  const userId = randomUUID();
  const otherUserId = randomUUID();

  beforeEach(async () => {
    const db = await getTestDb();
    await db
      .insert(userProfiles)
      .values([
        createTestUser({ id: userId }),
        createTestUser({ id: otherUserId }),
      ]);
  });

  async function create(
    name: string,
    options: { host?: ListHost; userId?: string; makeDefault?: boolean } = {}
  ): Promise<string> {
    const db = await getTestDb();
    const result = await createSavedView(asDbOrTx(db), {
      userId: options.userId ?? userId,
      host: options.host ?? "machines",
      name,
      state,
      makeDefault: options.makeDefault ?? false,
    });
    if (!result.ok) throw new Error(result.message);
    return result.value.id;
  }

  it("lists only the account's views of the requested host, by name", async () => {
    const db = asDbOrTx(await getTestDb());
    await create("zeta");
    await create("Alpha");
    await create("Open issues", { host: "issues" });
    await create("Other account", { userId: otherUserId });

    const machines = await listSavedViews(db, userId, "machines");
    expect(machines.map((view) => view.name)).toEqual(["Alpha", "zeta"]);
    expect(machines[0]?.state).toEqual(state);

    const issues = await listSavedViews(db, userId, "issues");
    expect(issues.map((view) => view.name)).toEqual(["Open issues"]);
  });

  it("rejects a colliding name within a host, ignoring case (§10.7)", async () => {
    const db = asDbOrTx(await getTestDb());
    await create("Needs attention");

    const collision = await createSavedView(db, {
      userId,
      host: "machines",
      name: "  needs ATTENTION ",
      state,
      makeDefault: false,
    });
    expect(collision).toMatchObject({ ok: false, code: "NAME_TAKEN" });

    // The same name is free on the other host and for another account.
    await create("Needs attention", { host: "issues" });
    await create("Needs attention", { userId: otherUserId });
  });

  it("enforces unique names per host in the database for concurrent saves", async () => {
    const db = await getTestDb();
    await create("Needs attention");
    const duplicate = db.insert(savedViews).values({
      userId,
      host: "machines",
      name: "NEEDS ATTENTION",
      state,
    });
    const error: unknown = await duplicate.then(
      () => null,
      (caught: unknown) => caught
    );
    expect(isPgErrorCode(error, "23505")).toBe(true);
  });

  it("rejects a blank name", async () => {
    const db = asDbOrTx(await getTestDb());
    const result = await createSavedView(db, {
      userId,
      host: "machines",
      name: "   ",
      state,
      makeDefault: false,
    });
    expect(result).toMatchObject({ ok: false, code: "INVALID_NAME" });
  });

  it("keeps one Default View per host, a Saved View or a Built-in View (§10.9)", async () => {
    const db = asDbOrTx(await getTestDb());
    const first = await create("First", { makeDefault: true });
    const second = await create("Second", { makeDefault: true });
    const issuesDefault = await create("Issues", {
      host: "issues",
      makeDefault: true,
    });

    expect(await getDefaultViewId(db, userId, "machines")).toBe(second);

    await setDefaultView(db, {
      userId,
      host: "machines",
      target: { kind: "saved", id: first },
      builtInViewIds,
    });
    expect(await getDefaultViewId(db, userId, "machines")).toBe(first);

    await setDefaultView(db, {
      userId,
      host: "machines",
      target: { kind: "builtIn", id: "needs-attention" },
      builtInViewIds,
    });
    expect(await getDefaultViewId(db, userId, "machines")).toBe(
      "needs-attention"
    );

    // Each host keeps its own default.
    expect(await getDefaultViewId(db, userId, "issues")).toBe(issuesDefault);

    await setDefaultView(db, {
      userId,
      host: "machines",
      target: null,
      builtInViewIds,
    });
    expect(await getDefaultViewId(db, userId, "machines")).toBeNull();
    expect(await getDefaultViewId(db, userId, "issues")).toBe(issuesDefault);
  });

  it("refuses an unoffered Built-in View or another host's Saved View as a default", async () => {
    const db = asDbOrTx(await getTestDb());
    const issuesView = await create("Open issues", { host: "issues" });

    expect(
      await setDefaultView(db, {
        userId,
        host: "machines",
        target: { kind: "builtIn", id: "service-due" },
        builtInViewIds,
      })
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(
      await setDefaultView(db, {
        userId,
        host: "machines",
        target: { kind: "saved", id: issuesView },
        builtInViewIds,
      })
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await getDefaultViewId(db, userId, "machines")).toBeNull();
  });

  it("leaves the host without a default when the default is deleted (§10.13)", async () => {
    const db = asDbOrTx(await getTestDb());
    const defaultId = await create("Default", { makeDefault: true });
    await create("Other");

    await deleteSavedView(db, { userId, host: "machines", id: defaultId });
    expect(await getDefaultViewId(db, userId, "machines")).toBeNull();
    const views = await listSavedViews(db, userId, "machines");
    expect(views.map((view) => view.name)).toEqual(["Other"]);
  });

  it("only lets the owning account change a view, and only through its host (§10.3)", async () => {
    const db = asDbOrTx(await getTestDb());
    const id = await create("Mine");

    for (const caller of [
      { userId: otherUserId, host: "machines" as const },
      { userId, host: "issues" as const },
    ]) {
      expect(
        await renameSavedView(db, { ...caller, id, name: "Theirs" })
      ).toMatchObject({ ok: false, code: "NOT_FOUND" });
      expect(
        await updateSavedViewState(db, {
          ...caller,
          id,
          state: { ...state, q: "hijack" },
        })
      ).toMatchObject({ ok: false, code: "NOT_FOUND" });
      expect(
        await setDefaultView(db, {
          ...caller,
          target: { kind: "saved", id },
          builtInViewIds,
        })
      ).toMatchObject({ ok: false, code: "NOT_FOUND" });
      expect(await deleteSavedView(db, { ...caller, id })).toMatchObject({
        ok: false,
        code: "NOT_FOUND",
      });
    }

    const [view] = await listSavedViews(db, userId, "machines");
    expect(view).toMatchObject({ name: "Mine", state });
    expect(await getDefaultViewId(db, otherUserId, "machines")).toBeNull();
    expect(await getDefaultViewId(db, userId, "issues")).toBeNull();
  });

  it("renames and saves changes for the owner", async () => {
    const db = asDbOrTx(await getTestDb());
    const id = await create("Before");
    await create("Taken");

    expect(
      await renameSavedView(db, {
        userId,
        host: "machines",
        id,
        name: "taken",
      })
    ).toMatchObject({ ok: false, code: "NAME_TAKEN" });
    // Renaming a view to a different case of its own name is allowed.
    expect(
      await renameSavedView(db, {
        userId,
        host: "machines",
        id,
        name: "BEFORE",
      })
    ).toMatchObject({ ok: true });

    await updateSavedViewState(db, {
      userId,
      host: "machines",
      id,
      state: { ...state, q: "stern" },
    });
    const views = await listSavedViews(db, userId, "machines");
    expect(views.find((view) => view.id === id)).toMatchObject({
      name: "BEFORE",
      state: { ...state, q: "stern" },
    });
  });
});

describe("machine Saved Views on each Surface (list-views §10.5, §10.10)", () => {
  setupTestDb();

  const userId = randomUUID();

  beforeEach(async () => {
    const db = await getTestDb();
    await db.insert(userProfiles).values(createTestUser({ id: userId }));
    vi.mocked(getViewer).mockResolvedValue({ userId, role: "member" });
  });

  it("offers the same Saved Views everywhere and opens the default only on Machines", async () => {
    const db = asDbOrTx(await getTestDb());
    const created = await createSavedView(db, {
      userId,
      host: "machines",
      name: "Broken",
      state,
      makeDefault: true,
    });
    if (!created.ok) throw new Error(created.message);
    const id = created.value.id;

    const machinesPage = await loadMachineViewSavedViews(
      "machines",
      new URLSearchParams()
    );
    expect(machinesPage.redirectTo).toMatch(new RegExp(`^/m\\?.*view=${id}`));
    expect(machinesPage.savedViews).toMatchObject({
      canSave: true,
      offersDefault: true,
      defaultViewId: id,
    });

    // A Collection or Tag tab opens its Page Preset, never the default, yet
    // lists the same Saved Views and accepts one by `view`.
    const tab = await loadMachineViewSavedViews(
      "collection",
      new URLSearchParams()
    );
    expect(tab.redirectTo).toBeNull();
    expect(tab.savedViews).toMatchObject({
      canSave: true,
      offersDefault: false,
      activeViewId: null,
    });
    expect(tab.savedViews.views).toEqual(machinesPage.savedViews.views);

    const applied = await loadMachineViewSavedViews(
      "collection",
      new URLSearchParams({ view: id, status: "unplayable" })
    );
    expect(applied.savedViews.activeViewId).toBe(id);
  });

  it("drops stored values that no longer exist when a view is read (§10.14)", async () => {
    const db = await getTestDb();
    await db.insert(savedViews).values({
      userId,
      host: "machines",
      name: "Old",
      state: {
        ...state,
        status: ["unplayable", "retired_status"],
        columns: ["machine", "retiredField", "owner"],
        issuesWidget: "filtered",
        // Retired with the All/Filtered choice (machine-widgets §2.2).
        presenceWidget: "filtered",
        playabilityWidget: "filtered",
      },
    });

    const { savedViews: offered } = await loadMachineViewSavedViews(
      "machines",
      new URLSearchParams()
    );
    expect(offered.views).toEqual([
      expect.objectContaining({
        name: "Old",
        state: {
          ...state,
          status: ["unplayable"],
          columns: ["machine", "owner"],
        },
      }),
    ]);
  });

  it("drops a stored owner only once that person no longer exists (§10.14)", async () => {
    const db = await getTestDb();
    const ownerId = randomUUID();
    await db
      .insert(userProfiles)
      .values(createTestUser({ id: ownerId, firstName: "Dana" }));
    await createSavedView(asDbOrTx(db), {
      userId,
      host: "machines",
      name: "Dana's",
      state: { ...state, owner: [ownerId, randomUUID(), "unassigned"] },
      makeDefault: false,
    });

    const [view] = await listSavedMachineViews(asDbOrTx(db), userId);
    expect(view?.state.owner).toEqual([ownerId, "unassigned"]);
  });

  it("keeps an out-of-scope owner through apply and Save changes on a Collection tab (§10.18)", async () => {
    const db = await getTestDb();
    const danaId = randomUUID();
    const collectionId = randomUUID();
    const insideId = randomUUID();
    await db
      .insert(userProfiles)
      .values(createTestUser({ id: danaId, firstName: "Dana" }));
    await db.insert(machines).values([
      createTestMachine({
        id: insideId,
        initials: "INS",
        name: "Inside",
        ownerId: userId,
      }),
      createTestMachine({ initials: "DAN", name: "Dana's", ownerId: danaId }),
    ]);
    await db
      .insert(collections)
      .values({ id: collectionId, name: "Mine", ownerId: userId });
    await db
      .insert(collectionMachines)
      .values({ collectionId, machineId: insideId, addedBy: userId });
    const stored: MachineViewSavedState = {
      ...state,
      presence: "all",
      status: [],
      severity: [],
      owner: [danaId],
    };
    const created = await createSavedView(asDbOrTx(db), {
      userId,
      host: "machines",
      name: "Dana's machines",
      state: stored,
      makeDefault: false,
    });
    if (!created.ok) throw new Error(created.message);
    const id = created.value.id;

    // Apply the view on the Collection tab: Dana owns nothing here, so the
    // filter stays set and the tab shows no machines.
    const { savedViews: offered } = await loadMachineViewSavedViews(
      "collection",
      new URLSearchParams({ view: id })
    );
    const offeredView = offered.views.find((view) => view.id === id);
    if (!offeredView) throw new Error("Saved View not offered");
    const applied = await loadMachineViewFromDatabase(asDbOrTx(db), {
      scope: { kind: "collection", collectionId },
      preset: "collection",
      searchParams: savedMachineViewSearchParams(
        offeredView.state,
        "collection",
        id
      ),
    });
    expect(applied.state.owner).toEqual([danaId]);
    expect(applied.rows).toEqual([]);
    expect(applied.ownerOptions).toContainEqual({
      id: danaId,
      name: "Dana User",
    });

    // Save changes writes back the applied configuration, as the Saved
    // Views menu and its server action do.
    const saved = await updateSavedViewState(asDbOrTx(db), {
      userId,
      host: "machines",
      id,
      state: normalizeMachineViewSavedState(
        toMachineViewSavedState({ ...applied.state, q: "inside" })
      ),
    });
    expect(saved).toMatchObject({ ok: true });
    const [reread] = await listSavedMachineViews(asDbOrTx(db), userId);
    expect(reread?.state).toMatchObject({ owner: [danaId], q: "inside" });
  });

  it("offers an anonymous visitor Built-in Views only", async () => {
    const created = await createSavedView(asDbOrTx(await getTestDb()), {
      userId,
      host: "machines",
      name: "Mine",
      state,
      makeDefault: true,
    });
    if (!created.ok) throw new Error(created.message);
    vi.mocked(getViewer).mockResolvedValue({
      userId: undefined,
      role: null,
    });

    const { savedViews: offered, redirectTo } = await loadMachineViewSavedViews(
      "machines",
      new URLSearchParams()
    );
    expect(redirectTo).toBeNull();
    expect(offered).toMatchObject({
      canSave: false,
      offersDefault: false,
      views: [],
      defaultViewId: null,
    });
    expect(offered.builtInViews.map((view) => view.id)).toContain(
      "on-the-floor"
    );
  });
});
