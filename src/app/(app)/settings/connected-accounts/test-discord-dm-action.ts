"use server";

import { eq } from "drizzle-orm";
import { sendDm } from "~/lib/discord/client";
import { getDiscordConfig } from "~/lib/discord/config";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";

export type TestDmResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "not_authenticated"
        | "not_linked"
        | "not_configured"
        | "blocked"
        | "rate_limited"
        | "transient";
    };

export async function testDiscordDmAction(): Promise<TestDmResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "not_authenticated" };

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { id: true, discordUserId: true },
  });
  if (!profile?.discordUserId) return { ok: false, reason: "not_linked" };

  const config = await getDiscordConfig();
  if (!config) return { ok: false, reason: "not_configured" };

  const result = await sendDm({
    botToken: config.botToken,
    discordUserId: profile.discordUserId,
    content:
      "Test DM from PinPoint — your Discord notifications are working! Manage them in Settings → Notifications.",
  });

  if (result.ok) return { ok: true };
  if (result.reason === "not_configured") {
    return { ok: false, reason: "not_configured" };
  }
  return { ok: false, reason: result.reason };
}
