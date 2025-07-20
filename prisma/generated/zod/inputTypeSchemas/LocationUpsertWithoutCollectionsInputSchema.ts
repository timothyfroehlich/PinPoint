import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { LocationUpdateWithoutCollectionsInputSchema } from "./LocationUpdateWithoutCollectionsInputSchema";
import { LocationUncheckedUpdateWithoutCollectionsInputSchema } from "./LocationUncheckedUpdateWithoutCollectionsInputSchema";
import { LocationCreateWithoutCollectionsInputSchema } from "./LocationCreateWithoutCollectionsInputSchema";
import { LocationUncheckedCreateWithoutCollectionsInputSchema } from "./LocationUncheckedCreateWithoutCollectionsInputSchema";
import { LocationWhereInputSchema } from "./LocationWhereInputSchema";

export const LocationUpsertWithoutCollectionsInputSchema: z.ZodType<Prisma.LocationUpsertWithoutCollectionsInput> =
  z
    .object({
      update: z.union([
        z.lazy(() => LocationUpdateWithoutCollectionsInputSchema),
        z.lazy(() => LocationUncheckedUpdateWithoutCollectionsInputSchema),
      ]),
      create: z.union([
        z.lazy(() => LocationCreateWithoutCollectionsInputSchema),
        z.lazy(() => LocationUncheckedCreateWithoutCollectionsInputSchema),
      ]),
      where: z.lazy(() => LocationWhereInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.LocationUpsertWithoutCollectionsInput>;

export default LocationUpsertWithoutCollectionsInputSchema;
