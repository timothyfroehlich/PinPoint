import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { OrganizationArgsSchema } from "../outputTypeSchemas/OrganizationArgsSchema";
import { IssueFindManyArgsSchema } from "../outputTypeSchemas/IssueFindManyArgsSchema";
import { IssueStatusCountOutputTypeArgsSchema } from "../outputTypeSchemas/IssueStatusCountOutputTypeArgsSchema";

export const IssueStatusIncludeSchema: z.ZodType<Prisma.IssueStatusInclude> = z
  .object({
    organization: z
      .union([z.boolean(), z.lazy(() => OrganizationArgsSchema)])
      .optional(),
    issues: z
      .union([z.boolean(), z.lazy(() => IssueFindManyArgsSchema)])
      .optional(),
    _count: z
      .union([z.boolean(), z.lazy(() => IssueStatusCountOutputTypeArgsSchema)])
      .optional(),
  })
  .strict();

export default IssueStatusIncludeSchema;
