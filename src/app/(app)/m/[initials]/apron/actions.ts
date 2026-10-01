"use server";

import { revalidatePath } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { db } from "~/server/db";
import { machineApronCards, machines, userProfiles } from "~/server/db/schema";
import { plainTextToDoc } from "~/lib/tiptap/types";
import { createClient } from "~/lib/supabase/server";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { err, ok, type Result } from "~/lib/result";
import { serverActionError } from "~/lib/observability/report-error";
import {
  saveApronCardSchema,
  type SaveApronCardInput,
} from "~/app/(app)/m/[initials]/apron/schemas";

/** The name a machine's first saved card gets when the editor creates it. */
const FIRST_CARD_NAME = "Card 1";

/** Card text as stored: a ProseMirror doc, or null when blank. */
function cardDoc(text: string): ReturnType<typeof plainTextToDoc> | null {
  return text.trim() ? plainTextToDoc(text) : null;
}

type SaveApronCardResult = Result<
  { savedAt: string },
  "VALIDATION" | "UNAUTHORIZED" | "NOT_FOUND" | "SERVER"
>;

export async function saveApronCardAction(
  input: SaveApronCardInput
): Promise<SaveApronCardResult> {
  const parsed = saveApronCardSchema.safeParse(input);
  if (!parsed.success) {
    return err("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid card");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("UNAUTHORIZED", "Sign in to edit this card.");

  try {
    const [profile, machine] = await Promise.all([
      db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, user.id),
        columns: { role: true },
      }),
      db.query.machines.findFirst({
        where: eq(machines.id, parsed.data.machineId),
        columns: { id: true, initials: true, ownerId: true },
      }),
    ]);
    if (!machine) return err("NOT_FOUND", "Machine not found.");
    if (
      !profile ||
      !checkPermission("machines.edit", getAccessLevel(profile.role), {
        userId: user.id,
        machineOwnerId: machine.ownerId ?? undefined,
      })
    ) {
      return err("UNAUTHORIZED", "You cannot edit this machine’s apron card.");
    }

    const savedAt = new Date();
    const settings = {
      size: parsed.data.size,
      useCustomDescription: parsed.data.useCustomDescription,
      description: cardDoc(parsed.data.description),
      tip: cardDoc(parsed.data.tip),
      tipEnabled: parsed.data.tipEnabled,
      designEnabled: parsed.data.designEnabled,
      artEnabled: parsed.data.artEnabled,
      updatedAt: savedAt,
    };
    // Until the card switcher exists (spec apron-cards §11.6), the editor
    // edits the machine's first saved card, creating it on first save.
    await db.transaction(async (tx) => {
      const [first] = await tx
        .select({ id: machineApronCards.id })
        .from(machineApronCards)
        .where(eq(machineApronCards.machineId, machine.id))
        .orderBy(asc(machineApronCards.createdAt), asc(machineApronCards.id))
        .limit(1);
      if (first) {
        await tx
          .update(machineApronCards)
          .set(settings)
          .where(eq(machineApronCards.id, first.id));
      } else {
        await tx.insert(machineApronCards).values({
          ...settings,
          machineId: machine.id,
          name: FIRST_CARD_NAME,
          createdAt: savedAt,
        });
      }
    });

    revalidatePath(`/m/${machine.initials}/maintenance`);
    revalidatePath(`/m/${machine.initials}/edit`);
    revalidatePath(`/m/${machine.initials}/apron/print`);
    return ok({ savedAt: savedAt.toISOString() });
  } catch (error) {
    return serverActionError(
      error,
      "SERVER",
      "Could not save the apron card. Please try again.",
      { action: "saveApronCardAction" }
    );
  }
}
