import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { LocationWhereUniqueInputSchema } from "./LocationWhereUniqueInputSchema";
import { LocationUpdateWithoutOrganizationInputSchema } from "./LocationUpdateWithoutOrganizationInputSchema";
import { LocationUncheckedUpdateWithoutOrganizationInputSchema } from "./LocationUncheckedUpdateWithoutOrganizationInputSchema";

export const LocationUpdateWithWhereUniqueWithoutOrganizationInputSchema: z.ZodType<Prisma.LocationUpdateWithWhereUniqueWithoutOrganizationInput> =
  z
    .object({
      where: z.lazy(() => LocationWhereUniqueInputSchema),
      data: z.union([
        z.lazy(() => LocationUpdateWithoutOrganizationInputSchema),
        z.lazy(() => LocationUncheckedUpdateWithoutOrganizationInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.LocationUpdateWithWhereUniqueWithoutOrganizationInput>;

export default LocationUpdateWithWhereUniqueWithoutOrganizationInputSchema;
