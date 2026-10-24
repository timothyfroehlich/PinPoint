import {
  getMachinePresenceLabel,
  type MachinePresenceStatus,
} from "~/lib/machines/presence";
import {
  getMachineStatusLabel,
  type MachineStatus,
} from "~/lib/machines/status";
import { siteDayOf } from "~/lib/time-zone";

/** One machine in a Machine export (machine-views §3.16). */
export interface MachineExportRow {
  /** The machine's initials. */
  id: string;
  /** The machine's own title. */
  name: string;
  /** The catalog title, which carries the edition; empty when there is none. */
  model: string;
  /** Null when the machine has no manufacturer. */
  manufacturer: string | null;
  year: number | null;
  /** Null when the machine has no owner. */
  ownerName: string | null;
  /** ISO instant the machine was added. */
  createdAt: string;
  presence: MachinePresenceStatus;
  playability: MachineStatus;
  openIssues: number;
  /** ISO instant of the latest service event, or null when it has none. */
  lastServicedAt: string | null;
  /** ISO instant of the latest timeline event, or null when it has none. */
  lastActivityAt: string | null;
}

/** The export's columns, whatever fields the list displays (§3.16). */
export const MACHINE_EXPORT_HEADERS = [
  "ID",
  "Name",
  "Model",
  "Manufacturer",
  "Year",
  "Owner",
  "Date Added",
  "Presence",
  "Playability",
  "Open Issues",
  "Last Serviced",
  "Last Activity",
];

function siteDay(instant: string | null): string {
  return instant === null ? "" : siteDayOf(new Date(instant));
}

/**
 * The CSV cells of a Machine export, in {@link MACHINE_EXPORT_HEADERS} order.
 * A missing manufacturer, year, owner, or date is an empty cell, never a
 * placeholder.
 */
export function machineExportCsvRows(rows: MachineExportRow[]): string[][] {
  return rows.map((row) => [
    row.id,
    row.name,
    row.model,
    row.manufacturer ?? "",
    row.year === null ? "" : String(row.year),
    row.ownerName ?? "",
    siteDay(row.createdAt),
    getMachinePresenceLabel(row.presence),
    getMachineStatusLabel(row.playability),
    String(row.openIssues),
    siteDay(row.lastServicedAt),
    siteDay(row.lastActivityAt),
  ]);
}
