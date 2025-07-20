import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { OrganizationUpdateWithoutCollectionTypesInputSchema } from "./OrganizationUpdateWithoutCollectionTypesInputSchema";
import { OrganizationUncheckedUpdateWithoutCollectionTypesInputSchema } from "./OrganizationUncheckedUpdateWithoutCollectionTypesInputSchema";
import { OrganizationCreateWithoutCollectionTypesInputSchema } from "./OrganizationCreateWithoutCollectionTypesInputSchema";
import { OrganizationUncheckedCreateWithoutCollectionTypesInputSchema } from "./OrganizationUncheckedCreateWithoutCollectionTypesInputSchema";
import { OrganizationWhereInputSchema } from "./OrganizationWhereInputSchema";

export const OrganizationUpsertWithoutCollectionTypesInputSchema: z.ZodType<Prisma.OrganizationUpsertWithoutCollectionTypesInput> =
  z
    .object({
      update: z.union([
        z.lazy(() => OrganizationUpdateWithoutCollectionTypesInputSchema),
        z.lazy(
          () => OrganizationUncheckedUpdateWithoutCollectionTypesInputSchema,
        ),
      ]),
      create: z.union([
        z.lazy(() => OrganizationCreateWithoutCollectionTypesInputSchema),
        z.lazy(
          () => OrganizationUncheckedCreateWithoutCollectionTypesInputSchema,
        ),
      ]),
      where: z.lazy(() => OrganizationWhereInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.OrganizationUpsertWithoutCollectionTypesInput>;

export default OrganizationUpsertWithoutCollectionTypesInputSchema;
