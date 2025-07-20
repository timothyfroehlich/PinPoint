import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MachineWhereInputSchema } from "./MachineWhereInputSchema";

export const MachineListRelationFilterSchema: z.ZodType<Prisma.MachineListRelationFilter> =
  z
    .object({
      every: z.lazy(() => MachineWhereInputSchema).optional(),
      some: z.lazy(() => MachineWhereInputSchema).optional(),
      none: z.lazy(() => MachineWhereInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.MachineListRelationFilter>;

export default MachineListRelationFilterSchema;
