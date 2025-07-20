import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { IssueArgsSchema } from "../outputTypeSchemas/IssueArgsSchema"
import { UserArgsSchema } from "../outputTypeSchemas/UserArgsSchema"

export const CommentIncludeSchema: z.ZodType<Prisma.CommentInclude> = z.object({
  issue: z.union([z.boolean(),z.lazy(() => IssueArgsSchema)]).optional(),
  author: z.union([z.boolean(),z.lazy(() => UserArgsSchema)]).optional(),
  deleter: z.union([z.boolean(),z.lazy(() => UserArgsSchema)]).optional(),
}).strict()

export default CommentIncludeSchema;
