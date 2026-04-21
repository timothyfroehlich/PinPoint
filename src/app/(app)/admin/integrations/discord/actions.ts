"use server";

import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { discordIntegrationConfig, userProfiles } from "~/server/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { updateDiscordConfigSchema, rotateBotTokenSchema } from "./schema";
import { log } from "~/lib/logger";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { getDiscordConfig } from "~/lib/discord/config";

async function verifyIntegrationsAdmin(): Promise<{ userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true },
  });
  const accessLevel = getAccessLevel(profile?.role);
  if (!checkPermission("admin.integrations.manage", accessLevel)) {
    throw new Error(
      "Forbidden: You do not have permission to manage integrations"
    );
  }
  return { userId: user.id };
}

export async function updateDiscordConfig(formData: FormData): Promise<void> {
  const { userId } = await verifyIntegrationsAdmin();

  try {
    const raw = {
      enabled: formData.get("enabled") === "true",
      guildId: (formData.get("guildId") ?? "") as string,
      inviteLink: (formData.get("inviteLink") ?? "") as string,
    };
    const validated = updateDiscordConfigSchema.parse(raw);

    await db
      .update(discordIntegrationConfig)
      .set({
        enabled: validated.enabled,
        guildId: validated.guildId === "" ? null : validated.guildId,
        inviteLink: validated.inviteLink === "" ? null : validated.inviteLink,
        updatedAt: new Date(),
        updatedBy: userId,
      })
      .where(eq(discordIntegrationConfig.id, "singleton"));

    revalidatePath("/admin/integrations/discord");
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Unauthorized" ||
        error.message.startsWith("Forbidden"))
    ) {
      throw error;
    }
    if (error instanceof Error && error.constructor.name === "ZodError") {
      throw error;
    }
    log.error(
      {
        action: "updateDiscordConfig",
        userId,
        error: error instanceof Error ? error.message : "Unknown",
      },
      "Failed to update Discord config"
    );
    throw new Error("Failed to update Discord config", { cause: error });
  }
}

export async function rotateBotToken(formData: FormData): Promise<void> {
  const { userId } = await verifyIntegrationsAdmin();

  // DO NOT log the token value. Log only whether it was present.
  const rawToken = (formData.get("newToken") ?? "") as string;
  try {
    const { newToken } = rotateBotTokenSchema.parse({ newToken: rawToken });

    const existing = await db.query.discordIntegrationConfig.findFirst({
      where: eq(discordIntegrationConfig.id, "singleton"),
      columns: { botTokenVaultId: true },
    });

    if (existing?.botTokenVaultId) {
      // Rotate in place (preserves vault.secrets row, audit history).
      // Vault is a separate schema, so we call vault.update_secret()
      // through db.execute().
      await db.execute(
        sql`SELECT vault.update_secret(${existing.botTokenVaultId}::uuid, ${newToken}, 'discord_bot_token', 'Discord bot token (rotated)')`
      );
      await db
        .update(discordIntegrationConfig)
        .set({ updatedAt: new Date(), updatedBy: userId })
        .where(eq(discordIntegrationConfig.id, "singleton"));
    } else {
      // First-time set: create a vault secret, then link it. Wrap in a
      // transaction and gate the UPDATE on bot_token_vault_id still being
      // NULL so a racing rotation won't double-create and orphan a secret.
      await db.transaction(async (tx) => {
        const rows = (await tx.execute(
          sql`SELECT vault.create_secret(${newToken}, 'discord_bot_token', 'Discord bot token') AS id`
        )) as unknown as { id: string }[];
        const newVaultId = rows[0]?.id;
        if (!newVaultId) {
          throw new Error("Vault create_secret returned no id");
        }
        const updated = await tx
          .update(discordIntegrationConfig)
          .set({
            botTokenVaultId: newVaultId,
            updatedAt: new Date(),
            updatedBy: userId,
          })
          .where(
            and(
              eq(discordIntegrationConfig.id, "singleton"),
              isNull(discordIntegrationConfig.botTokenVaultId)
            )
          )
          .returning({ id: discordIntegrationConfig.id });
        if (updated.length === 0) {
          // Another writer won the race; abort to roll back the vault create.
          throw new Error(
            "Bot token was set by another admin while this request was in flight. Please refresh and try again."
          );
        }
      });
    }

    revalidatePath("/admin/integrations/discord");
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Unauthorized" ||
        error.message.startsWith("Forbidden"))
    ) {
      throw error;
    }
    if (error instanceof Error && error.constructor.name === "ZodError") {
      throw error;
    }
    log.error(
      {
        action: "rotateBotToken",
        userId,
        // Only log that the token was present; never the value
        hasToken: rawToken.length > 0,
        error: error instanceof Error ? error.message : "Unknown",
      },
      "Failed to rotate Discord bot token"
    );
    throw new Error("Failed to rotate Discord bot token", { cause: error });
  }
}

export type SendTestDmResult =
  | { ok: true; botUsername: string }
  | {
      ok: false;
      reason: "not_configured" | "invalid_token" | "transient";
      status?: number;
    };

export async function sendTestDm(): Promise<SendTestDmResult> {
  await verifyIntegrationsAdmin();

  const config = await getDiscordConfig();
  if (!config) {
    return { ok: false, reason: "not_configured" };
  }

  try {
    const res = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bot ${config.botToken}` },
    });
    if (res.ok) {
      const body = (await res.json()) as { username: string };
      return { ok: true, botUsername: body.username };
    }
    if (res.status === 401) {
      return { ok: false, reason: "invalid_token" };
    }
    return { ok: false, reason: "transient", status: res.status };
  } catch (error) {
    log.error(
      {
        action: "sendTestDm",
        error: error instanceof Error ? error.message : "Unknown",
      },
      "Discord test DM verification failed"
    );
    return { ok: false, reason: "transient" };
  }
}
