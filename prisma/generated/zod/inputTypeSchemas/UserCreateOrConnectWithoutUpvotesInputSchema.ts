import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { UserWhereUniqueInputSchema } from "./UserWhereUniqueInputSchema";
import { UserCreateWithoutUpvotesInputSchema } from "./UserCreateWithoutUpvotesInputSchema";
import { UserUncheckedCreateWithoutUpvotesInputSchema } from "./UserUncheckedCreateWithoutUpvotesInputSchema";

export const UserCreateOrConnectWithoutUpvotesInputSchema: z.ZodType<Prisma.UserCreateOrConnectWithoutUpvotesInput> =
  z
    .object({
      where: z.lazy(() => UserWhereUniqueInputSchema),
      create: z.union([
        z.lazy(() => UserCreateWithoutUpvotesInputSchema),
        z.lazy(() => UserUncheckedCreateWithoutUpvotesInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.UserCreateOrConnectWithoutUpvotesInput>;

export default UserCreateOrConnectWithoutUpvotesInputSchema;
