import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueCreateManyOrganizationInputSchema } from "./IssueCreateManyOrganizationInputSchema";

export const IssueCreateManyOrganizationInputEnvelopeSchema: z.ZodType<Prisma.IssueCreateManyOrganizationInputEnvelope> =
  z
    .object({
      data: z.union([
        z.lazy(() => IssueCreateManyOrganizationInputSchema),
        z.lazy(() => IssueCreateManyOrganizationInputSchema).array(),
      ]),
      skipDuplicates: z.boolean().optional(),
    })
    .strict() as z.ZodType<Prisma.IssueCreateManyOrganizationInputEnvelope>;

export default IssueCreateManyOrganizationInputEnvelopeSchema;
