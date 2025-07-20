import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueCreateNestedOneWithoutCommentsInputSchema } from "./IssueCreateNestedOneWithoutCommentsInputSchema";
import { UserCreateNestedOneWithoutCommentsInputSchema } from "./UserCreateNestedOneWithoutCommentsInputSchema";

export const CommentCreateWithoutDeleterInputSchema: z.ZodType<Prisma.CommentCreateWithoutDeleterInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      content: z.string(),
      createdAt: z.coerce.date().optional(),
      updatedAt: z.coerce.date().optional(),
      deletedAt: z.coerce.date().optional().nullable(),
      issue: z.lazy(() => IssueCreateNestedOneWithoutCommentsInputSchema),
      author: z.lazy(() => UserCreateNestedOneWithoutCommentsInputSchema),
    })
    .strict() as z.ZodType<Prisma.CommentCreateWithoutDeleterInput>;

export default CommentCreateWithoutDeleterInputSchema;
