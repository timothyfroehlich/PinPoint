import type { ReportMode } from "~/lib/types";

/** A saved batch preference never grants batch access on its own. */
export function resolveDefaultReportMode(
  savedMode: ReportMode,
  canMultiple: boolean,
  fallbackMode: "quick" | "detailed"
): ReportMode {
  if (savedMode === "multiple" && !canMultiple) return fallbackMode;
  return savedMode;
}

export function reportModePath(mode: ReportMode): string {
  switch (mode) {
    case "quick":
      return "/report";
    case "detailed":
      return "/report/detailed";
    case "multiple":
      return "/report/multiple";
  }
}
