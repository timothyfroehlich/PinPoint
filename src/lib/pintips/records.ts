import "server-only";

import { asc, eq } from "drizzle-orm";
import type { DbTransaction } from "~/server/db";
import { pinTips } from "~/server/db/schema";
import { fetchPinTipsExport } from "./export";
import type { PinTip, PinTipForCard } from "./types";

/** 5 bound params per row keeps a 1,000-row chunk far under Postgres' 65,535. */
const INSERT_CHUNK = 1_000;

/**
 * Replace the stored PinTips copy with the daily export. Returns the number
 * of tips stored.
 *
 * The download happens before the write transaction opens (CORE-ARCH-011) and
 * throws on a failed or implausible export, so a bad refresh changes nothing
 * (spec 2.4). The delete and the inserts share one transaction: the copy is
 * either the old one or exactly the new export, which is how a tip removed
 * from PinTips disappears here too (spec 2.3).
 */
export async function refreshPinTips(
  tx: DbTransaction,
  fetchExport: () => Promise<PinTip[]> = fetchPinTipsExport
): Promise<number> {
  const tips = await fetchExport();
  const refreshedAt = new Date();
  await tx.transaction(async (write) => {
    await write.delete(pinTips);
    for (let i = 0; i < tips.length; i += INSERT_CHUNK) {
      await write
        .insert(pinTips)
        .values(
          tips.slice(i, i + INSERT_CHUNK).map((t) => ({ ...t, refreshedAt }))
        );
    }
  });
  return tips.length;
}

/**
 * Every stored tip for one OPDB game (group), in tip id order so the list,
 * and so the server's random pick, is stable across requests. Empty when the
 * game has none.
 */
export async function getPinTipsForGroup(
  tx: DbTransaction,
  groupId: string
): Promise<PinTipForCard[]> {
  return tx
    .select({
      tipId: pinTips.tipId,
      category: pinTips.category,
      voteTotal: pinTips.voteTotal,
      text: pinTips.text,
    })
    .from(pinTips)
    .where(eq(pinTips.opdbGroupId, groupId))
    .orderBy(asc(pinTips.tipId));
}
