import { describe, it, expect } from "vitest";
import { createMockClient } from "./client-mock";

const CREDS = { email: "tim@example.com", token: "tok" };

describe("mock PinballMap client", () => {
  it("seeds a snapshot from the real location fixture", async () => {
    const client = createMockClient();
    const snap = await client.fetchLocation(26454);
    expect(snap.locationId).toBe(26454);
    expect(snap.lmxes.length).toBeGreaterThan(50);
    // The captured fixture has real condition notes.
    const conditions = snap.lmxes.flatMap((l) => l.conditions);
    expect(conditions.length).toBeGreaterThan(0);
    expect(conditions[0]?.id).toEqual(expect.any(Number));
  });

  it("returns a catalog of named machines", async () => {
    const client = createMockClient();
    const catalog = await client.fetchCatalog();
    expect(catalog.length).toBeGreaterThan(50);
    expect(catalog.every((m) => m.name.length > 0)).toBe(true);
  });

  it("exposes machine groups and multi-edition families", async () => {
    const client = createMockClient();
    const groups = await client.fetchMachineGroups();
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.every((g) => g.name.length > 0)).toBe(true);

    // The fixtures carry Medieval Madness (group 18) as a real multi-edition
    // family — the picker's canonical two-step example.
    const mm = groups.find((g) => g.name === "Medieval Madness");
    expect(mm).toBeDefined();
    const catalog = await client.fetchCatalog();
    const editions = catalog.filter(
      (m) => m.machineGroupId === mm?.machineGroupId
    );
    expect(editions.length).toBeGreaterThan(1);
  });

  it("addMachine appears in the next snapshot and returns a new lmx id", async () => {
    const client = createMockClient();
    const before = await client.fetchLocation(26454);
    const result = await client.addMachine({
      credentials: CREDS,
      locationId: 26454,
      machineId: 999999,
    });
    expect(result.ok).toBe(true);
    const after = await client.fetchLocation(26454);
    expect(after.lmxes.length).toBe(before.lmxes.length + 1);
    expect(after.lmxes.some((l) => l.machineId === 999999)).toBe(true);
  });

  it("removeMachine drops the lmx; unknown id is not_found", async () => {
    const client = createMockClient();
    const snap = await client.fetchLocation(26454);
    const target = snap.lmxes[0];
    if (!target) throw new Error("fixture has no lmxes");

    const ok = await client.removeMachine({
      credentials: CREDS,
      lmxId: target.id,
    });
    expect(ok).toEqual({ ok: true });

    const after = await client.fetchLocation(26454);
    expect(after.lmxes.some((l) => l.id === target.id)).toBe(false);

    const missing = await client.removeMachine({
      credentials: CREDS,
      lmxId: -1,
    });
    expect(missing).toEqual({
      ok: false,
      reason: "not_found",
      message: "Failed to find machine",
    });
  });

  it("postCondition appends a comment; unknown lmx is not_found", async () => {
    const client = createMockClient();
    const snap = await client.fetchLocation(26454);
    const target = snap.lmxes[0];
    if (!target) throw new Error("fixture has no lmxes");

    const res = await client.postCondition({
      credentials: CREDS,
      lmxId: target.id,
      comment: "flippers rebuilt",
    });
    expect(res).toEqual({ ok: true });

    const after = await client.fetchLocation(26454);
    const updated = after.lmxes.find((l) => l.id === target.id);
    expect(
      updated?.conditions.some((c) => c.comment === "flippers rebuilt")
    ).toBe(true);

    const missing = await client.postCondition({
      credentials: CREDS,
      lmxId: -1,
      comment: "x",
    });
    expect(missing).toEqual({
      ok: false,
      reason: "not_found",
      message: "Failed to find machine",
    });
  });

  it("setInsiderConnected sets the requested state on an eligible title", async () => {
    const client = createMockClient();
    const catalog = await client.fetchCatalog();
    const eligible = new Set(
      catalog.filter((m) => m.icEligible).map((m) => m.machineId)
    );
    const snap = await client.fetchLocation(26454);
    const target = snap.lmxes.find((l) => eligible.has(l.machineId));
    if (!target) throw new Error("fixture has no eligible lmx");

    for (const enabled of [false, false, true]) {
      const res = await client.setInsiderConnected({
        credentials: CREDS,
        lmxId: target.id,
        enabled,
      });
      // A setter: repeating a value leaves it, never inverts it.
      expect(res).toEqual({ ok: true, icEnabled: enabled });
    }
    const after = await client.fetchLocation(26454);
    expect(after.lmxes.find((l) => l.id === target.id)?.icEnabled).toBe(true);
  });

  it("setInsiderConnected rejects a title the catalog does not mark eligible", async () => {
    const client = createMockClient();
    const catalog = await client.fetchCatalog();
    const eligible = new Set(
      catalog.filter((m) => m.icEligible).map((m) => m.machineId)
    );
    const snap = await client.fetchLocation(26454);
    const target = snap.lmxes.find((l) => !eligible.has(l.machineId));
    if (!target) throw new Error("fixture has no ineligible lmx");

    expect(
      await client.setInsiderConnected({
        credentials: CREDS,
        lmxId: target.id,
        enabled: true,
      })
    ).toEqual({
      ok: false,
      reason: "rejected",
      message: "Could not update Insider Connected for this machine",
    });
  });

  it("authDetails returns a token for creds and rejects empty input", async () => {
    const client = createMockClient();
    expect(await client.authDetails("tim", "pw")).toEqual({
      ok: true,
      token: "mock-token-tim",
      username: "tim",
    });
    expect(await client.authDetails("tim", "")).toEqual({
      ok: false,
      reason: "invalid_credentials",
    });
  });

  it("instances are isolated", async () => {
    const a = createMockClient();
    const b = createMockClient();
    await a.addMachine({ credentials: CREDS, locationId: 26454, machineId: 1 });
    const aSnap = await a.fetchLocation(26454);
    const bSnap = await b.fetchLocation(26454);
    expect(aSnap.lmxes.length).toBe(bSnap.lmxes.length + 1);
  });
});
