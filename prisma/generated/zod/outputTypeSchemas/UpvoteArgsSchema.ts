import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { UpvoteSelectSchema } from "../inputTypeSchemas/UpvoteSelectSchema";
import { UpvoteIncludeSchema } from "../inputTypeSchemas/UpvoteIncludeSchema";

export const UpvoteArgsSchema: z.ZodType<Prisma.UpvoteDefaultArgs> = z
  .object({
    select: z.lazy(() => UpvoteSelectSchema).optional(),
    include: z.lazy(() => UpvoteIncludeSchema).optional(),
  })
  .strict();

export default UpvoteArgsSchema;
