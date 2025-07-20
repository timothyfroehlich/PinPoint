import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { SessionIncludeSchema } from "../inputTypeSchemas/SessionIncludeSchema";
import { SessionWhereUniqueInputSchema } from "../inputTypeSchemas/SessionWhereUniqueInputSchema";
import { UserArgsSchema } from "../outputTypeSchemas/UserArgsSchema";
// Select schema needs to be in file to prevent circular imports
//------------------------------------------------------

export const SessionSelectSchema: z.ZodType<Prisma.SessionSelect> = z
  .object({
    id: z.boolean().optional(),
    sessionToken: z.boolean().optional(),
    userId: z.boolean().optional(),
    expires: z.boolean().optional(),
    user: z.union([z.boolean(), z.lazy(() => UserArgsSchema)]).optional(),
  })
  .strict();

export const SessionFindUniqueOrThrowArgsSchema: z.ZodType<Prisma.SessionFindUniqueOrThrowArgs> =
  z
    .object({
      select: SessionSelectSchema.optional(),
      include: z.lazy(() => SessionIncludeSchema).optional(),
      where: SessionWhereUniqueInputSchema,
    })
    .strict() as z.ZodType<Prisma.SessionFindUniqueOrThrowArgs>;

export default SessionFindUniqueOrThrowArgsSchema;
