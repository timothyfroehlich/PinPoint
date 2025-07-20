import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { UserWhereUniqueInputSchema } from "./UserWhereUniqueInputSchema";
import { UserCreateWithoutOwnedMachinesInputSchema } from "./UserCreateWithoutOwnedMachinesInputSchema";
import { UserUncheckedCreateWithoutOwnedMachinesInputSchema } from "./UserUncheckedCreateWithoutOwnedMachinesInputSchema";

export const UserCreateOrConnectWithoutOwnedMachinesInputSchema: z.ZodType<Prisma.UserCreateOrConnectWithoutOwnedMachinesInput> =
  z
    .object({
      where: z.lazy(() => UserWhereUniqueInputSchema),
      create: z.union([
        z.lazy(() => UserCreateWithoutOwnedMachinesInputSchema),
        z.lazy(() => UserUncheckedCreateWithoutOwnedMachinesInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.UserCreateOrConnectWithoutOwnedMachinesInput>;

export default UserCreateOrConnectWithoutOwnedMachinesInputSchema;
