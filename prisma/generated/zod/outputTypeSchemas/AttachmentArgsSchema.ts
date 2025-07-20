import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { AttachmentSelectSchema } from "../inputTypeSchemas/AttachmentSelectSchema";
import { AttachmentIncludeSchema } from "../inputTypeSchemas/AttachmentIncludeSchema";

export const AttachmentArgsSchema: z.ZodType<Prisma.AttachmentDefaultArgs> = z
  .object({
    select: z.lazy(() => AttachmentSelectSchema).optional(),
    include: z.lazy(() => AttachmentIncludeSchema).optional(),
  })
  .strict();

export default AttachmentArgsSchema;
