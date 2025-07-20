import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { LocationWhereUniqueInputSchema } from "./LocationWhereUniqueInputSchema";
import { LocationCreateWithoutOrganizationInputSchema } from "./LocationCreateWithoutOrganizationInputSchema";
import { LocationUncheckedCreateWithoutOrganizationInputSchema } from "./LocationUncheckedCreateWithoutOrganizationInputSchema";

export const LocationCreateOrConnectWithoutOrganizationInputSchema: z.ZodType<Prisma.LocationCreateOrConnectWithoutOrganizationInput> =
  z
    .object({
      where: z.lazy(() => LocationWhereUniqueInputSchema),
      create: z.union([
        z.lazy(() => LocationCreateWithoutOrganizationInputSchema),
        z.lazy(() => LocationUncheckedCreateWithoutOrganizationInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.LocationCreateOrConnectWithoutOrganizationInput>;

export default LocationCreateOrConnectWithoutOrganizationInputSchema;
