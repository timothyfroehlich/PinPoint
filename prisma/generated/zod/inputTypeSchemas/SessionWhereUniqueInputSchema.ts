import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SessionWhereInputSchema } from "./SessionWhereInputSchema";
import { StringFilterSchema } from "./StringFilterSchema";
import { DateTimeFilterSchema } from "./DateTimeFilterSchema";
import { UserScalarRelationFilterSchema } from "./UserScalarRelationFilterSchema";
import { UserWhereInputSchema } from "./UserWhereInputSchema";

export const SessionWhereUniqueInputSchema: z.ZodType<Prisma.SessionWhereUniqueInput> =
  z
    .union([
      z.object({
        id: z.string().cuid(),
        sessionToken: z.string(),
      }),
      z.object({
        id: z.string().cuid(),
      }),
      z.object({
        sessionToken: z.string(),
      }),
    ])
    .and(
      z
        .object({
          id: z.string().cuid().optional(),
          sessionToken: z.string().optional(),
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
          userId: z
            .union([z.lazy(() => StringFilterSchema), z.string()])
            .optional(),
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
        .strict(),
    ) as z.ZodType<Prisma.SessionWhereUniqueInput>;

export default SessionWhereUniqueInputSchema;
