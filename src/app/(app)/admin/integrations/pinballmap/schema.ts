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
