"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { machines, userProfiles } from "~/server/db/schema";
import { createClient } from "~/lib/supabase/server";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { err, ok, type Result } from "~/lib/result";
import { serverActionError } from "~/lib/observability/report-error";
import {
  saveApronCardSchema,
  type SaveApronCardInput,
} from "~/app/(app)/m/[initials]/apron/schemas";

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
    await db
      .update(machines)
      .set({
        apronSize: parsed.data.size,
        apronUseCustomDescription: parsed.data.useCustomDescription,
        apronDescription: parsed.data.description,
        apronTip: parsed.data.tip,
        apronTipEnabled: parsed.data.tipEnabled,
        apronSavedAt: savedAt,
        updatedAt: savedAt,
      })
      .where(eq(machines.id, machine.id));

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
