import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { UserWhereInputSchema } from "./UserWhereInputSchema";
import { UserUpdateWithoutOwnedMachinesInputSchema } from "./UserUpdateWithoutOwnedMachinesInputSchema";
import { UserUncheckedUpdateWithoutOwnedMachinesInputSchema } from "./UserUncheckedUpdateWithoutOwnedMachinesInputSchema";

export const UserUpdateToOneWithWhereWithoutOwnedMachinesInputSchema: z.ZodType<Prisma.UserUpdateToOneWithWhereWithoutOwnedMachinesInput> =
  z
    .object({
      where: z.lazy(() => UserWhereInputSchema).optional(),
      data: z.union([
        z.lazy(() => UserUpdateWithoutOwnedMachinesInputSchema),
        z.lazy(() => UserUncheckedUpdateWithoutOwnedMachinesInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.UserUpdateToOneWithWhereWithoutOwnedMachinesInput>;

export default UserUpdateToOneWithWhereWithoutOwnedMachinesInputSchema;
