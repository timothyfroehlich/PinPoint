import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { OrganizationCreateWithoutCollectionTypesInputSchema } from "./OrganizationCreateWithoutCollectionTypesInputSchema";
import { OrganizationUncheckedCreateWithoutCollectionTypesInputSchema } from "./OrganizationUncheckedCreateWithoutCollectionTypesInputSchema";
import { OrganizationCreateOrConnectWithoutCollectionTypesInputSchema } from "./OrganizationCreateOrConnectWithoutCollectionTypesInputSchema";
import { OrganizationWhereUniqueInputSchema } from "./OrganizationWhereUniqueInputSchema";

export const OrganizationCreateNestedOneWithoutCollectionTypesInputSchema: z.ZodType<Prisma.OrganizationCreateNestedOneWithoutCollectionTypesInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => OrganizationCreateWithoutCollectionTypesInputSchema),
          z.lazy(
            () => OrganizationUncheckedCreateWithoutCollectionTypesInputSchema,
          ),
        ])
        .optional(),
      connectOrCreate: z
        .lazy(
          () => OrganizationCreateOrConnectWithoutCollectionTypesInputSchema,
        )
        .optional(),
      connect: z.lazy(() => OrganizationWhereUniqueInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.OrganizationCreateNestedOneWithoutCollectionTypesInput>;

export default OrganizationCreateNestedOneWithoutCollectionTypesInputSchema;
