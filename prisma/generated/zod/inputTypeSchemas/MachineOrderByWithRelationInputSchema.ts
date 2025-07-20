import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";
import { SortOrderInputSchema } from "./SortOrderInputSchema";
import { OrganizationOrderByWithRelationInputSchema } from "./OrganizationOrderByWithRelationInputSchema";
import { LocationOrderByWithRelationInputSchema } from "./LocationOrderByWithRelationInputSchema";
import { ModelOrderByWithRelationInputSchema } from "./ModelOrderByWithRelationInputSchema";
import { UserOrderByWithRelationInputSchema } from "./UserOrderByWithRelationInputSchema";
import { IssueOrderByRelationAggregateInputSchema } from "./IssueOrderByRelationAggregateInputSchema";
import { CollectionOrderByRelationAggregateInputSchema } from "./CollectionOrderByRelationAggregateInputSchema";

export const MachineOrderByWithRelationInputSchema: z.ZodType<Prisma.MachineOrderByWithRelationInput> =
  z
    .object({
      id: z.lazy(() => SortOrderSchema).optional(),
      name: z.lazy(() => SortOrderSchema).optional(),
      organizationId: z.lazy(() => SortOrderSchema).optional(),
      locationId: z.lazy(() => SortOrderSchema).optional(),
      modelId: z.lazy(() => SortOrderSchema).optional(),
      ownerId: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      ownerNotificationsEnabled: z.lazy(() => SortOrderSchema).optional(),
      notifyOnNewIssues: z.lazy(() => SortOrderSchema).optional(),
      notifyOnStatusChanges: z.lazy(() => SortOrderSchema).optional(),
      notifyOnComments: z.lazy(() => SortOrderSchema).optional(),
      qrCodeId: z.lazy(() => SortOrderSchema).optional(),
      qrCodeUrl: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      qrCodeGeneratedAt: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      organization: z
        .lazy(() => OrganizationOrderByWithRelationInputSchema)
        .optional(),
      location: z.lazy(() => LocationOrderByWithRelationInputSchema).optional(),
      model: z.lazy(() => ModelOrderByWithRelationInputSchema).optional(),
      owner: z.lazy(() => UserOrderByWithRelationInputSchema).optional(),
      issues: z.lazy(() => IssueOrderByRelationAggregateInputSchema).optional(),
      collections: z
        .lazy(() => CollectionOrderByRelationAggregateInputSchema)
        .optional(),
    })
    .strict() as z.ZodType<Prisma.MachineOrderByWithRelationInput>;

export default MachineOrderByWithRelationInputSchema;
