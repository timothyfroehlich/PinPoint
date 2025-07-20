import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { CollectionWhereUniqueInputSchema } from "./CollectionWhereUniqueInputSchema";
import { CollectionUpdateWithoutTypeInputSchema } from "./CollectionUpdateWithoutTypeInputSchema";
import { CollectionUncheckedUpdateWithoutTypeInputSchema } from "./CollectionUncheckedUpdateWithoutTypeInputSchema";
import { CollectionCreateWithoutTypeInputSchema } from "./CollectionCreateWithoutTypeInputSchema";
import { CollectionUncheckedCreateWithoutTypeInputSchema } from "./CollectionUncheckedCreateWithoutTypeInputSchema";

export const CollectionUpsertWithWhereUniqueWithoutTypeInputSchema: z.ZodType<Prisma.CollectionUpsertWithWhereUniqueWithoutTypeInput> =
  z
    .object({
      where: z.lazy(() => CollectionWhereUniqueInputSchema),
      update: z.union([
        z.lazy(() => CollectionUpdateWithoutTypeInputSchema),
        z.lazy(() => CollectionUncheckedUpdateWithoutTypeInputSchema),
      ]),
      create: z.union([
        z.lazy(() => CollectionCreateWithoutTypeInputSchema),
        z.lazy(() => CollectionUncheckedCreateWithoutTypeInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.CollectionUpsertWithWhereUniqueWithoutTypeInput>;

export default CollectionUpsertWithWhereUniqueWithoutTypeInputSchema;
