import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringWithAggregatesFilterSchema } from "./StringWithAggregatesFilterSchema";

export const MembershipScalarWhereWithAggregatesInputSchema: z.ZodType<Prisma.MembershipScalarWhereWithAggregatesInput> =
  z
    .object({
      AND: z
        .union([
          z.lazy(() => MembershipScalarWhereWithAggregatesInputSchema),
          z.lazy(() => MembershipScalarWhereWithAggregatesInputSchema).array(),
        ])
        .optional(),
      OR: z
        .lazy(() => MembershipScalarWhereWithAggregatesInputSchema)
        .array()
        .optional(),
      NOT: z
        .union([
          z.lazy(() => MembershipScalarWhereWithAggregatesInputSchema),
          z.lazy(() => MembershipScalarWhereWithAggregatesInputSchema).array(),
        ])
        .optional(),
      id: z
        .union([z.lazy(() => StringWithAggregatesFilterSchema), z.string()])
        .optional(),
      userId: z
        .union([z.lazy(() => StringWithAggregatesFilterSchema), z.string()])
        .optional(),
      organizationId: z
        .union([z.lazy(() => StringWithAggregatesFilterSchema), z.string()])
        .optional(),
      roleId: z
        .union([z.lazy(() => StringWithAggregatesFilterSchema), z.string()])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.MembershipScalarWhereWithAggregatesInput>;

export default MembershipScalarWhereWithAggregatesInputSchema;
