import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { NotificationIncludeSchema } from "../inputTypeSchemas/NotificationIncludeSchema";
import { NotificationCreateInputSchema } from "../inputTypeSchemas/NotificationCreateInputSchema";
import { NotificationUncheckedCreateInputSchema } from "../inputTypeSchemas/NotificationUncheckedCreateInputSchema";
import { UserArgsSchema } from "../outputTypeSchemas/UserArgsSchema";
// Select schema needs to be in file to prevent circular imports
//------------------------------------------------------

export const NotificationSelectSchema: z.ZodType<Prisma.NotificationSelect> = z
  .object({
    id: z.boolean().optional(),
    message: z.boolean().optional(),
    read: z.boolean().optional(),
    createdAt: z.boolean().optional(),
    userId: z.boolean().optional(),
    type: z.boolean().optional(),
    entityType: z.boolean().optional(),
    entityId: z.boolean().optional(),
    actionUrl: z.boolean().optional(),
    user: z.union([z.boolean(), z.lazy(() => UserArgsSchema)]).optional(),
  })
  .strict();

export const NotificationCreateArgsSchema: z.ZodType<Prisma.NotificationCreateArgs> =
  z
    .object({
      select: NotificationSelectSchema.optional(),
      include: z.lazy(() => NotificationIncludeSchema).optional(),
      data: z.union([
        NotificationCreateInputSchema,
        NotificationUncheckedCreateInputSchema,
      ]),
    })
    .strict() as z.ZodType<Prisma.NotificationCreateArgs>;

export default NotificationCreateArgsSchema;
