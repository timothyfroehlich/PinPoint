import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { OrganizationWhereUniqueInputSchema } from "./OrganizationWhereUniqueInputSchema";
import { OrganizationCreateWithoutIssuesInputSchema } from "./OrganizationCreateWithoutIssuesInputSchema";
import { OrganizationUncheckedCreateWithoutIssuesInputSchema } from "./OrganizationUncheckedCreateWithoutIssuesInputSchema";

export const OrganizationCreateOrConnectWithoutIssuesInputSchema: z.ZodType<Prisma.OrganizationCreateOrConnectWithoutIssuesInput> =
  z
    .object({
      where: z.lazy(() => OrganizationWhereUniqueInputSchema),
      create: z.union([
        z.lazy(() => OrganizationCreateWithoutIssuesInputSchema),
        z.lazy(() => OrganizationUncheckedCreateWithoutIssuesInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.OrganizationCreateOrConnectWithoutIssuesInput>;

export default OrganizationCreateOrConnectWithoutIssuesInputSchema;
