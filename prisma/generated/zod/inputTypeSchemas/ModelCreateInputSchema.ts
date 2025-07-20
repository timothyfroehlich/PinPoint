import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MachineCreateNestedManyWithoutModelInputSchema } from "./MachineCreateNestedManyWithoutModelInputSchema";

export const ModelCreateInputSchema: z.ZodType<Prisma.ModelCreateInput> = z
  .object({
    id: z.string().cuid().optional(),
    name: z.string(),
    manufacturer: z.string().optional().nullable(),
    year: z.number().int().optional().nullable(),
    ipdbId: z.string().optional().nullable(),
    opdbId: z.string().optional().nullable(),
    machineType: z.string().optional().nullable(),
    machineDisplay: z.string().optional().nullable(),
    isActive: z.boolean().optional(),
    ipdbLink: z.string().optional().nullable(),
    opdbImgUrl: z.string().optional().nullable(),
    kineticistUrl: z.string().optional().nullable(),
    isCustom: z.boolean().optional(),
    machines: z
      .lazy(() => MachineCreateNestedManyWithoutModelInputSchema)
      .optional(),
  })
  .strict() as z.ZodType<Prisma.ModelCreateInput>;

export default ModelCreateInputSchema;
