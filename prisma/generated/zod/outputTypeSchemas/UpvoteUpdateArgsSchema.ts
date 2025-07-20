import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { UpvoteIncludeSchema } from "../inputTypeSchemas/UpvoteIncludeSchema";
import { UpvoteUpdateInputSchema } from "../inputTypeSchemas/UpvoteUpdateInputSchema";
import { UpvoteUncheckedUpdateInputSchema } from "../inputTypeSchemas/UpvoteUncheckedUpdateInputSchema";
import { UpvoteWhereUniqueInputSchema } from "../inputTypeSchemas/UpvoteWhereUniqueInputSchema";
import { IssueArgsSchema } from "../outputTypeSchemas/IssueArgsSchema";
import { UserArgsSchema } from "../outputTypeSchemas/UserArgsSchema";
// Select schema needs to be in file to prevent circular imports
//------------------------------------------------------

export const UpvoteSelectSchema: z.ZodType<Prisma.UpvoteSelect> = z
  .object({
    id: z.boolean().optional(),
    createdAt: z.boolean().optional(),
    issueId: z.boolean().optional(),
    userId: z.boolean().optional(),
    issue: z.union([z.boolean(), z.lazy(() => IssueArgsSchema)]).optional(),
    user: z.union([z.boolean(), z.lazy(() => UserArgsSchema)]).optional(),
  })
  .strict();

export const UpvoteUpdateArgsSchema: z.ZodType<Prisma.UpvoteUpdateArgs> = z
  .object({
    select: UpvoteSelectSchema.optional(),
    include: z.lazy(() => UpvoteIncludeSchema).optional(),
    data: z.union([UpvoteUpdateInputSchema, UpvoteUncheckedUpdateInputSchema]),
    where: UpvoteWhereUniqueInputSchema,
  })
  .strict() as z.ZodType<Prisma.UpvoteUpdateArgs>;

export default UpvoteUpdateArgsSchema;
