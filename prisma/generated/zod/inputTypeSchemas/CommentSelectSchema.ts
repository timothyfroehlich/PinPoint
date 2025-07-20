import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { IssueArgsSchema } from "../outputTypeSchemas/IssueArgsSchema";
import { UserArgsSchema } from "../outputTypeSchemas/UserArgsSchema";

export const CommentSelectSchema: z.ZodType<Prisma.CommentSelect> = z
  .object({
    id: z.boolean().optional(),
    content: z.boolean().optional(),
    createdAt: z.boolean().optional(),
    updatedAt: z.boolean().optional(),
    deletedAt: z.boolean().optional(),
    deletedBy: z.boolean().optional(),
    issueId: z.boolean().optional(),
    authorId: z.boolean().optional(),
    issue: z.union([z.boolean(), z.lazy(() => IssueArgsSchema)]).optional(),
    author: z.union([z.boolean(), z.lazy(() => UserArgsSchema)]).optional(),
    deleter: z.union([z.boolean(), z.lazy(() => UserArgsSchema)]).optional(),
  })
  .strict();

export default CommentSelectSchema;
