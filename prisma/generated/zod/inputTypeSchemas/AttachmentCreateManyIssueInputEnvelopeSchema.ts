import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { AttachmentCreateManyIssueInputSchema } from "./AttachmentCreateManyIssueInputSchema";

export const AttachmentCreateManyIssueInputEnvelopeSchema: z.ZodType<Prisma.AttachmentCreateManyIssueInputEnvelope> =
  z
    .object({
      data: z.union([
        z.lazy(() => AttachmentCreateManyIssueInputSchema),
        z.lazy(() => AttachmentCreateManyIssueInputSchema).array(),
      ]),
      skipDuplicates: z.boolean().optional(),
    })
    .strict() as z.ZodType<Prisma.AttachmentCreateManyIssueInputEnvelope>;

export default AttachmentCreateManyIssueInputEnvelopeSchema;
