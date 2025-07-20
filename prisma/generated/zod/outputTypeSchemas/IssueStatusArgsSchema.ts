import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { IssueStatusSelectSchema } from "../inputTypeSchemas/IssueStatusSelectSchema";
import { IssueStatusIncludeSchema } from "../inputTypeSchemas/IssueStatusIncludeSchema";

export const IssueStatusArgsSchema: z.ZodType<Prisma.IssueStatusDefaultArgs> = z
  .object({
    select: z.lazy(() => IssueStatusSelectSchema).optional(),
    include: z.lazy(() => IssueStatusIncludeSchema).optional(),
  })
  .strict();

export default IssueStatusArgsSchema;
