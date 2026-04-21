import { z } from "zod";

/**
 * Update config fields — everything except the bot token itself.
 *
 * `guildId` and `inviteLink` may be empty strings (cleared). We coerce
 * empty strings to null on the server side before writing.
 */
export const updateDiscordConfigSchema = z.object({
  enabled: z.boolean(),
  guildId: z
    .string()
    .trim()
    .max(64)
    .regex(/^\d*$/, "Guild ID must be numeric")
    .optional()
    .default(""),
  inviteLink: z
    .string()
    .trim()
    .max(512)
    .refine(
      (v) =>
        v === "" ||
        /^https:\/\/discord\.gg\/.+/.test(v) ||
        /^https:\/\/discord\.com\/invite\/.+/.test(v),
      "Must be a Discord invite URL or empty"
    )
    .optional()
    .default(""),
});

export type UpdateDiscordConfigInput = z.infer<
  typeof updateDiscordConfigSchema
>;

/**
 * Rotate the bot token. Separate action because it touches Vault.
 */
export const rotateBotTokenSchema = z.object({
  // Discord bot tokens are 59-72 chars, alnum + dots/underscores/hyphens.
  // We accept a broad range because Discord has quietly changed the format
  // before. Empty string is rejected — use a different flow to clear.
  newToken: z
    .string()
    .trim()
    .min(50, "Token looks too short")
    .max(128, "Token looks too long")
    .regex(/^[A-Za-z0-9._-]+$/, "Token contains invalid characters"),
});

export type RotateBotTokenInput = z.infer<typeof rotateBotTokenSchema>;
