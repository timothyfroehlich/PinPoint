import { describe, expect, it } from "vitest";
import { asDbOrTx, getTestDb, setupTestDb } from "~/test/setup/pglite";
import { pinTips } from "~/server/db/schema";
import type { PinTip } from "~/lib/pintips/types";

const { getPinTipsForGroup, refreshPinTips } =
  await import("~/lib/pintips/records");

const tip = (tipId: number, opdbGroupId: string, voteTotal = 0): PinTip => ({
  tipId,
  opdbGroupId,
  category: "general",
  voteTotal,
  text: `Tip ${String(tipId)}`,
});

/** The stored PinTips copy (PP-a0be, spec pintips §2). */
describe("PinTips records", () => {
  setupTestDb();

  it("makes the stored copy match each export, dropping removed tips (spec 2.3)", async () => {
    const tx = asDbOrTx(await getTestDb());
    await refreshPinTips(tx, () =>
      Promise.resolve([tip(1, "GweeP"), tip(2, "GweeP"), tip(3, "G5Dz7")])
    );
    expect(
      await refreshPinTips(tx, () =>
        Promise.resolve([tip(1, "GweeP", 5), tip(3, "G5Dz7")])
      )
    ).toBe(2);

    const rows = await tx.select().from(pinTips);
    expect(rows.map((r) => r.tipId).sort()).toEqual([1, 3]);
    expect(rows.find((r) => r.tipId === 1)?.voteTotal).toBe(5);
  });

  it("keeps the stored copy when the download fails (spec 2.4)", async () => {
    const tx = asDbOrTx(await getTestDb());
    await refreshPinTips(tx, () => Promise.resolve([tip(1, "GweeP")]));
    await expect(
      refreshPinTips(tx, () => Promise.reject(new Error("CDN down")))
    ).rejects.toThrow("CDN down");
    expect(await tx.select().from(pinTips)).toHaveLength(1);
  });

  it("reads one game's tips, and none for a game without any", async () => {
    const tx = asDbOrTx(await getTestDb());
    await refreshPinTips(tx, () =>
      Promise.resolve([tip(2, "GweeP", 4), tip(1, "GweeP", 9), tip(3, "G5Dz7")])
    );
    const tips = await getPinTipsForGroup(tx, "GweeP");
    expect(tips.map((t) => t.tipId)).toEqual([1, 2]);
    expect(tips[0]).toEqual({
      tipId: 1,
      category: "general",
      voteTotal: 9,
      text: "Tip 1",
    });
    expect(await getPinTipsForGroup(tx, "GnoPe")).toEqual([]);
  });
});
