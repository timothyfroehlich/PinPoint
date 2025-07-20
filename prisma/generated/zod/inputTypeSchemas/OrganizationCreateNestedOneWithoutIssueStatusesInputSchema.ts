import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { OrganizationCreateWithoutIssueStatusesInputSchema } from "./OrganizationCreateWithoutIssueStatusesInputSchema";
import { OrganizationUncheckedCreateWithoutIssueStatusesInputSchema } from "./OrganizationUncheckedCreateWithoutIssueStatusesInputSchema";
import { OrganizationCreateOrConnectWithoutIssueStatusesInputSchema } from "./OrganizationCreateOrConnectWithoutIssueStatusesInputSchema";
import { OrganizationWhereUniqueInputSchema } from "./OrganizationWhereUniqueInputSchema";

export const OrganizationCreateNestedOneWithoutIssueStatusesInputSchema: z.ZodType<Prisma.OrganizationCreateNestedOneWithoutIssueStatusesInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => OrganizationCreateWithoutIssueStatusesInputSchema),
          z.lazy(
            () => OrganizationUncheckedCreateWithoutIssueStatusesInputSchema,
          ),
        ])
        .optional(),
      connectOrCreate: z
        .lazy(() => OrganizationCreateOrConnectWithoutIssueStatusesInputSchema)
        .optional(),
      connect: z.lazy(() => OrganizationWhereUniqueInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.OrganizationCreateNestedOneWithoutIssueStatusesInput>;

export default OrganizationCreateNestedOneWithoutIssueStatusesInputSchema;
