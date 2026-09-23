import "server-only";

import { cache } from "react";
import { and, desc, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { db, type DbTransaction } from "~/server/db";
import {
  collectionMachines,
  issues,
  machines,
  timelineEvents,
} from "~/server/db/schema";
import { CLOSED_STATUSES } from "~/lib/issues/status";
import type {
  MachineViewHealth,
  MachineViewPresetId,
  MachineViewResult,
  MachineViewRow,
  MachineViewScope,
} from "~/lib/types";
import type { TimelineTag } from "~/lib/timeline/machine-tags";
import { getMachineViewPreset, planMachineViewDependencies } from "./config";
import {
  applyMachineViewState,
  healthFromSeverityCounts,
  type MachineViewCandidate,
} from "./model";
import { parseMachineViewState } from "./state";

export const MACHINE_VIEW_SERVICE_TAGS = [
  "maintenance",
  "adjustment",
  "parts",
  "upgrade",
  "cleaning",
  "inspection",
] as const satisfies readonly TimelineTag[];

export interface LoadMachineViewArgs {
  scope: MachineViewScope;
  preset: MachineViewPresetId;
  searchParams: URLSearchParams;
}

interface MachineViewBaseRow {
  id: string;
  initials: string;
  title: string;
  presence: MachineViewCandidate["presence"];
  createdAt: Date;
  ownerId: string | null;
  ownerName: string;
  manufacturer: string;
  year: number | null;
  canonicalModelName: string;
  legacyModelName: string;
}

async function machineIdsForScope(
  tx: DbTransaction,
  scope: MachineViewScope
): Promise<string[] | null> {
  if (scope.kind === "all" || scope.kind === "owner") return null;
  const rows = await tx
    .select({ machineId: collectionMachines.machineId })
    .from(collectionMachines)
    .where(eq(collectionMachines.collectionId, scope.collectionId));
  return rows.map((row) => row.machineId);
}

export async function getMachineViewBaseRows(
  tx: DbTransaction,
  scope: MachineViewScope
): Promise<MachineViewBaseRow[]> {
  const scopedMachineIds = await machineIdsForScope(tx, scope);
  if (scopedMachineIds?.length === 0) return [];
  const where =
    scope.kind === "owner"
      ? eq(machines.ownerId, scope.ownerId)
      : scopedMachineIds === null
        ? undefined
        : inArray(machines.id, scopedMachineIds);
  const rows = await tx.query.machines.findMany({
    where,
    columns: {
      id: true,
      initials: true,
      name: true,
      ownerId: true,
      invitedOwnerId: true,
      presenceStatus: true,
      createdAt: true,
      modelName: true,
      manufacturer: true,
      year: true,
    },
    with: {
      owner: { columns: { id: true, name: true } },
      invitedOwner: { columns: { id: true, name: true } },
      pinballmapTitle: {
        columns: { name: true, manufacturer: true, year: true },
      },
    },
  });

  return rows.map((machine) => {
    const owner = machine.owner ?? machine.invitedOwner;
    return {
      id: machine.id,
      initials: machine.initials,
      title: machine.name,
      presence: machine.presenceStatus,
      createdAt: machine.createdAt,
      ownerId: owner?.id ?? null,
      ownerName: owner?.name ?? "Unassigned",
      manufacturer:
        machine.pinballmapTitle?.manufacturer ??
        machine.manufacturer ??
        "Unknown",
      year: machine.pinballmapTitle?.year ?? machine.year,
      canonicalModelName: machine.pinballmapTitle?.name ?? "",
      legacyModelName: machine.modelName ?? "",
    };
  });
}

export async function getMachineViewHealth(
  tx: DbTransaction,
  machineInitials: string[]
): Promise<Map<string, MachineViewHealth>> {
  if (machineInitials.length === 0) return new Map();
  const rows = await tx
    .select({
      machineInitials: issues.machineInitials,
      cosmetic:
        sql<number>`count(*) filter (where ${issues.severity} = 'cosmetic')`.mapWith(
          Number
        ),
      minor:
        sql<number>`count(*) filter (where ${issues.severity} = 'minor')`.mapWith(
          Number
        ),
      major:
        sql<number>`count(*) filter (where ${issues.severity} = 'major')`.mapWith(
          Number
        ),
      unplayable:
        sql<number>`count(*) filter (where ${issues.severity} = 'unplayable')`.mapWith(
          Number
        ),
      oldestOpenIssueAt: sql<Date | null>`min(${issues.createdAt})`.mapWith(
        issues.createdAt
      ),
    })
    .from(issues)
    .where(
      and(
        inArray(issues.machineInitials, machineInitials),
        notInArray(issues.status, [...CLOSED_STATUSES])
      )
    )
    .groupBy(issues.machineInitials);

  return new Map(
    rows.map((row) => [
      row.machineInitials,
      healthFromSeverityCounts({
        cosmetic: row.cosmetic,
        minor: row.minor,
        major: row.major,
        unplayable: row.unplayable,
        oldestOpenIssueAt: row.oldestOpenIssueAt,
      }),
    ])
  );
}

async function latestTimelineDates(
  tx: DbTransaction,
  machineIds: string[],
  serviceOnly: boolean
): Promise<Map<string, Date>> {
  if (machineIds.length === 0) return new Map();
  const serviceCondition = serviceOnly
    ? inArray(timelineEvents.tag, [...MACHINE_VIEW_SERVICE_TAGS])
    : undefined;
  const rows = await tx
    .selectDistinctOn([timelineEvents.machineId], {
      id: timelineEvents.id,
      machineId: timelineEvents.machineId,
      createdAt: timelineEvents.createdAt,
    })
    .from(timelineEvents)
    .where(
      and(
        inArray(timelineEvents.machineId, machineIds),
        isNull(timelineEvents.deletedAt),
        serviceCondition
      )
    )
    .orderBy(
      timelineEvents.machineId,
      desc(timelineEvents.createdAt),
      desc(timelineEvents.sequence),
      desc(timelineEvents.id)
    );

  return new Map(
    rows.flatMap((row) =>
      row.machineId === null ? [] : [[row.machineId, row.createdAt]]
    )
  );
}

export function getLatestMachineServiceDates(
  tx: DbTransaction,
  machineIds: string[]
): Promise<Map<string, Date>> {
  return latestTimelineDates(tx, machineIds, true);
}

export function getLatestMachineActivityDates(
  tx: DbTransaction,
  machineIds: string[]
): Promise<Map<string, Date>> {
  return latestTimelineDates(tx, machineIds, false);
}

function publicRow(candidate: MachineViewCandidate): MachineViewRow {
  const row: MachineViewRow = {
    id: candidate.id,
    initials: candidate.initials,
    title: candidate.title,
    manufacturer: candidate.manufacturer,
    year: candidate.year,
    ownerName: candidate.ownerName,
    presence: candidate.presence,
    createdAt: candidate.createdAt,
  };
  if (candidate.health !== undefined) row.health = candidate.health;
  if (candidate.lastServicedAt !== undefined) {
    row.lastServicedAt = candidate.lastServicedAt;
  }
  if (candidate.lastActivityAt !== undefined) {
    row.lastActivityAt = candidate.lastActivityAt;
  }
  return row;
}

export async function loadMachineViewFromDatabase(
  tx: DbTransaction,
  { scope, preset, searchParams }: LoadMachineViewArgs
): Promise<MachineViewResult> {
  const parsedState = parseMachineViewState(searchParams, preset);
  const baseRows = await getMachineViewBaseRows(tx, scope);
  const validOwnerIds = new Set(
    baseRows.map((row) => row.ownerId ?? "unassigned")
  );
  const validatedState = {
    ...parsedState,
    owner: parsedState.owner.filter((ownerId) => validOwnerIds.has(ownerId)),
  };
  const dependencyPlan = planMachineViewDependencies(validatedState);
  const machineIds = baseRows.map((row) => row.id);
  const machineInitials = baseRows.map((row) => row.initials);
  const [health, serviceDates, activityDates] = await Promise.all([
    dependencyPlan.health
      ? getMachineViewHealth(tx, machineInitials)
      : Promise.resolve(new Map<string, MachineViewHealth>()),
    dependencyPlan.service
      ? getLatestMachineServiceDates(tx, machineIds)
      : Promise.resolve(new Map<string, Date>()),
    dependencyPlan.activity
      ? getLatestMachineActivityDates(tx, machineIds)
      : Promise.resolve(new Map<string, Date>()),
  ]);
  const candidates: MachineViewCandidate[] = baseRows.map((machine) => {
    const row: MachineViewCandidate = {
      id: machine.id,
      initials: machine.initials,
      title: machine.title,
      manufacturer: machine.manufacturer,
      year: machine.year,
      ownerId: machine.ownerId,
      ownerName: machine.ownerName,
      presence: machine.presence,
      createdAt: machine.createdAt.toISOString(),
      canonicalModelName: machine.canonicalModelName,
      legacyModelName: machine.legacyModelName,
    };
    if (dependencyPlan.health) {
      row.health =
        health.get(machine.initials) ??
        healthFromSeverityCounts({
          cosmetic: 0,
          minor: 0,
          major: 0,
          unplayable: 0,
          oldestOpenIssueAt: null,
        });
    }
    if (dependencyPlan.service) {
      row.lastServicedAt = serviceDates.get(machine.id)?.toISOString() ?? null;
    }
    if (dependencyPlan.activity) {
      row.lastActivityAt = activityDates.get(machine.id)?.toISOString() ?? null;
    }
    return row;
  });
  const ownerOptionsById = new Map<string, string>();
  for (const row of baseRows) {
    ownerOptionsById.set(row.ownerId ?? "unassigned", row.ownerName);
  }
  const applied = applyMachineViewState(candidates, validatedState);
  const state = { ...validatedState, page: applied.page };

  return {
    rows: applied.rows.map(publicRow),
    scopeCount: baseRows.length,
    totalCount: applied.totalCount,
    state,
    ownerOptions: [...ownerOptionsById]
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    permittedFields: [...getMachineViewPreset(preset).permittedFields],
  };
}

const loadMachineViewCached = cache(
  async (
    scopeKind: MachineViewScope["kind"],
    scopeId: string,
    preset: MachineViewPresetId,
    serializedSearchParams: string
  ): Promise<MachineViewResult> => {
    const scope: MachineViewScope =
      scopeKind === "all"
        ? { kind: "all" }
        : scopeKind === "collection"
          ? { kind: "collection", collectionId: scopeId }
          : { kind: "owner", ownerId: scopeId };
    return loadMachineViewFromDatabase(db, {
      scope,
      preset,
      searchParams: new URLSearchParams(serializedSearchParams),
    });
  }
);

export function loadMachineView({
  scope,
  preset,
  searchParams,
}: LoadMachineViewArgs): Promise<MachineViewResult> {
  const scopeId =
    scope.kind === "collection"
      ? scope.collectionId
      : scope.kind === "owner"
        ? scope.ownerId
        : "";
  return loadMachineViewCached(
    scope.kind,
    scopeId,
    preset,
    searchParams.toString()
  );
}
