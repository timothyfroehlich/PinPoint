import { z } from "zod";
import type { Prisma } from "@prisma/client";

export const IssueCountOutputTypeSelectSchema: z.ZodType<Prisma.IssueCountOutputTypeSelect> =
  z
    .object({
      comments: z.boolean().optional(),
      attachments: z.boolean().optional(),
      history: z.boolean().optional(),
      upvotes: z.boolean().optional(),
    })
    .strict();

export default IssueCountOutputTypeSelectSchema;
