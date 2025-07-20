import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { OrganizationWhereUniqueInputSchema } from "./OrganizationWhereUniqueInputSchema";
import { OrganizationCreateWithoutCollectionTypesInputSchema } from "./OrganizationCreateWithoutCollectionTypesInputSchema";
import { OrganizationUncheckedCreateWithoutCollectionTypesInputSchema } from "./OrganizationUncheckedCreateWithoutCollectionTypesInputSchema";

export const OrganizationCreateOrConnectWithoutCollectionTypesInputSchema: z.ZodType<Prisma.OrganizationCreateOrConnectWithoutCollectionTypesInput> =
  z
    .object({
      where: z.lazy(() => OrganizationWhereUniqueInputSchema),
      create: z.union([
        z.lazy(() => OrganizationCreateWithoutCollectionTypesInputSchema),
        z.lazy(
          () => OrganizationUncheckedCreateWithoutCollectionTypesInputSchema,
        ),
      ]),
    })
    .strict() as z.ZodType<Prisma.OrganizationCreateOrConnectWithoutCollectionTypesInput>;

export default OrganizationCreateOrConnectWithoutCollectionTypesInputSchema;
