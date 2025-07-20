import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { OrganizationUpdateWithoutIssuesInputSchema } from "./OrganizationUpdateWithoutIssuesInputSchema";
import { OrganizationUncheckedUpdateWithoutIssuesInputSchema } from "./OrganizationUncheckedUpdateWithoutIssuesInputSchema";
import { OrganizationCreateWithoutIssuesInputSchema } from "./OrganizationCreateWithoutIssuesInputSchema";
import { OrganizationUncheckedCreateWithoutIssuesInputSchema } from "./OrganizationUncheckedCreateWithoutIssuesInputSchema";
import { OrganizationWhereInputSchema } from "./OrganizationWhereInputSchema";

export const OrganizationUpsertWithoutIssuesInputSchema: z.ZodType<Prisma.OrganizationUpsertWithoutIssuesInput> =
  z
    .object({
      update: z.union([
        z.lazy(() => OrganizationUpdateWithoutIssuesInputSchema),
        z.lazy(() => OrganizationUncheckedUpdateWithoutIssuesInputSchema),
      ]),
      create: z.union([
        z.lazy(() => OrganizationCreateWithoutIssuesInputSchema),
        z.lazy(() => OrganizationUncheckedCreateWithoutIssuesInputSchema),
      ]),
      where: z.lazy(() => OrganizationWhereInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.OrganizationUpsertWithoutIssuesInput>;

export default OrganizationUpsertWithoutIssuesInputSchema;
