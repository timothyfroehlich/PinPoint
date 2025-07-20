import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";
import { SortOrderInputSchema } from "./SortOrderInputSchema";
import { UserCountOrderByAggregateInputSchema } from "./UserCountOrderByAggregateInputSchema";
import { UserMaxOrderByAggregateInputSchema } from "./UserMaxOrderByAggregateInputSchema";
import { UserMinOrderByAggregateInputSchema } from "./UserMinOrderByAggregateInputSchema";

export const UserOrderByWithAggregationInputSchema: z.ZodType<Prisma.UserOrderByWithAggregationInput> =
  z
    .object({
      id: z.lazy(() => SortOrderSchema).optional(),
      name: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      email: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      emailVerified: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      image: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      createdAt: z.lazy(() => SortOrderSchema).optional(),
      updatedAt: z.lazy(() => SortOrderSchema).optional(),
      bio: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      profilePicture: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      emailNotificationsEnabled: z.lazy(() => SortOrderSchema).optional(),
      pushNotificationsEnabled: z.lazy(() => SortOrderSchema).optional(),
      notificationFrequency: z.lazy(() => SortOrderSchema).optional(),
      _count: z.lazy(() => UserCountOrderByAggregateInputSchema).optional(),
      _max: z.lazy(() => UserMaxOrderByAggregateInputSchema).optional(),
      _min: z.lazy(() => UserMinOrderByAggregateInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.UserOrderByWithAggregationInput>;

export default UserOrderByWithAggregationInputSchema;
