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

  it("toggleInsiderConnected flips the flag and returns the new state", async () => {
    const client = createMockClient();
    const snap = await client.fetchLocation(26454);
    const target = snap.lmxes[0];
    if (!target) throw new Error("fixture has no lmxes");
    const before = target.icEnabled;

    const first = await client.toggleInsiderConnected({
      credentials: CREDS,
      lmxId: target.id,
    });
    expect(first.ok).toBe(true);
    const after = await client.fetchLocation(26454);
    const newState = after.lmxes.find((l) => l.id === target.id)?.icEnabled;
    expect(newState).not.toBe(before);
    if (first.ok) expect(first.icEnabled).toBe(newState);
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
