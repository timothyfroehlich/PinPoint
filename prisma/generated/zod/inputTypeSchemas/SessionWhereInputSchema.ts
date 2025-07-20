import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringFilterSchema } from "./StringFilterSchema";
import { DateTimeFilterSchema } from "./DateTimeFilterSchema";
import { UserScalarRelationFilterSchema } from "./UserScalarRelationFilterSchema";
import { UserWhereInputSchema } from "./UserWhereInputSchema";

export const SessionWhereInputSchema: z.ZodType<Prisma.SessionWhereInput> = z
  .object({
    AND: z
      .union([
        z.lazy(() => SessionWhereInputSchema),
        z.lazy(() => SessionWhereInputSchema).array(),
      ])
      .optional(),
    OR: z
      .lazy(() => SessionWhereInputSchema)
      .array()
      .optional(),
    NOT: z
      .union([
        z.lazy(() => SessionWhereInputSchema),
        z.lazy(() => SessionWhereInputSchema).array(),
      ])
      .optional(),
    id: z.union([z.lazy(() => StringFilterSchema), z.string()]).optional(),
    sessionToken: z
      .union([z.lazy(() => StringFilterSchema), z.string()])
      .optional(),
    userId: z.union([z.lazy(() => StringFilterSchema), z.string()]).optional(),
    expires: z
      .union([z.lazy(() => DateTimeFilterSchema), z.coerce.date()])
      .optional(),
    user: z
      .union([
        z.lazy(() => UserScalarRelationFilterSchema),
        z.lazy(() => UserWhereInputSchema),
      ])
      .optional(),
  })
  .strict() as z.ZodType<Prisma.SessionWhereInput>;

export default SessionWhereInputSchema;
