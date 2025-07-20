import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { MachineFindManyArgsSchema } from "../outputTypeSchemas/MachineFindManyArgsSchema";
import { ModelCountOutputTypeArgsSchema } from "../outputTypeSchemas/ModelCountOutputTypeArgsSchema";

export const ModelSelectSchema: z.ZodType<Prisma.ModelSelect> = z
  .object({
    id: z.boolean().optional(),
    name: z.boolean().optional(),
    manufacturer: z.boolean().optional(),
    year: z.boolean().optional(),
    ipdbId: z.boolean().optional(),
    opdbId: z.boolean().optional(),
    machineType: z.boolean().optional(),
    machineDisplay: z.boolean().optional(),
    isActive: z.boolean().optional(),
    ipdbLink: z.boolean().optional(),
    opdbImgUrl: z.boolean().optional(),
    kineticistUrl: z.boolean().optional(),
    isCustom: z.boolean().optional(),
    machines: z
      .union([z.boolean(), z.lazy(() => MachineFindManyArgsSchema)])
      .optional(),
    _count: z
      .union([z.boolean(), z.lazy(() => ModelCountOutputTypeArgsSchema)])
      .optional(),
  })
  .strict();

export default ModelSelectSchema;
