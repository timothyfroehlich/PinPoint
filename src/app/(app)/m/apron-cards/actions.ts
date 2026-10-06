"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "~/server/db";
import { apronCardPrintQueue, machineApronCards } from "~/server/db/schema";
import {
  createProtectedAction,
  type ProtectedActionResult,
} from "~/lib/actions";
import { ok } from "~/lib/result";
import { getQueuedApronCardIds } from "~/app/(app)/m/apron-cards/_data";

const setQueuedSchema = z.object({
  cardIds: z.array(z.string().uuid()).min(1).max(500),
  queued: z.boolean(),
});

export type SetApronCardsQueuedResult = ProtectedActionResult<{
  queuedCount: number;
}>;

const setApronCardsQueuedProtected = createProtectedAction({
  actionName: "setApronCardsQueuedAction",
  schema: setQueuedSchema,
  // §13.1: the same membership as exporting a card (§9.3).
  permission: "machines.apron.export",
  forbiddenMessage: "You cannot use the print queue.",
  serverErrorMessage: "Could not update your print queue. Please try again.",
  handler: async ({ cardIds, queued }, { user }) => {
    if (queued) {
      const existing = await db
        .select({ id: machineApronCards.id })
        .from(machineApronCards)
        .where(inArray(machineApronCards.id, cardIds));
      if (existing.length > 0) {
        await db
          .insert(apronCardPrintQueue)
          .values(
            existing.map((card) => ({ userId: user.id, cardId: card.id }))
          )
          .onConflictDoNothing();
      }
    } else {
      await db
        .delete(apronCardPrintQueue)
        .where(
          and(
            eq(apronCardPrintQueue.userId, user.id),
            inArray(apronCardPrintQueue.cardId, cardIds)
          )
        );
    }

    revalidatePath("/m");
    revalidatePath("/m/apron-cards");
    return ok({ queuedCount: (await getQueuedApronCardIds(user.id)).length });
  },
});

/**
 * Adds saved cards to, or removes them from, the signed-in member's print
 * queue (spec apron-cards §13.2, §13.6). Adding a card already queued, or one
 * since deleted, changes nothing; so does removing one not queued.
 */
export async function setApronCardsQueuedAction(
  input: z.input<typeof setQueuedSchema>
): Promise<SetApronCardsQueuedResult> {
  return await setApronCardsQueuedProtected(input);
}
