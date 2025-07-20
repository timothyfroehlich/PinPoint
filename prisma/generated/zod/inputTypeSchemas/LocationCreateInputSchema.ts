import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { OrganizationCreateNestedOneWithoutLocationsInputSchema } from "./OrganizationCreateNestedOneWithoutLocationsInputSchema";
import { MachineCreateNestedManyWithoutLocationInputSchema } from "./MachineCreateNestedManyWithoutLocationInputSchema";
import { CollectionCreateNestedManyWithoutLocationInputSchema } from "./CollectionCreateNestedManyWithoutLocationInputSchema";

export const LocationCreateInputSchema: z.ZodType<Prisma.LocationCreateInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      name: z.string(),
      street: z.string().optional().nullable(),
      city: z.string().optional().nullable(),
      state: z.string().optional().nullable(),
      zip: z.string().optional().nullable(),
      phone: z.string().optional().nullable(),
      website: z.string().optional().nullable(),
      latitude: z.number().optional().nullable(),
      longitude: z.number().optional().nullable(),
      description: z.string().optional().nullable(),
      pinballMapId: z.number().int().optional().nullable(),
      regionId: z.string().optional().nullable(),
      lastSyncAt: z.coerce.date().optional().nullable(),
      syncEnabled: z.boolean().optional(),
      organization: z.lazy(
        () => OrganizationCreateNestedOneWithoutLocationsInputSchema,
      ),
      machines: z
        .lazy(() => MachineCreateNestedManyWithoutLocationInputSchema)
        .optional(),
      collections: z
        .lazy(() => CollectionCreateNestedManyWithoutLocationInputSchema)
        .optional(),
    })
    .strict() as z.ZodType<Prisma.LocationCreateInput>;

export default LocationCreateInputSchema;
