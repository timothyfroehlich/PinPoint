import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";
import { SortOrderInputSchema } from "./SortOrderInputSchema";
import { OrganizationOrderByWithRelationInputSchema } from "./OrganizationOrderByWithRelationInputSchema";
import { MachineOrderByRelationAggregateInputSchema } from "./MachineOrderByRelationAggregateInputSchema";
import { CollectionOrderByRelationAggregateInputSchema } from "./CollectionOrderByRelationAggregateInputSchema";

export const LocationOrderByWithRelationInputSchema: z.ZodType<Prisma.LocationOrderByWithRelationInput> =
  z
    .object({
      id: z.lazy(() => SortOrderSchema).optional(),
      name: z.lazy(() => SortOrderSchema).optional(),
      organizationId: z.lazy(() => SortOrderSchema).optional(),
      street: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      city: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      state: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      zip: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      phone: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      website: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      latitude: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      longitude: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      description: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      pinballMapId: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      regionId: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      lastSyncAt: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      syncEnabled: z.lazy(() => SortOrderSchema).optional(),
      organization: z
        .lazy(() => OrganizationOrderByWithRelationInputSchema)
        .optional(),
      machines: z
        .lazy(() => MachineOrderByRelationAggregateInputSchema)
        .optional(),
      collections: z
        .lazy(() => CollectionOrderByRelationAggregateInputSchema)
        .optional(),
    })
    .strict() as z.ZodType<Prisma.LocationOrderByWithRelationInput>;

export default LocationOrderByWithRelationInputSchema;
