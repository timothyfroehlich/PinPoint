import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { ModelWhereInputSchema } from "./ModelWhereInputSchema";
import { ModelUpdateWithoutMachinesInputSchema } from "./ModelUpdateWithoutMachinesInputSchema";
import { ModelUncheckedUpdateWithoutMachinesInputSchema } from "./ModelUncheckedUpdateWithoutMachinesInputSchema";

export const ModelUpdateToOneWithWhereWithoutMachinesInputSchema: z.ZodType<Prisma.ModelUpdateToOneWithWhereWithoutMachinesInput> =
  z
    .object({
      where: z.lazy(() => ModelWhereInputSchema).optional(),
      data: z.union([
        z.lazy(() => ModelUpdateWithoutMachinesInputSchema),
        z.lazy(() => ModelUncheckedUpdateWithoutMachinesInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.ModelUpdateToOneWithWhereWithoutMachinesInput>;

export default ModelUpdateToOneWithWhereWithoutMachinesInputSchema;
