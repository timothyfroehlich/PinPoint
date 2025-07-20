import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { LocationCreateWithoutCollectionsInputSchema } from "./LocationCreateWithoutCollectionsInputSchema";
import { LocationUncheckedCreateWithoutCollectionsInputSchema } from "./LocationUncheckedCreateWithoutCollectionsInputSchema";
import { LocationCreateOrConnectWithoutCollectionsInputSchema } from "./LocationCreateOrConnectWithoutCollectionsInputSchema";
import { LocationUpsertWithoutCollectionsInputSchema } from "./LocationUpsertWithoutCollectionsInputSchema";
import { LocationWhereInputSchema } from "./LocationWhereInputSchema";
import { LocationWhereUniqueInputSchema } from "./LocationWhereUniqueInputSchema";
import { LocationUpdateToOneWithWhereWithoutCollectionsInputSchema } from "./LocationUpdateToOneWithWhereWithoutCollectionsInputSchema";
import { LocationUpdateWithoutCollectionsInputSchema } from "./LocationUpdateWithoutCollectionsInputSchema";
import { LocationUncheckedUpdateWithoutCollectionsInputSchema } from "./LocationUncheckedUpdateWithoutCollectionsInputSchema";

export const LocationUpdateOneWithoutCollectionsNestedInputSchema: z.ZodType<Prisma.LocationUpdateOneWithoutCollectionsNestedInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => LocationCreateWithoutCollectionsInputSchema),
          z.lazy(() => LocationUncheckedCreateWithoutCollectionsInputSchema),
        ])
        .optional(),
      connectOrCreate: z
        .lazy(() => LocationCreateOrConnectWithoutCollectionsInputSchema)
        .optional(),
      upsert: z
        .lazy(() => LocationUpsertWithoutCollectionsInputSchema)
        .optional(),
      disconnect: z
        .union([z.boolean(), z.lazy(() => LocationWhereInputSchema)])
        .optional(),
      delete: z
        .union([z.boolean(), z.lazy(() => LocationWhereInputSchema)])
        .optional(),
      connect: z.lazy(() => LocationWhereUniqueInputSchema).optional(),
      update: z
        .union([
          z.lazy(
            () => LocationUpdateToOneWithWhereWithoutCollectionsInputSchema,
          ),
          z.lazy(() => LocationUpdateWithoutCollectionsInputSchema),
          z.lazy(() => LocationUncheckedUpdateWithoutCollectionsInputSchema),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.LocationUpdateOneWithoutCollectionsNestedInput>;

export default LocationUpdateOneWithoutCollectionsNestedInputSchema;
