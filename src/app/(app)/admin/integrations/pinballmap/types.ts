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
      machineCount: number;
    }
  | {
      kind: "error";
      failedAtIso: string;
      error: string;
      retainedSnapshot: {
        syncedAtIso: string;
        machineCount: number;
      } | null;
    };

export interface PinballMapAdminViewState {
  configuredLocationId: number | null;
  configurationGeneration: number;
  currentLocation: PinballMapLocationPreview | null;
  retainedLocation: PinballMapRetainedLocation | null;
  health: PinballMapHealthView;
  allowance: PinballMapAllowanceView;
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
