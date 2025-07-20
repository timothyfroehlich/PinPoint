import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { LocationWhereUniqueInputSchema } from "./LocationWhereUniqueInputSchema";
import { LocationCreateWithoutCollectionsInputSchema } from "./LocationCreateWithoutCollectionsInputSchema";
import { LocationUncheckedCreateWithoutCollectionsInputSchema } from "./LocationUncheckedCreateWithoutCollectionsInputSchema";

export const LocationCreateOrConnectWithoutCollectionsInputSchema: z.ZodType<Prisma.LocationCreateOrConnectWithoutCollectionsInput> =
  z
    .object({
      where: z.lazy(() => LocationWhereUniqueInputSchema),
      create: z.union([
        z.lazy(() => LocationCreateWithoutCollectionsInputSchema),
        z.lazy(() => LocationUncheckedCreateWithoutCollectionsInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.LocationCreateOrConnectWithoutCollectionsInput>;

export default LocationCreateOrConnectWithoutCollectionsInputSchema;
