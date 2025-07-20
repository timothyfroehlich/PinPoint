import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueCreateWithoutUpvotesInputSchema } from "./IssueCreateWithoutUpvotesInputSchema";
import { IssueUncheckedCreateWithoutUpvotesInputSchema } from "./IssueUncheckedCreateWithoutUpvotesInputSchema";
import { IssueCreateOrConnectWithoutUpvotesInputSchema } from "./IssueCreateOrConnectWithoutUpvotesInputSchema";
import { IssueUpsertWithoutUpvotesInputSchema } from "./IssueUpsertWithoutUpvotesInputSchema";
import { IssueWhereUniqueInputSchema } from "./IssueWhereUniqueInputSchema";
import { IssueUpdateToOneWithWhereWithoutUpvotesInputSchema } from "./IssueUpdateToOneWithWhereWithoutUpvotesInputSchema";
import { IssueUpdateWithoutUpvotesInputSchema } from "./IssueUpdateWithoutUpvotesInputSchema";
import { IssueUncheckedUpdateWithoutUpvotesInputSchema } from "./IssueUncheckedUpdateWithoutUpvotesInputSchema";

export const IssueUpdateOneRequiredWithoutUpvotesNestedInputSchema: z.ZodType<Prisma.IssueUpdateOneRequiredWithoutUpvotesNestedInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => IssueCreateWithoutUpvotesInputSchema),
          z.lazy(() => IssueUncheckedCreateWithoutUpvotesInputSchema),
        ])
        .optional(),
      connectOrCreate: z
        .lazy(() => IssueCreateOrConnectWithoutUpvotesInputSchema)
        .optional(),
      upsert: z.lazy(() => IssueUpsertWithoutUpvotesInputSchema).optional(),
      connect: z.lazy(() => IssueWhereUniqueInputSchema).optional(),
      update: z
        .union([
          z.lazy(() => IssueUpdateToOneWithWhereWithoutUpvotesInputSchema),
          z.lazy(() => IssueUpdateWithoutUpvotesInputSchema),
          z.lazy(() => IssueUncheckedUpdateWithoutUpvotesInputSchema),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.IssueUpdateOneRequiredWithoutUpvotesNestedInput>;

export default IssueUpdateOneRequiredWithoutUpvotesNestedInputSchema;
