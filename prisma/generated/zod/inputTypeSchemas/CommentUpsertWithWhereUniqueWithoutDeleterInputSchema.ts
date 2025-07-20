import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { CommentWhereUniqueInputSchema } from "./CommentWhereUniqueInputSchema";
import { CommentUpdateWithoutDeleterInputSchema } from "./CommentUpdateWithoutDeleterInputSchema";
import { CommentUncheckedUpdateWithoutDeleterInputSchema } from "./CommentUncheckedUpdateWithoutDeleterInputSchema";
import { CommentCreateWithoutDeleterInputSchema } from "./CommentCreateWithoutDeleterInputSchema";
import { CommentUncheckedCreateWithoutDeleterInputSchema } from "./CommentUncheckedCreateWithoutDeleterInputSchema";

export const CommentUpsertWithWhereUniqueWithoutDeleterInputSchema: z.ZodType<Prisma.CommentUpsertWithWhereUniqueWithoutDeleterInput> =
  z
    .object({
      where: z.lazy(() => CommentWhereUniqueInputSchema),
      update: z.union([
        z.lazy(() => CommentUpdateWithoutDeleterInputSchema),
        z.lazy(() => CommentUncheckedUpdateWithoutDeleterInputSchema),
      ]),
      create: z.union([
        z.lazy(() => CommentCreateWithoutDeleterInputSchema),
        z.lazy(() => CommentUncheckedCreateWithoutDeleterInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.CommentUpsertWithWhereUniqueWithoutDeleterInput>;

export default CommentUpsertWithWhereUniqueWithoutDeleterInputSchema;
