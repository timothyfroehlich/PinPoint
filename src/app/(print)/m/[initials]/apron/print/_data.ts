import "server-only";

import { cache } from "react";
import { eq } from "drizzle-orm";

import { db } from "~/server/db";
import { machineApronCards, machines, userProfiles } from "~/server/db/schema";

/** The printing user's profile role, or undefined when the row is missing. */
export const getPrinterProfile = cache(async (userId: string) =>
  db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, userId),
    columns: { role: true },
  })
);

/**
 * The machine with the one saved apron card being printed (spec apron-cards
 * §9.1), its owner and catalog title for the card's content. `apronCards` is
 * empty when the machine has no card with this id.
 */
export const getMachineWithApronCard = cache(
  async (initials: string, cardId: string) =>
    db.query.machines.findFirst({
      where: eq(machines.initials, initials),
      with: {
        owner: { columns: { name: true } },
        invitedOwner: { columns: { name: true } },
        apronCards: {
          where: eq(machineApronCards.id, cardId),
        },
        pinballmapTitle: {
          columns: {
            name: true,
            machineGroupId: true,
            groupName: true,
            manufacturer: true,
            opdbId: true,
          },
        },
      },
    })
);
