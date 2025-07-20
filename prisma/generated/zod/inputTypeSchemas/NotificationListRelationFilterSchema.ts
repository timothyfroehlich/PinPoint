import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { NotificationWhereInputSchema } from "./NotificationWhereInputSchema";

export const NotificationListRelationFilterSchema: z.ZodType<Prisma.NotificationListRelationFilter> =
  z
    .object({
      every: z.lazy(() => NotificationWhereInputSchema).optional(),
      some: z.lazy(() => NotificationWhereInputSchema).optional(),
      none: z.lazy(() => NotificationWhereInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.NotificationListRelationFilter>;

export default NotificationListRelationFilterSchema;
