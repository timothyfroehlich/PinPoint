export interface PinballMapAllowanceView {
  remaining: number;
  nextRefillAtIso: string | null;
  observedAtIso: string;
}

export interface PinballMapLocationPreview {
  locationId: number;
  name: string;
  city: string | null;
  state: string | null;
  machineCount: number;
}

export interface PinballMapRetainedLocation {
  locationId: number;
  name: string;
}

export type PinballMapHealthView =
  | { kind: "not_configured" }
  | {
      kind: "waiting";
      lastAttemptAtIso: string | null;
      error: string | null;
    }
  | {
      kind: "healthy";
      syncedAtIso: string;
      lastAttemptAtIso: string | null;
      machineCount: number;
    }
  | {
      kind: "error";
      failedAtIso: string;
      error: string;
      retainedSnapshot: {
        locationId: number;
        name: string;
        syncedAtIso: string;
        machineCount: number;
      } | null;
    };

import type { PinballMapRegion } from "~/lib/pinballmap/types";

export type RegionAlertChannelStatus =
  | "not_configured"
  | "posting"
  | "cant_post"
  | "couldnt_check"
  | "needs_discord";

export interface PinballMapAdminViewState {
  configuredLocationId: number | null;
  configurationGeneration: number;
  currentLocation: PinballMapLocationPreview | null;
  retainedLocation: PinballMapRetainedLocation | null;
  health: PinballMapHealthView;
  allowance: PinballMapAllowanceView;
  configuredRegion: string;
  availableRegions: PinballMapRegion[];
  alertChannelId: string | null;
  alertChannelStatus: RegionAlertChannelStatus;
  alertChannelStatusDetail: string | null;
  alertLastPostAtIso: string | null;
}

export interface CheckedPinballMapLocation {
  checkId: string;
  locationId: number;
  name: string;
  city: string | null;
  state: string | null;
  machineCount: number;
  checkedAtIso: string;
  expiresAtIso: string;
}

export type CheckPinballMapLocationActionResult =
  | {
      ok: true;
      candidate: CheckedPinballMapLocation;
      allowance: PinballMapAllowanceView;
    }
  | {
      ok: false;
      reason:
        | "invalid"
        | "not_found"
        | "throttled"
        | "busy"
        | "concurrent_change"
        | "fetch_failed"
        | "unauthorized"
        | "server_error";
      allowance?: PinballMapAllowanceView;
    };

export type CommitCheckedPinballMapLocationActionResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "invalid"
        | "not_found"
        | "expired"
        | "busy"
        | "concurrent_change"
        | "unauthorized"
        | "server_error";
    };

export type ClearPinballMapLocationActionResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "invalid"
        | "busy"
        | "concurrent_change"
        | "unauthorized"
        | "server_error";
    };

export type SyncPinballMapNowActionResult =
  | { ok: true; allowance: PinballMapAllowanceView }
  | {
      ok: false;
      reason:
        | "not_configured"
        | "throttled"
        | "busy"
        | "concurrent_change"
        | "fetch_failed"
        | "unauthorized"
        | "server_error";
      allowance?: PinballMapAllowanceView;
    };

export type SaveRegionAlertConfigActionResult =
  | {
      ok: true;
      status: RegionAlertChannelStatus;
      statusDetail: string | null;
    }
  | {
      ok: false;
      reason: "invalid" | "unauthorized" | "server_error";
      message?: string;
    };

export type SendRegionAlertTestActionResult =
  | {
      ok: true;
      channelName?: string;
    }
  | {
      ok: false;
      reason:
        | "not_configured"
        | "needs_discord"
        | "cant_post"
        | "couldnt_check"
        | "unauthorized"
        | "invalid"
        | "server_error";
      message?: string;
    };
