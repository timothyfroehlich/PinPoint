import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { OrganizationCreateWithoutIssuesInputSchema } from "./OrganizationCreateWithoutIssuesInputSchema";
import { OrganizationUncheckedCreateWithoutIssuesInputSchema } from "./OrganizationUncheckedCreateWithoutIssuesInputSchema";
import { OrganizationCreateOrConnectWithoutIssuesInputSchema } from "./OrganizationCreateOrConnectWithoutIssuesInputSchema";
import { OrganizationUpsertWithoutIssuesInputSchema } from "./OrganizationUpsertWithoutIssuesInputSchema";
import { OrganizationWhereUniqueInputSchema } from "./OrganizationWhereUniqueInputSchema";
import { OrganizationUpdateToOneWithWhereWithoutIssuesInputSchema } from "./OrganizationUpdateToOneWithWhereWithoutIssuesInputSchema";
import { OrganizationUpdateWithoutIssuesInputSchema } from "./OrganizationUpdateWithoutIssuesInputSchema";
import { OrganizationUncheckedUpdateWithoutIssuesInputSchema } from "./OrganizationUncheckedUpdateWithoutIssuesInputSchema";

export const OrganizationUpdateOneRequiredWithoutIssuesNestedInputSchema: z.ZodType<Prisma.OrganizationUpdateOneRequiredWithoutIssuesNestedInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => OrganizationCreateWithoutIssuesInputSchema),
          z.lazy(() => OrganizationUncheckedCreateWithoutIssuesInputSchema),
        ])
        .optional(),
      connectOrCreate: z
        .lazy(() => OrganizationCreateOrConnectWithoutIssuesInputSchema)
        .optional(),
      upsert: z
        .lazy(() => OrganizationUpsertWithoutIssuesInputSchema)
        .optional(),
      connect: z.lazy(() => OrganizationWhereUniqueInputSchema).optional(),
      update: z
        .union([
          z.lazy(
            () => OrganizationUpdateToOneWithWhereWithoutIssuesInputSchema,
          ),
          z.lazy(() => OrganizationUpdateWithoutIssuesInputSchema),
          z.lazy(() => OrganizationUncheckedUpdateWithoutIssuesInputSchema),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.OrganizationUpdateOneRequiredWithoutIssuesNestedInput>;

export default OrganizationUpdateOneRequiredWithoutIssuesNestedInputSchema;
