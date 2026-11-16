import { describe, expect, it } from "vitest";
import { generateCsv } from "~/lib/export/csv";
import {
  MACHINE_EXPORT_HEADERS,
  machineExportCsvRows,
  type MachineExportRow,
} from "./export";

function row(overrides: Partial<MachineExportRow> = {}): MachineExportRow {
  return {
    id: "GZ",
    name: "Godzilla",
    model: "Godzilla (Premium)",
    manufacturer: "Stern",
    year: 2021,
    ownerName: "Olive Owner",
    createdAt: "2026-03-05T18:00:00.000Z",
    presence: "on_the_floor",
    playability: "needs_service",
    openIssues: 3,
    lastServicedAt: "2026-04-01T15:00:00.000Z",
    lastActivityAt: "2026-04-02T15:00:00.000Z",
    ...overrides,
  };
}

describe("machineExportCsvRows", () => {
  it("has the twelve columns, in order", () => {
    expect(MACHINE_EXPORT_HEADERS).toEqual([
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
    ]);
  });

  it("maps a machine to a cell per column, with the UI's labels and site days", () => {
    expect(machineExportCsvRows([row()])).toEqual([
      [
        "GZ",
        "Godzilla",
        "Godzilla (Premium)",
        "Stern",
        "2021",
        "Olive Owner",
        "2026-03-05",
        "On the Floor",
        "Needs Service",
        "3",
        "2026-04-01",
        "2026-04-02",
      ],
    ]);
    expect(machineExportCsvRows([row()])[0]).toHaveLength(
      MACHINE_EXPORT_HEADERS.length
    );
  });

  it("leaves a missing model, manufacturer, year, owner, or date as an empty cell", () => {
    const [cells] = machineExportCsvRows([
      row({
        model: "",
        manufacturer: null,
        year: null,
        ownerName: null,
        lastServicedAt: null,
        lastActivityAt: null,
        playability: "operational",
        presence: "off_the_floor",
        openIssues: 0,
      }),
    ]);
    expect(cells).toEqual([
      "GZ",
      "Godzilla",
      "",
      "",
      "",
      "",
      "2026-03-05",
      "Off the Floor",
      "Operational",
      "0",
      "",
      "",
    ]);
  });

  it("keeps the row order and writes empty cells into the CSV", () => {
    const csv = generateCsv(
      MACHINE_EXPORT_HEADERS,
      machineExportCsvRows([
        row({ id: "B", manufacturer: null, year: null }),
        row({ id: "A" }),
      ])
    );
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(`﻿${MACHINE_EXPORT_HEADERS.join(",")}`);
    expect(
      lines[1]?.startsWith("B,Godzilla,Godzilla (Premium),,,Olive Owner")
    ).toBe(true);
    expect(
      lines[2]?.startsWith("A,Godzilla,Godzilla (Premium),Stern,2021")
    ).toBe(true);
  });
});
