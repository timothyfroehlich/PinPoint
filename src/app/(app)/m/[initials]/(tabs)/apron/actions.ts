"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "~/server/db";
import { machineApronCards, machines, userProfiles } from "~/server/db/schema";
import { createClient } from "~/lib/supabase/server";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { err, ok, type Result } from "~/lib/result";
import { serverActionError } from "~/lib/observability/report-error";
import { isPgErrorCode } from "~/lib/db/postgres-errors";
import { cardTextDoc } from "~/lib/machines/apron-card-text";
import type { SavedApronCard } from "~/lib/machines/apron-card";
import { getMachineApronCards } from "~/app/(app)/m/[initials]/_data";
import {
  saveApronCardsSchema,
  type SaveApronCardsInput,
} from "~/app/(app)/m/[initials]/(tabs)/apron/schemas";

type SaveApronCardsResult = Result<
  { cards: SavedApronCard[] },
  "VALIDATION" | "UNAUTHORIZED" | "NOT_FOUND" | "CONFLICT" | "SERVER"
>;

const CONFLICT_MESSAGE =
  "These cards were changed by someone else. Reload the page and try again.";

/**
 * Saves the Apron card tab (spec apron-cards §11.6): adds, updates, renames,
 * and deletes the machine's saved cards in one transaction, so a save applies
 * every change or none. Returns the cards as stored, in order.
 */
export async function saveApronCardsAction(
  input: SaveApronCardsInput
): Promise<SaveApronCardsResult> {
  const parsed = saveApronCardsSchema.safeParse(input);
  if (!parsed.success) {
    return err("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid card");
  }
  const { machineId, cards, deletedIds } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("UNAUTHORIZED", "Sign in to edit apron cards.");

  try {
    const [profile, machine] = await Promise.all([
      db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, user.id),
        columns: { role: true },
      }),
      db.query.machines.findFirst({
        where: eq(machines.id, machineId),
        columns: { id: true, initials: true, ownerId: true },
      }),
    ]);
    if (!machine) return err("NOT_FOUND", "Machine not found.");
    // §3.6, §11.7: the machine-management capability.
    if (
      !profile ||
      !checkPermission("machines.edit", getAccessLevel(profile.role), {
        userId: user.id,
        machineOwnerId: machine.ownerId ?? undefined,
      })
    ) {
      return err("UNAUTHORIZED", "You cannot edit this machine’s apron cards.");
    }

    const savedAt = new Date();
    const conflict = await db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: machineApronCards.id, name: machineApronCards.name })
        .from(machineApronCards)
        .where(eq(machineApronCards.machineId, machine.id));
      const existingNames = new Map(existing.map((c) => [c.id, c.name]));

      // A card someone else deleted since this page loaded cannot be updated.
      const updates = cards.filter((card) => card.id !== undefined);
      if (updates.some((card) => card.id && !existingNames.has(card.id))) {
        return true;
      }

      const deleting = deletedIds.filter((id) => existingNames.has(id));
      if (deleting.length > 0) {
        await tx
          .delete(machineApronCards)
          .where(
            and(
              eq(machineApronCards.machineId, machine.id),
              inArray(machineApronCards.id, deleting)
            )
          );
      }

      // Names are unique per machine and the index is not deferrable, so a
      // swap (A→B, B→A) or a new card taking a renamed card's old name would
      // collide mid-save. Renamed cards first move to a name no person types.
      const renamed = updates.filter(
        (card) => card.id && existingNames.get(card.id) !== card.name
      );
      for (const card of renamed) {
        if (!card.id) continue;
        await tx
          .update(machineApronCards)
          .set({ name: `\u0001${card.id}` })
          .where(eq(machineApronCards.id, card.id));
      }

      for (const [index, card] of cards.entries()) {
        const settings = {
          name: card.name,
          size: card.size,
          useCustomDescription: card.useCustomDescription,
          description: cardTextDoc(card.description),
          tip: cardTextDoc(card.tip),
          tipEnabled: card.tipEnabled,
          designEnabled: card.designEnabled,
          artEnabled: card.artEnabled,
          updatedAt: savedAt,
        };
        if (card.id) {
          await tx
            .update(machineApronCards)
            .set(settings)
            .where(
              and(
                eq(machineApronCards.id, card.id),
                eq(machineApronCards.machineId, machine.id)
              )
            );
        } else {
          // Cards list in the order they were created (§1); a millisecond per
          // position keeps cards added in one save in the order shown.
          await tx.insert(machineApronCards).values({
            ...settings,
            machineId: machine.id,
            createdAt: new Date(savedAt.getTime() + index),
          });
        }
      }
      return false;
    });
    if (conflict) return err("CONFLICT", CONFLICT_MESSAGE);

    revalidatePath(`/m/${machine.initials}/apron`);
    revalidatePath(`/m/${machine.initials}/apron/print`);
    return ok({ cards: await getMachineApronCards(machine.id) });
  } catch (error) {
    // Another editor added a card with one of these names since this page
    // loaded (§11.2).
    if (isPgErrorCode(error, "23505")) {
      return err("CONFLICT", CONFLICT_MESSAGE);
    }
    return serverActionError(
      error,
      "SERVER",
      "Could not save the apron cards. Please try again.",
      { action: "saveApronCardsAction" }
    );
  }
}
