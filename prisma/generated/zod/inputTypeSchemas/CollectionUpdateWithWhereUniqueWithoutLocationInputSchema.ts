import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { CollectionWhereUniqueInputSchema } from "./CollectionWhereUniqueInputSchema";
import { CollectionUpdateWithoutLocationInputSchema } from "./CollectionUpdateWithoutLocationInputSchema";
import { CollectionUncheckedUpdateWithoutLocationInputSchema } from "./CollectionUncheckedUpdateWithoutLocationInputSchema";

export const CollectionUpdateWithWhereUniqueWithoutLocationInputSchema: z.ZodType<Prisma.CollectionUpdateWithWhereUniqueWithoutLocationInput> =
  z
    .object({
      where: z.lazy(() => CollectionWhereUniqueInputSchema),
      data: z.union([
        z.lazy(() => CollectionUpdateWithoutLocationInputSchema),
        z.lazy(() => CollectionUncheckedUpdateWithoutLocationInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.CollectionUpdateWithWhereUniqueWithoutLocationInput>;

export default CollectionUpdateWithWhereUniqueWithoutLocationInputSchema;
