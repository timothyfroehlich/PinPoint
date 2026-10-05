import { inArray } from "drizzle-orm";

import { db } from "~/server/db";
import { pinTips } from "~/server/db/schema";
import {
  apronCardContent,
  type ApronCardContent,
  type ApronCardSize,
  type ApronCardTemplate,
} from "~/lib/machines/apron-card";
import { machineNotRemoved } from "~/lib/machines/queries";
import {
  creditsFromNames,
  creditsFromPeople,
  NO_CREDITS,
} from "~/lib/opdb/credits";
import { getOpdbRecords } from "~/lib/opdb/records";
import { opdbGroupId } from "~/lib/pintips/parse";

/** One saved card as the Print apron cards page lists and prints it. */
export interface PrintableApronCard {
  id: string;
  machineName: string;
  machineInitials: string;
  cardName: string;
  size: ApronCardSize;
  template: ApronCardTemplate;
  content: ApronCardContent;
}

/**
 * Every saved card of every machine that is not Removed (spec apron-cards
 * §12.2), rendered from its saved state (§9.1), by machine name and then in
 * the order the cards were created. Credits and PinTips are read for all
 * machines at once rather than per machine.
 */
export async function getPrintableApronCards(): Promise<PrintableApronCard[]> {
  const rows = await db.query.machines.findMany({
    where: machineNotRemoved(),
    columns: {
      name: true,
      initials: true,
      year: true,
      description: true,
      manufacturer: true,
      pinballmapMachineId: true,
      pinballmapExcluded: true,
      designers: true,
      artists: true,
    },
    with: {
      owner: { columns: { name: true } },
      invitedOwner: { columns: { name: true } },
      pinballmapTitle: {
        columns: {
          name: true,
          machineGroupId: true,
          groupName: true,
          manufacturer: true,
          opdbId: true,
        },
      },
      apronCards: {
        orderBy: (cards, { asc }) => [asc(cards.createdAt), asc(cards.id)],
      },
    },
    orderBy: (machines, { asc }) => [asc(machines.name), asc(machines.id)],
  });
  const withCards = rows.filter((machine) => machine.apronCards.length > 0);

  // Same sources as one card's export: getMachineCredits, getMachinePinTips.
  const opdbIds = withCards.flatMap((machine) =>
    machine.pinballmapTitle?.opdbId ? [machine.pinballmapTitle.opdbId] : []
  );
  const creditIds = withCards.flatMap((machine) =>
    !machine.pinballmapExcluded && machine.pinballmapTitle?.opdbId
      ? [machine.pinballmapTitle.opdbId]
      : []
  );
  const groupIds = [
    ...new Set(
      opdbIds.flatMap((id) => {
        const group = opdbGroupId(id);
        return group === null ? [] : [group];
      })
    ),
  ];
  const [records, tipGroups] = await Promise.all([
    getOpdbRecords(db, creditIds),
    groupIds.length === 0
      ? Promise.resolve([])
      : db
          .selectDistinct({ groupId: pinTips.opdbGroupId })
          .from(pinTips)
          .where(inArray(pinTips.opdbGroupId, groupIds)),
  ]);
  const groupsWithTips = new Set(tipGroups.map((row) => row.groupId));

  return withCards.flatMap((machine) => {
    const opdbId = machine.pinballmapTitle?.opdbId ?? null;
    const record = opdbId === null ? undefined : records.get(opdbId);
    const credits = machine.pinballmapExcluded
      ? creditsFromNames(machine.designers, machine.artists)
      : record
        ? creditsFromPeople(record.people)
        : NO_CREDITS;
    const group = opdbId === null ? null : opdbGroupId(opdbId);
    const hasPinTips = group !== null && groupsWithTips.has(group);
    return machine.apronCards.map((card) => ({
      id: card.id,
      machineName: machine.name,
      machineInitials: machine.initials,
      cardName: card.name,
      size: card.size,
      template: card.template,
      content: apronCardContent(machine, card, credits, hasPinTips),
    }));
  });
}
