import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { CollectionSelectSchema } from "../inputTypeSchemas/CollectionSelectSchema";
import { CollectionIncludeSchema } from "../inputTypeSchemas/CollectionIncludeSchema";

export const CollectionArgsSchema: z.ZodType<Prisma.CollectionDefaultArgs> = z
  .object({
    select: z.lazy(() => CollectionSelectSchema).optional(),
    include: z.lazy(() => CollectionIncludeSchema).optional(),
  })
  .strict();

export default CollectionArgsSchema;
