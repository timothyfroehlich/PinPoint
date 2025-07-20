import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { RoleScalarWhereInputSchema } from "./RoleScalarWhereInputSchema";
import { RoleUpdateManyMutationInputSchema } from "./RoleUpdateManyMutationInputSchema";
import { RoleUncheckedUpdateManyWithoutPermissionsInputSchema } from "./RoleUncheckedUpdateManyWithoutPermissionsInputSchema";

export const RoleUpdateManyWithWhereWithoutPermissionsInputSchema: z.ZodType<Prisma.RoleUpdateManyWithWhereWithoutPermissionsInput> =
  z
    .object({
      where: z.lazy(() => RoleScalarWhereInputSchema),
      data: z.union([
        z.lazy(() => RoleUpdateManyMutationInputSchema),
        z.lazy(() => RoleUncheckedUpdateManyWithoutPermissionsInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.RoleUpdateManyWithWhereWithoutPermissionsInput>;

export default RoleUpdateManyWithWhereWithoutPermissionsInputSchema;
