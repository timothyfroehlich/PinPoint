import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { LocationCreateManyOrganizationInputSchema } from "./LocationCreateManyOrganizationInputSchema";

export const LocationCreateManyOrganizationInputEnvelopeSchema: z.ZodType<Prisma.LocationCreateManyOrganizationInputEnvelope> =
  z
    .object({
      data: z.union([
        z.lazy(() => LocationCreateManyOrganizationInputSchema),
        z.lazy(() => LocationCreateManyOrganizationInputSchema).array(),
      ]),
      skipDuplicates: z.boolean().optional(),
    })
    .strict() as z.ZodType<Prisma.LocationCreateManyOrganizationInputEnvelope>;

export default LocationCreateManyOrganizationInputEnvelopeSchema;
