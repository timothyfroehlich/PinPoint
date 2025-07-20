import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { OrganizationWhereInputSchema } from "./OrganizationWhereInputSchema";
import { OrganizationUpdateWithoutCollectionTypesInputSchema } from "./OrganizationUpdateWithoutCollectionTypesInputSchema";
import { OrganizationUncheckedUpdateWithoutCollectionTypesInputSchema } from "./OrganizationUncheckedUpdateWithoutCollectionTypesInputSchema";

export const OrganizationUpdateToOneWithWhereWithoutCollectionTypesInputSchema: z.ZodType<Prisma.OrganizationUpdateToOneWithWhereWithoutCollectionTypesInput> =
  z
    .object({
      where: z.lazy(() => OrganizationWhereInputSchema).optional(),
      data: z.union([
        z.lazy(() => OrganizationUpdateWithoutCollectionTypesInputSchema),
        z.lazy(
          () => OrganizationUncheckedUpdateWithoutCollectionTypesInputSchema,
        ),
      ]),
    })
    .strict() as z.ZodType<Prisma.OrganizationUpdateToOneWithWhereWithoutCollectionTypesInput>;

export default OrganizationUpdateToOneWithWhereWithoutCollectionTypesInputSchema;
