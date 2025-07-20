import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { IssueArgsSchema } from "../outputTypeSchemas/IssueArgsSchema";
import { UserArgsSchema } from "../outputTypeSchemas/UserArgsSchema";

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

export default UpvoteSelectSchema;
