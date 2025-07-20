import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MachineWhereInputSchema } from "./MachineWhereInputSchema";

export const MachineScalarRelationFilterSchema: z.ZodType<Prisma.MachineScalarRelationFilter> =
  z
    .object({
      is: z.lazy(() => MachineWhereInputSchema).optional(),
      isNot: z.lazy(() => MachineWhereInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.MachineScalarRelationFilter>;

export default MachineScalarRelationFilterSchema;
