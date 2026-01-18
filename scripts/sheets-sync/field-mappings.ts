import {
  type IssueConsistency,
  type IssueSeverity,
  type IssueStatus,
  type SheetRow,
  type SyncIssue,
} from "./types";

// Note: This will need to be populated from the database in the main script
export let machineMap: Record<string, string> = {};

export function setMachineMap(map: Record<string, string>) {
  machineMap = map;
}

export function mapSheetSeverity(value: string): IssueSeverity {
  const v = value.toLowerCase().trim();
  if (v.includes("major")) return "major";
  if (v.includes("severe") || v.includes("unplayable")) return "unplayable";
  if (v.includes("cosmetic")) return "cosmetic";
  return "minor"; // default
}

export function mapSheetConsistency(value: string): IssueConsistency {
  const v = value.toLowerCase().trim();
  if (v.includes("always") || v.includes("every game")) return "constant";
  if (v.includes("frequent")) return "frequent";
  return "intermittent"; // default
}

export function mapSheetStatus(value: string): IssueStatus {
  const v = value.toLowerCase().trim();
  if (v.includes("fixed")) return "fixed";
  if (v.includes("not a bug") || v.includes("intended")) return "wai";
  if (v.includes("owner")) return "wait_owner";
  if (v.includes("parts")) return "need_parts";
  if (v.includes("progress")) return "in_progress";
  if (v.includes("help") || v.includes("expert")) return "need_help";
  return "new"; // default
}

export function parseSheetRow(
  row: Record<string, string | undefined>,
  rowIndex: number
): SheetRow {
  return {
    timestamp: row["Timestamp"] ?? "",
    email: row["Email Address"] ?? "",
    game: row["Game"] ?? "",
    pinpointId: row["PinPoint"] ?? "",
    severity: row["Severity"] ?? "",
    consistency: row["Consistency"] ?? "",
    fixStatus: row["Fix Status"] ?? "",
    description: row["Description"] ?? "",
    workLog: row["Work Log"] ?? "",
    lastSynced: row["Last Synced"] ?? "",
    rowIndex,
  };
}

// Normalizes a string for comparison (lowercase, alphanumeric only, removes "The " prefix)
function normalize(str: string): string {
  let s = str.toLowerCase().trim();
  if (s.startsWith("the ")) s = s.substring(4);
  return s.replace(/[^a-z0-9]/g, "");
}

export function mapRowToIssue(row: SheetRow): SyncIssue | null {
  // Try exact match first
  let initials = machineMap[row.game];

  // Try normalized match
  if (!initials) {
    const normalizedGame = normalize(row.game);
    const match = Object.entries(machineMap).find(
      ([name]) => normalize(name) === normalizedGame
    );
    if (match) initials = match[1];
  }

  // Fuzzy match (substring)
  if (!initials) {
    const normalizedGame = normalize(row.game);
    if (normalizedGame.length >= 3) {
      const matches = Object.entries(machineMap).filter(([name]) => {
        const normName = normalize(name);
        return (
          normName.includes(normalizedGame) || normalizedGame.includes(normName)
        );
      });
      // Only use fuzzy match if there's exactly one candidate to avoid false positives
      if (matches.length === 1) {
        initials = matches[0]?.[1];
      }
    }
  }

  // Handle specific common aliases/mismatches
  if (!initials) {
    const raw = row.game.trim().toUpperCase();
    if (raw.includes("IRON MAIDEN") || raw === "MAIDEN")
      initials = machineMap["Iron Maiden"];
    if (raw === "TNA") initials = machineMap["Total Nuclear Ann."];
    if (raw === "LOTR") initials = machineMap["Lord of the Rings"];
    if (raw === "F-14" || raw === "F14") initials = machineMap["F14 Tomcat"];
    if (raw === "X MEN" || raw === "X-MEN")
      initials = machineMap["X-Men Wolverine"];
  }

  if (!initials) return null;

  // Split description into title and description
  const lines = row.description.split("\n");
  const title = (lines[0] ?? "").substring(0, 100);
  const description = lines.length > 1 ? lines.slice(1).join("\n") : lines[0];

  return {
    id: row.pinpointId?.match(/[0-9a-f-]{36}/)?.[0], // Extract UUID if present
    machineInitials: initials,
    title,
    description: description ?? "",
    status: mapSheetStatus(row.fixStatus),
    severity: mapSheetSeverity(row.severity),
    consistency: mapSheetConsistency(row.consistency),
    reporterEmail: row.email,
    updatedAt: new Date(), // Will be updated by comparison logic
    createdAt: new Date(row.timestamp),
  };
}
