import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { IssueArgsSchema } from "../outputTypeSchemas/IssueArgsSchema";
import { UserArgsSchema } from "../outputTypeSchemas/UserArgsSchema";

export const UpvoteIncludeSchema: z.ZodType<Prisma.UpvoteInclude> = z
  .object({
    issue: z.union([z.boolean(), z.lazy(() => IssueArgsSchema)]).optional(),
    user: z.union([z.boolean(), z.lazy(() => UserArgsSchema)]).optional(),
  })
  .strict();

export default UpvoteIncludeSchema;
