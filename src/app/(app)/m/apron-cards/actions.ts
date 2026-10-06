"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "~/server/db";
import {
  apronCardPrintQueue,
  machineApronCards,
  userProfiles,
} from "~/server/db/schema";
import { createClient } from "~/lib/supabase/server";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { err, ok, type Result } from "~/lib/result";
import { serverActionError } from "~/lib/observability/report-error";
import { getQueuedApronCardIds } from "~/app/(app)/m/apron-cards/_data";

const setQueuedSchema = z.object({
  cardIds: z.array(z.string().uuid()).min(1).max(500),
  queued: z.boolean(),
});

type SetQueuedResult = Result<
  { queuedCount: number },
  "VALIDATION" | "UNAUTHORIZED" | "SERVER"
>;

/**
 * Adds saved cards to, or removes them from, the signed-in member's print
 * queue (spec apron-cards §13.2, §13.6). Adding a card already queued, or one
 * since deleted, changes nothing; so does removing one not queued.
 */
export async function setApronCardsQueuedAction(
  input: z.input<typeof setQueuedSchema>
): Promise<SetQueuedResult> {
  const parsed = setQueuedSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION", "Invalid cards");
  const { cardIds, queued } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("UNAUTHORIZED", "Sign in to use the print queue.");

  try {
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, user.id),
      columns: { role: true },
    });
    // §13.1: the same membership as exporting a card (§9.3).
    if (
      !profile ||
      !checkPermission("machines.apron.export", getAccessLevel(profile.role))
    ) {
      return err("UNAUTHORIZED", "You cannot use the print queue.");
    }

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
  } catch (error) {
    return serverActionError(
      error,
      "SERVER",
      "Could not update your print queue. Please try again.",
      { action: "setApronCardsQueuedAction" }
    );
  }
}
