import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { UpvoteCreateWithoutIssueInputSchema } from "./UpvoteCreateWithoutIssueInputSchema";
import { UpvoteUncheckedCreateWithoutIssueInputSchema } from "./UpvoteUncheckedCreateWithoutIssueInputSchema";
import { UpvoteCreateOrConnectWithoutIssueInputSchema } from "./UpvoteCreateOrConnectWithoutIssueInputSchema";
import { UpvoteCreateManyIssueInputEnvelopeSchema } from "./UpvoteCreateManyIssueInputEnvelopeSchema";
import { UpvoteWhereUniqueInputSchema } from "./UpvoteWhereUniqueInputSchema";

export const UpvoteUncheckedCreateNestedManyWithoutIssueInputSchema: z.ZodType<Prisma.UpvoteUncheckedCreateNestedManyWithoutIssueInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => UpvoteCreateWithoutIssueInputSchema),
          z.lazy(() => UpvoteCreateWithoutIssueInputSchema).array(),
          z.lazy(() => UpvoteUncheckedCreateWithoutIssueInputSchema),
          z.lazy(() => UpvoteUncheckedCreateWithoutIssueInputSchema).array(),
        ])
        .optional(),
      connectOrCreate: z
        .union([
          z.lazy(() => UpvoteCreateOrConnectWithoutIssueInputSchema),
          z.lazy(() => UpvoteCreateOrConnectWithoutIssueInputSchema).array(),
        ])
        .optional(),
      createMany: z
        .lazy(() => UpvoteCreateManyIssueInputEnvelopeSchema)
        .optional(),
      connect: z
        .union([
          z.lazy(() => UpvoteWhereUniqueInputSchema),
          z.lazy(() => UpvoteWhereUniqueInputSchema).array(),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.UpvoteUncheckedCreateNestedManyWithoutIssueInput>;

export default UpvoteUncheckedCreateNestedManyWithoutIssueInputSchema;
