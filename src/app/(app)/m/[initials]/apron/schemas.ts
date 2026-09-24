import { z } from "zod";

export const saveApronCardSchema = z.object({
  machineId: z.uuid(),
  size: z.enum(["stern", "wpc"]),
  useCustomDescription: z.boolean(),
  description: z.string().max(1500),
  tip: z.string().max(1500),
  tipEnabled: z.boolean(),
});

export type SaveApronCardInput = z.input<typeof saveApronCardSchema>;
