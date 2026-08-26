import { z } from "zod";

/**
 * Save the full Discord integration config in one action.
 *
 * `newToken` is optional: empty (or absent) means "no change to saved token";
 * a non-empty value means "rotate to this on save." `guildId` may be cleared
 * to turn off Discord notifications while retaining the shared bot token for
 * independently configured consumers such as region alerts. `inviteLink` is
 * optional and may be empty (we coerce empty to null on write).
 */
export const saveDiscordConfigSchema = z.object({
  newToken: z
    .string()
    .trim()
    .optional()
    .refine(
      (v) => v === undefined || v === "" || (v.length >= 50 && v.length <= 128),
      "Token looks the wrong length"
    )
    .refine(
      (v) => v === undefined || v === "" || /^[A-Za-z0-9._-]+$/.test(v),
      "Token contains invalid characters"
    ),
  guildId: z
    .string()
    .trim()
    .max(64)
    .regex(/^(?:\d+)?$/, "Server ID must be numeric or empty"),
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

export type SaveDiscordConfigInput = z.infer<typeof saveDiscordConfigSchema>;

/**
 * Validate-only Server ID input — used by the inline Validate button on the
 * server-id field. The bot token comes from the form (typed value, optional)
 * or falls back to the saved Vault token at runtime.
 */
export const validateServerIdSchema = z.object({
  serverId: z
    .string()
    .trim()
    .min(1, "Server ID is required")
    .max(64)
    .regex(/^\d+$/, "Server ID must be numeric"),
  newToken: z.string().trim().optional(),
});

export type ValidateServerIdInput = z.infer<typeof validateServerIdSchema>;
