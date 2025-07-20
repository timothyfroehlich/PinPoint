import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { MachineCreateManyInputSchema } from "../inputTypeSchemas/MachineCreateManyInputSchema";

export const MachineCreateManyArgsSchema: z.ZodType<Prisma.MachineCreateManyArgs> =
  z
    .object({
      data: z.union([
        MachineCreateManyInputSchema,
        MachineCreateManyInputSchema.array(),
      ]),
      skipDuplicates: z.boolean().optional(),
    })
    .strict() as z.ZodType<Prisma.MachineCreateManyArgs>;

export default MachineCreateManyArgsSchema;
