import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { OrganizationWhereInputSchema } from "./OrganizationWhereInputSchema";
import { OrganizationUpdateWithoutIssueStatusesInputSchema } from "./OrganizationUpdateWithoutIssueStatusesInputSchema";
import { OrganizationUncheckedUpdateWithoutIssueStatusesInputSchema } from "./OrganizationUncheckedUpdateWithoutIssueStatusesInputSchema";

export const OrganizationUpdateToOneWithWhereWithoutIssueStatusesInputSchema: z.ZodType<Prisma.OrganizationUpdateToOneWithWhereWithoutIssueStatusesInput> =
  z
    .object({
      where: z.lazy(() => OrganizationWhereInputSchema).optional(),
      data: z.union([
        z.lazy(() => OrganizationUpdateWithoutIssueStatusesInputSchema),
        z.lazy(
          () => OrganizationUncheckedUpdateWithoutIssueStatusesInputSchema,
        ),
      ]),
    })
    .strict() as z.ZodType<Prisma.OrganizationUpdateToOneWithWhereWithoutIssueStatusesInput>;

export default OrganizationUpdateToOneWithWhereWithoutIssueStatusesInputSchema;
