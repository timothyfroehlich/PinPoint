import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";

export const UserMinOrderByAggregateInputSchema: z.ZodType<Prisma.UserMinOrderByAggregateInput> =
  z
    .object({
      id: z.lazy(() => SortOrderSchema).optional(),
      name: z.lazy(() => SortOrderSchema).optional(),
      email: z.lazy(() => SortOrderSchema).optional(),
      emailVerified: z.lazy(() => SortOrderSchema).optional(),
      image: z.lazy(() => SortOrderSchema).optional(),
      createdAt: z.lazy(() => SortOrderSchema).optional(),
      updatedAt: z.lazy(() => SortOrderSchema).optional(),
      bio: z.lazy(() => SortOrderSchema).optional(),
      profilePicture: z.lazy(() => SortOrderSchema).optional(),
      emailNotificationsEnabled: z.lazy(() => SortOrderSchema).optional(),
      pushNotificationsEnabled: z.lazy(() => SortOrderSchema).optional(),
      notificationFrequency: z.lazy(() => SortOrderSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.UserMinOrderByAggregateInput>;

export default UserMinOrderByAggregateInputSchema;
