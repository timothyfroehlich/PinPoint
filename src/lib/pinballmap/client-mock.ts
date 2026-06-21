import { parseCatalog, parseLocation, parseMachineGroups } from "./parse";
import locationFixture from "./fixtures/location-26454.json";
import catalogFixture from "./fixtures/catalog-apc.json";
import machineGroupsFixture from "./fixtures/machine-groups.json";
import { APC_LOCATION_ID } from "./config";
import type {
  CatalogMachine,
  LocationSnapshot,
  MachineGroup,
  PbmAddMachineResult,
  PbmAuthResult,
  PbmCondition,
  PbmToggleResult,
  PbmWriteResult,
  PinballMapClient,
} from "./types";

/**
 * In-memory mock PinballMap client, seeded from real captured fixtures
 * (location 26454 + its catalog slice). It mutates local state so the dev
 * server and tests can exercise the full flow — add/remove/comment/IC/drift —
 * with no network and no credentials (CORE-TEST-006).
 *
 * `createMockClient()` returns a fresh, isolated instance (use in tests).
 * `getMockClient()` returns a process singleton whose state persists across
 * requests (used by the dev server).
 */

interface MockLmx {
  id: number;
  machineId: number;
  icEnabled: boolean | null;
  lastUpdatedByUsername: string | null;
  conditions: PbmCondition[];
}

function seedLmxes(): MockLmx[] {
  return parseLocation(locationFixture, new Date().toISOString()).lmxes.map(
    (l) => ({
      id: l.id,
      machineId: l.machineId,
      icEnabled: l.icEnabled,
      lastUpdatedByUsername: l.lastUpdatedByUsername,
      conditions: l.conditions.map((c) => ({ ...c })),
    })
  );
}

export function createMockClient(): PinballMapClient {
  const lmxes: MockLmx[] = seedLmxes();
  const catalog: CatalogMachine[] = parseCatalog(catalogFixture);
  let nextLmxId = lmxes.reduce((max, l) => Math.max(max, l.id), 0) + 1;
  let nextConditionId =
    lmxes.reduce(
      (max, l) => l.conditions.reduce((m, c) => Math.max(m, c.id), max),
      0
    ) + 1;

  const snapshot = (): LocationSnapshot => ({
    locationId: APC_LOCATION_ID,
    name: "Austin Pinball Collective",
    dateLastUpdated: new Date().toISOString().slice(0, 10),
    lastUpdatedByUsername: "pinpoint-mock",
    machineCount: lmxes.length,
    lmxes: lmxes.map((l) => ({
      id: l.id,
      machineId: l.machineId,
      icEnabled: l.icEnabled,
      lastUpdatedByUsername: l.lastUpdatedByUsername,
      conditions: l.conditions.map((c) => ({ ...c })),
    })),
    fetchedAtIso: new Date().toISOString(),
    raw: { mock: true, lmxCount: lmxes.length },
  });

  return {
    fetchLocation(): Promise<LocationSnapshot> {
      return Promise.resolve(snapshot());
    },

    fetchCatalog(): Promise<CatalogMachine[]> {
      return Promise.resolve(catalog.map((m) => ({ ...m })));
    },

    fetchMachineGroups(): Promise<MachineGroup[]> {
      return Promise.resolve(parseMachineGroups(machineGroupsFixture));
    },

    authDetails(login: string, password: string): Promise<PbmAuthResult> {
      if (!login || !password) {
        return Promise.resolve({ ok: false, reason: "invalid_credentials" });
      }
      return Promise.resolve({
        ok: true,
        token: `mock-token-${login}`,
        username: login,
      });
    },

    addMachine({ machineId }): Promise<PbmAddMachineResult> {
      // PBM's create is find-or-create: re-adding a machine already at the
      // location returns the existing lmx rather than a duplicate.
      const existing = lmxes.find((l) => l.machineId === machineId);
      if (existing) return Promise.resolve({ ok: true, lmxId: existing.id });
      const id = nextLmxId;
      nextLmxId += 1;
      lmxes.push({
        id,
        machineId,
        icEnabled: null,
        lastUpdatedByUsername: "pinpoint-mock",
        conditions: [],
      });
      return Promise.resolve({ ok: true, lmxId: id });
    },

    removeMachine({ lmxId }): Promise<PbmWriteResult> {
      const idx = lmxes.findIndex((l) => l.id === lmxId);
      if (idx === -1) {
        return Promise.resolve({
          ok: false,
          reason: "not_found",
          message: "Failed to find machine",
        });
      }
      lmxes.splice(idx, 1);
      return Promise.resolve({ ok: true });
    },

    postCondition({ lmxId, comment }): Promise<PbmWriteResult> {
      const lmx = lmxes.find((l) => l.id === lmxId);
      if (!lmx) {
        return Promise.resolve({
          ok: false,
          reason: "not_found",
          message: "Failed to find machine",
        });
      }
      const conditionId = nextConditionId;
      nextConditionId += 1;
      lmx.conditions.push({
        id: conditionId,
        comment,
        username: "pinpoint-mock",
        createdAtIso: new Date().toISOString(),
      });
      return Promise.resolve({ ok: true });
    },

    toggleInsiderConnected({ lmxId }): Promise<PbmToggleResult> {
      const lmx = lmxes.find((l) => l.id === lmxId);
      if (!lmx) {
        return Promise.resolve({
          ok: false,
          reason: "not_found",
          message: "Failed to find machine",
        });
      }
      // PBM flips state; null (never set) becomes enabled.
      lmx.icEnabled = lmx.icEnabled === true ? false : true;
      return Promise.resolve({ ok: true, icEnabled: lmx.icEnabled });
    },

    confirmLineup(): Promise<PbmWriteResult> {
      return Promise.resolve({ ok: true });
    },
  };
}

let singleton: PinballMapClient | null = null;
export function getMockClient(): PinballMapClient {
  singleton ??= createMockClient();
  return singleton;
}
