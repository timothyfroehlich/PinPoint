import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { UserWhereUniqueInputSchema } from "./UserWhereUniqueInputSchema";
import { UserCreateWithoutIssuesCreatedInputSchema } from "./UserCreateWithoutIssuesCreatedInputSchema";
import { UserUncheckedCreateWithoutIssuesCreatedInputSchema } from "./UserUncheckedCreateWithoutIssuesCreatedInputSchema";

export const UserCreateOrConnectWithoutIssuesCreatedInputSchema: z.ZodType<Prisma.UserCreateOrConnectWithoutIssuesCreatedInput> =
  z
    .object({
      where: z.lazy(() => UserWhereUniqueInputSchema),
      create: z.union([
        z.lazy(() => UserCreateWithoutIssuesCreatedInputSchema),
        z.lazy(() => UserUncheckedCreateWithoutIssuesCreatedInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.UserCreateOrConnectWithoutIssuesCreatedInput>;

export default UserCreateOrConnectWithoutIssuesCreatedInputSchema;
