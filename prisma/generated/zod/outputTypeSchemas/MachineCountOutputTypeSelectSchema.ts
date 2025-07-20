import { z } from "zod";
import type { Prisma } from "@prisma/client";

export const MachineCountOutputTypeSelectSchema: z.ZodType<Prisma.MachineCountOutputTypeSelect> =
  z
    .object({
      issues: z.boolean().optional(),
      collections: z.boolean().optional(),
    })
    .strict();

export default MachineCountOutputTypeSelectSchema;
