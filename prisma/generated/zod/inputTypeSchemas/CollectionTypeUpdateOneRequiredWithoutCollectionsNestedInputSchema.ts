import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { CollectionTypeCreateWithoutCollectionsInputSchema } from "./CollectionTypeCreateWithoutCollectionsInputSchema";
import { CollectionTypeUncheckedCreateWithoutCollectionsInputSchema } from "./CollectionTypeUncheckedCreateWithoutCollectionsInputSchema";
import { CollectionTypeCreateOrConnectWithoutCollectionsInputSchema } from "./CollectionTypeCreateOrConnectWithoutCollectionsInputSchema";
import { CollectionTypeUpsertWithoutCollectionsInputSchema } from "./CollectionTypeUpsertWithoutCollectionsInputSchema";
import { CollectionTypeWhereUniqueInputSchema } from "./CollectionTypeWhereUniqueInputSchema";
import { CollectionTypeUpdateToOneWithWhereWithoutCollectionsInputSchema } from "./CollectionTypeUpdateToOneWithWhereWithoutCollectionsInputSchema";
import { CollectionTypeUpdateWithoutCollectionsInputSchema } from "./CollectionTypeUpdateWithoutCollectionsInputSchema";
import { CollectionTypeUncheckedUpdateWithoutCollectionsInputSchema } from "./CollectionTypeUncheckedUpdateWithoutCollectionsInputSchema";

export const CollectionTypeUpdateOneRequiredWithoutCollectionsNestedInputSchema: z.ZodType<Prisma.CollectionTypeUpdateOneRequiredWithoutCollectionsNestedInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => CollectionTypeCreateWithoutCollectionsInputSchema),
          z.lazy(
            () => CollectionTypeUncheckedCreateWithoutCollectionsInputSchema,
          ),
        ])
        .optional(),
      connectOrCreate: z
        .lazy(() => CollectionTypeCreateOrConnectWithoutCollectionsInputSchema)
        .optional(),
      upsert: z
        .lazy(() => CollectionTypeUpsertWithoutCollectionsInputSchema)
        .optional(),
      connect: z.lazy(() => CollectionTypeWhereUniqueInputSchema).optional(),
      update: z
        .union([
          z.lazy(
            () =>
              CollectionTypeUpdateToOneWithWhereWithoutCollectionsInputSchema,
          ),
          z.lazy(() => CollectionTypeUpdateWithoutCollectionsInputSchema),
          z.lazy(
            () => CollectionTypeUncheckedUpdateWithoutCollectionsInputSchema,
          ),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.CollectionTypeUpdateOneRequiredWithoutCollectionsNestedInput>;

export default CollectionTypeUpdateOneRequiredWithoutCollectionsNestedInputSchema;
