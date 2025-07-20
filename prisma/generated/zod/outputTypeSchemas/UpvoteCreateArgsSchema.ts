import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { UpvoteIncludeSchema } from "../inputTypeSchemas/UpvoteIncludeSchema";
import { UpvoteCreateInputSchema } from "../inputTypeSchemas/UpvoteCreateInputSchema";
import { UpvoteUncheckedCreateInputSchema } from "../inputTypeSchemas/UpvoteUncheckedCreateInputSchema";
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

export const UpvoteCreateArgsSchema: z.ZodType<Prisma.UpvoteCreateArgs> = z
  .object({
    select: UpvoteSelectSchema.optional(),
    include: z.lazy(() => UpvoteIncludeSchema).optional(),
    data: z.union([UpvoteCreateInputSchema, UpvoteUncheckedCreateInputSchema]),
  })
  .strict() as z.ZodType<Prisma.UpvoteCreateArgs>;

export default UpvoteCreateArgsSchema;
