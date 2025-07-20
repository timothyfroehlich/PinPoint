import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { UserWhereUniqueInputSchema } from "./UserWhereUniqueInputSchema";
import { UserCreateWithoutActivityHistoryInputSchema } from "./UserCreateWithoutActivityHistoryInputSchema";
import { UserUncheckedCreateWithoutActivityHistoryInputSchema } from "./UserUncheckedCreateWithoutActivityHistoryInputSchema";

export const UserCreateOrConnectWithoutActivityHistoryInputSchema: z.ZodType<Prisma.UserCreateOrConnectWithoutActivityHistoryInput> =
  z
    .object({
      where: z.lazy(() => UserWhereUniqueInputSchema),
      create: z.union([
        z.lazy(() => UserCreateWithoutActivityHistoryInputSchema),
        z.lazy(() => UserUncheckedCreateWithoutActivityHistoryInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.UserCreateOrConnectWithoutActivityHistoryInput>;

export default UserCreateOrConnectWithoutActivityHistoryInputSchema;
