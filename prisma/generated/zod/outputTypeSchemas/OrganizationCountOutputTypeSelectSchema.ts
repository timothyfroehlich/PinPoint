import { z } from "zod";
import type { Prisma } from "@prisma/client";

export const OrganizationCountOutputTypeSelectSchema: z.ZodType<Prisma.OrganizationCountOutputTypeSelect> =
  z
    .object({
      memberships: z.boolean().optional(),
      locations: z.boolean().optional(),
      roles: z.boolean().optional(),
      machines: z.boolean().optional(),
      issues: z.boolean().optional(),
      priorities: z.boolean().optional(),
      issueStatuses: z.boolean().optional(),
      collectionTypes: z.boolean().optional(),
      issueHistory: z.boolean().optional(),
      attachments: z.boolean().optional(),
    })
    .strict();

export default OrganizationCountOutputTypeSelectSchema;
