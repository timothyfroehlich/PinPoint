"use client";

import type React from "react";
import {
  SummaryWidget,
  SummaryWidgetGroup,
  type SummaryWidgetSegment,
} from "~/components/summary-widgets";
import { SEVERITY_CONFIG } from "~/lib/issues/status";
import {
  getMachinePresenceLabel,
  MACHINE_PRESENCE_WIDGET_COLORS,
  type MachinePresenceStatus,
  VALID_MACHINE_PRESENCE_STATUSES,
} from "~/lib/machines/presence";
import {
  getMachineStatusLabel,
  MACHINE_STATUS_WIDGET_COLORS,
  type MachineStatus,
} from "~/lib/machines/status";
import {
  ISSUE_SEVERITY_VALUES,
  type IssueSeverity,
  type MachineViewState,
  type MachineViewSummary,
} from "~/lib/types";

const STORAGE_KEY = "pinpoint:summary-widgets:machines";
const PLAYABILITY_VALUES: MachineStatus[] = [
  "operational",
  "needs_service",
  "unplayable",
];

interface MachineSummaryWidgetsProps {
  summary: MachineViewSummary;
  state: MachineViewState;
  onStateChange: (next: MachineViewState) => void;
}

function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}

/** The value a filter holds when it holds exactly one value, else null. */
function soleValue<T>(values: "all" | T[]): T | null {
  return values !== "all" && values.length === 1 ? (values[0] ?? null) : null;
}

/**
 * The Presence, Playability, and Open Issues widgets on Machine View
 * (machine-widgets spec). Segment selection sets Machine View filters.
 */
export function MachineSummaryWidgets({
  summary,
  state,
  onStateChange,
}: MachineSummaryWidgetsProps): React.JSX.Element {
  const { presence, playability, issues } = summary;
  const playable =
    playability.byStatus.operational + playability.byStatus.needs_service;

  const presenceSegments: SummaryWidgetSegment<MachinePresenceStatus>[] =
    VALID_MACHINE_PRESENCE_STATUSES.map((value) => ({
      value,
      label: getMachinePresenceLabel(value),
      count: presence.byPresence[value],
      textClassName: MACHINE_PRESENCE_WIDGET_COLORS[value].text,
      fillClassName: MACHINE_PRESENCE_WIDGET_COLORS[value].fill,
    }));
  const playabilitySegments: SummaryWidgetSegment<MachineStatus>[] =
    PLAYABILITY_VALUES.map((value) => ({
      value,
      label: getMachineStatusLabel(value),
      count: playability.byStatus[value],
      textClassName: MACHINE_STATUS_WIDGET_COLORS[value].text,
      fillClassName: MACHINE_STATUS_WIDGET_COLORS[value].fill,
    }));
  const severitySegments: SummaryWidgetSegment<IssueSeverity>[] =
    ISSUE_SEVERITY_VALUES.map((value) => ({
      value,
      label: SEVERITY_CONFIG[value].label,
      count: issues.bySeverity[value],
      textClassName: SEVERITY_CONFIG[value].iconColor,
      fillClassName: SEVERITY_CONFIG[value].barColor,
    }));

  const presenceText = plural(presence.total, "machine", "machines");
  const playabilityText = `of ${playability.onTheFloor} playable`;
  const issuesText = `open across ${issues.machinesWithOpenIssues} ${plural(
    issues.machinesWithOpenIssues,
    "machine",
    "machines"
  )}`;
  const summaryRow = [
    `${presence.total} ${presenceText}`,
    `${playable} ${playabilityText}`,
    `${issues.openIssues} open ${plural(issues.openIssues, "issue", "issues")}`,
  ].join(" · ");

  const selectedStatus = soleValue(state.status);

  return (
    <SummaryWidgetGroup storageKey={STORAGE_KEY} summaryRow={summaryRow}>
      <SummaryWidget
        id="machine-widget-presence"
        label="Presence"
        population={state.presenceWidget}
        onPopulationChange={(presenceWidget) =>
          onStateChange({ ...state, presenceWidget })
        }
        headline={{
          figure: presence.total,
          text: presenceText,
          accentClassName: "text-primary",
        }}
        segments={presenceSegments}
        selectedValue={soleValue(state.presence)}
        onSegmentSelect={(value) =>
          onStateChange({ ...state, presence: [value], page: 1 })
        }
      />
      <SummaryWidget
        id="machine-widget-playability"
        label="Playability"
        population={state.playabilityWidget}
        onPopulationChange={(playabilityWidget) =>
          onStateChange({ ...state, playabilityWidget })
        }
        headline={{
          figure: playable,
          text: playabilityText,
          accentClassName: MACHINE_STATUS_WIDGET_COLORS.operational.text,
        }}
        segments={playabilitySegments}
        selectedValue={
          soleValue(state.presence) === "on_the_floor" ? selectedStatus : null
        }
        onSegmentSelect={(value) =>
          onStateChange({
            ...state,
            status: [value],
            presence: ["on_the_floor"],
            page: 1,
          })
        }
      />
      <SummaryWidget
        id="machine-widget-issues"
        label="Open Issues"
        population={state.issuesWidget}
        onPopulationChange={(issuesWidget) =>
          onStateChange({ ...state, issuesWidget })
        }
        headline={{
          figure: issues.openIssues,
          text: issuesText,
          accentClassName: "text-warning",
        }}
        segments={severitySegments}
        selectedValue={soleValue(state.severity)}
        onSegmentSelect={(value) =>
          onStateChange({ ...state, severity: [value], page: 1 })
        }
      />
    </SummaryWidgetGroup>
  );
}
