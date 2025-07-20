import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { CollectionWhereUniqueInputSchema } from "./CollectionWhereUniqueInputSchema";
import { CollectionUpdateWithoutMachinesInputSchema } from "./CollectionUpdateWithoutMachinesInputSchema";
import { CollectionUncheckedUpdateWithoutMachinesInputSchema } from "./CollectionUncheckedUpdateWithoutMachinesInputSchema";

export const CollectionUpdateWithWhereUniqueWithoutMachinesInputSchema: z.ZodType<Prisma.CollectionUpdateWithWhereUniqueWithoutMachinesInput> =
  z
    .object({
      where: z.lazy(() => CollectionWhereUniqueInputSchema),
      data: z.union([
        z.lazy(() => CollectionUpdateWithoutMachinesInputSchema),
        z.lazy(() => CollectionUncheckedUpdateWithoutMachinesInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.CollectionUpdateWithWhereUniqueWithoutMachinesInput>;

export default CollectionUpdateWithWhereUniqueWithoutMachinesInputSchema;
