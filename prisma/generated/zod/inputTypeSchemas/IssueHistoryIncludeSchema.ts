import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { IssueArgsSchema } from "../outputTypeSchemas/IssueArgsSchema";
import { OrganizationArgsSchema } from "../outputTypeSchemas/OrganizationArgsSchema";
import { UserArgsSchema } from "../outputTypeSchemas/UserArgsSchema";

export const IssueHistoryIncludeSchema: z.ZodType<Prisma.IssueHistoryInclude> =
  z
    .object({
      issue: z.union([z.boolean(), z.lazy(() => IssueArgsSchema)]).optional(),
      organization: z
        .union([z.boolean(), z.lazy(() => OrganizationArgsSchema)])
        .optional(),
      actor: z.union([z.boolean(), z.lazy(() => UserArgsSchema)]).optional(),
    })
    .strict();

export default IssueHistoryIncludeSchema;
