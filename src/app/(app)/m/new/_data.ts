import "server-only";

import { cache } from "react";
import { eq } from "drizzle-orm";

import { db } from "~/server/db";
import { pinballmapCatalog } from "~/server/db/schema";

/**
 * The Pinball Map catalog title a `?pbm=` link prefills on the New Machine
 * form (the lineup page's Create in PinPoint), or undefined when the mirror
 * has no such title. `cache()`-wrapped per request.
 */
export const getPrefillPinballmapTitle = cache(
  async (pinballmapMachineId: number) =>
    db.query.pinballmapCatalog.findFirst({
      columns: { pinballmapMachineId: true, name: true },
      where: eq(pinballmapCatalog.pinballmapMachineId, pinballmapMachineId),
    })
);
