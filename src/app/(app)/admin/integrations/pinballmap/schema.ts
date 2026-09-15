import { z } from "zod";

const positiveSafeInteger = z
  .string()
  .trim()
  .regex(/^\d+$/)
  .transform(Number)
  .refine((value) => Number.isSafeInteger(value) && value > 0);

export const checkPinballMapLocationSchema = z.object({
  locationId: positiveSafeInteger,
});

export const commitCheckedPinballMapLocationSchema = z.object({
  checkId: z.string().uuid(),
});

export const clearPinballMapLocationSchema = z.object({
  expectedLocationId: positiveSafeInteger,
  expectedGeneration: z
    .string()
    .trim()
    .regex(/^\d+$/)
    .transform(Number)
    .refine((value) => Number.isSafeInteger(value) && value >= 0),
});

export const discordSnowflakeRegex = /^\d{17,20}$/;

export const saveRegionAlertConfigSchema = z.object({
  region: z.string().trim().min(1),
  alertChannelId: z
    .string()
    .trim()
    .refine((val) => val.length === 0 || discordSnowflakeRegex.test(val), {
      message: "Channel ID must be a valid Discord snowflake",
    })
    .nullable()
    .optional(),
});

export const sendRegionAlertTestSchema = z.object({
  channelId: z
    .string()
    .trim()
    .regex(discordSnowflakeRegex, {
      message: "Channel ID must be a valid Discord snowflake",
    })
    .optional(),
});
