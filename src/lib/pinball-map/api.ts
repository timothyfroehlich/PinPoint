import "server-only";

import { log } from "~/lib/logger";
import { type Result, ok, err } from "~/lib/result";
import type { PbmMachine, PbmLocationMachine } from "./types";

const PBM_BASE_URL = "https://pinballmap.com/api/v1";

type PbmApiError = "API_ERROR" | "AUTH_ERROR";

/**
 * Search Pinball Map's canonical machine database by name.
 * No authentication required.
 */
export async function searchPbmMachines(
  query: string
): Promise<Result<PbmMachine[], PbmApiError>> {
  try {
    const url = new URL(`${PBM_BASE_URL}/machines.json`);
    url.searchParams.set("name", query);

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 }, // Cache machine list for 1 hour
    });

    if (!res.ok) {
      log.error(
        { action: "pbm.searchMachines", status: res.status },
        "Pinball Map machines search failed"
      );
      return err("API_ERROR", `Pinball Map API returned ${res.status}`);
    }

    const data = (await res.json()) as { machines?: PbmMachine[] };
    return ok(data.machines ?? []);
  } catch (error) {
    log.error(
      {
        action: "pbm.searchMachines",
        error: error instanceof Error ? error.message : "Unknown",
      },
      "Pinball Map machines search request failed"
    );
    return err("API_ERROR", "Failed to connect to Pinball Map API");
  }
}

/**
 * Get all machines currently listed at a Pinball Map location.
 * No authentication required.
 */
export async function getLocationMachines(
  locationId: number
): Promise<Result<PbmLocationMachine[], PbmApiError>> {
  try {
    const url = `${PBM_BASE_URL}/locations/${locationId}/machine_details.json`;

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 }, // Always fresh for sync reports
    });

    if (!res.ok) {
      log.error(
        { action: "pbm.getLocationMachines", status: res.status, locationId },
        "Pinball Map location machines fetch failed"
      );
      return err("API_ERROR", `Pinball Map API returned ${res.status}`);
    }

    const data = (await res.json()) as {
      machines: PbmLocationMachine[] | undefined;
    };
    return ok(data.machines ?? []);
  } catch (error) {
    log.error(
      {
        action: "pbm.getLocationMachines",
        error: error instanceof Error ? error.message : "Unknown",
        locationId,
      },
      "Pinball Map location machines request failed"
    );
    return err("API_ERROR", "Failed to connect to Pinball Map API");
  }
}

/**
 * Add a machine to a Pinball Map location.
 * Requires authentication (user_email + user_token).
 */
export async function addMachineToLocation(params: {
  locationId: number;
  machineId: number;
  email: string;
  token: string;
}): Promise<Result<{ xrefId: number }, PbmApiError>> {
  try {
    const url = new URL(`${PBM_BASE_URL}/location_machine_xrefs.json`);
    url.searchParams.set("user_email", params.email);
    url.searchParams.set("user_token", params.token);

    const body = new URLSearchParams({
      location_id: params.locationId.toString(),
      machine_id: params.machineId.toString(),
    });

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });

    if (res.status === 401 || res.status === 403) {
      log.warn(
        { action: "pbm.addMachine", status: res.status },
        "Pinball Map authentication failed"
      );
      return err("AUTH_ERROR", "Pinball Map authentication failed");
    }

    if (!res.ok) {
      log.error(
        { action: "pbm.addMachine", status: res.status },
        "Pinball Map add machine failed"
      );
      return err("API_ERROR", `Pinball Map API returned ${res.status}`);
    }

    const data = (await res.json()) as {
      location_machine: { id: number } | undefined;
    };
    const xrefId = data.location_machine?.id;

    if (xrefId === undefined) {
      log.error(
        { action: "pbm.addMachine", data },
        "Pinball Map add machine returned unexpected response"
      );
      return err("API_ERROR", "Unexpected response from Pinball Map");
    }

    return ok({ xrefId });
  } catch (error) {
    log.error(
      {
        action: "pbm.addMachine",
        error: error instanceof Error ? error.message : "Unknown",
      },
      "Pinball Map add machine request failed"
    );
    return err("API_ERROR", "Failed to connect to Pinball Map API");
  }
}

/**
 * Remove a machine from a Pinball Map location.
 * Requires authentication (user_email + user_token).
 */
export async function removeMachineFromLocation(params: {
  xrefId: number;
  email: string;
  token: string;
}): Promise<Result<void, PbmApiError>> {
  try {
    const url = new URL(
      `${PBM_BASE_URL}/location_machine_xrefs/${params.xrefId}.json`
    );
    url.searchParams.set("user_email", params.email);
    url.searchParams.set("user_token", params.token);

    const res = await fetch(url.toString(), {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });

    if (res.status === 401 || res.status === 403) {
      log.warn(
        { action: "pbm.removeMachine", status: res.status },
        "Pinball Map authentication failed"
      );
      return err("AUTH_ERROR", "Pinball Map authentication failed");
    }

    if (!res.ok) {
      log.error(
        { action: "pbm.removeMachine", status: res.status },
        "Pinball Map remove machine failed"
      );
      return err("API_ERROR", `Pinball Map API returned ${res.status}`);
    }

    return ok(undefined);
  } catch (error) {
    log.error(
      {
        action: "pbm.removeMachine",
        error: error instanceof Error ? error.message : "Unknown",
      },
      "Pinball Map remove machine request failed"
    );
    return err("API_ERROR", "Failed to connect to Pinball Map API");
  }
}
