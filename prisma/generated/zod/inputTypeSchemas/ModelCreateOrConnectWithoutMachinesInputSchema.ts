import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { ModelWhereUniqueInputSchema } from "./ModelWhereUniqueInputSchema";
import { ModelCreateWithoutMachinesInputSchema } from "./ModelCreateWithoutMachinesInputSchema";
import { ModelUncheckedCreateWithoutMachinesInputSchema } from "./ModelUncheckedCreateWithoutMachinesInputSchema";

export const ModelCreateOrConnectWithoutMachinesInputSchema: z.ZodType<Prisma.ModelCreateOrConnectWithoutMachinesInput> =
  z
    .object({
      where: z.lazy(() => ModelWhereUniqueInputSchema),
      create: z.union([
        z.lazy(() => ModelCreateWithoutMachinesInputSchema),
        z.lazy(() => ModelUncheckedCreateWithoutMachinesInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.ModelCreateOrConnectWithoutMachinesInput>;

export default ModelCreateOrConnectWithoutMachinesInputSchema;
