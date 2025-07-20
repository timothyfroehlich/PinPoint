import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { IssueArgsSchema } from "../outputTypeSchemas/IssueArgsSchema";
import { OrganizationArgsSchema } from "../outputTypeSchemas/OrganizationArgsSchema";

export const AttachmentIncludeSchema: z.ZodType<Prisma.AttachmentInclude> = z
  .object({
    issue: z.union([z.boolean(), z.lazy(() => IssueArgsSchema)]).optional(),
    organization: z
      .union([z.boolean(), z.lazy(() => OrganizationArgsSchema)])
      .optional(),
  })
  .strict();

export default AttachmentIncludeSchema;
