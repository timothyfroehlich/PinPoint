import { z } from "zod";
import {
  ACTIVITY_SUMMARY_EVENT_KEYS,
  isActivitySummaryEventKey,
} from "~/lib/discord/activity-summary/events";

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

/** A Discord channel snowflake, as the region-alert channel accepts it. */
const discordChannelIdRegex = /^\d{17,20}$/;

/**
 * Activity summary settings (discord-activity-summary spec §2). The interval
 * arrives as the Select's string value; "disabled" stores NULL.
 */
export const saveActivitySummaryConfigSchema = z.object({
  channelId: z
    .string()
    .trim()
    .refine((v) => v === "" || discordChannelIdRegex.test(v), {
      message: "Channel ID must be numeric or empty",
    }),
  interval: z
    .enum(["24", "12", "6", "4", "2", "1", "disabled"])
    .transform((v) => (v === "disabled" ? null : Number(v))),
  startHour: z.number().int().min(0).max(23),
  events: z
    .array(z.string())
    .max(ACTIVITY_SUMMARY_EVENT_KEYS.length * 2)
    .refine((keys) => keys.every(isActivitySummaryEventKey), {
      message: "Unknown event type",
    }),
});

export type SaveActivitySummaryConfigInput = z.input<
  typeof saveActivitySummaryConfigSchema
>;

export const sendActivitySummaryTestSchema = z
  .string()
  .trim()
  .regex(discordChannelIdRegex, "Channel ID must be numeric");
