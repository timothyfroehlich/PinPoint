"use client";

import type React from "react";
import {
  SummaryWidget,
  SummaryWidgetGroup,
  type SummaryWidgetSegment,
} from "~/components/summary-widgets";
import {
  getMachinePresenceLabel,
  MACHINE_PRESENCE_WIDGET_COLORS,
} from "~/lib/machines/presence";
import {
  getMachineStatusLabel,
  MACHINE_STATUS_COLORS,
  type MachineStatus,
} from "~/lib/machines/status";
import type {
  MachinePresenceWidgetStatus,
  MachineViewState,
  MachineViewSummary,
} from "~/lib/types";
import { cn } from "~/lib/utils";

const STORAGE_KEY = "pinpoint:summary-widgets:machines";

/**
 * Segment order: Presence leads with On the Floor and leaves out Removed
 * (machine-widgets §3.2); Playability runs worst first (§4.2).
 */
const PRESENCE_SEGMENTS: readonly MachinePresenceWidgetStatus[] = [
  "on_the_floor",
  "off_the_floor",
  "on_loan",
  "pending_arrival",
];
const PLAYABILITY_SEGMENTS: readonly MachineStatus[] = [
  "unplayable",
  "needs_service",
  "operational",
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
 * The Presence and Playability widgets on Machine View (machine-widgets
 * spec), always counting the route's whole scope. Segment selection sets
 * Machine View filters, keeping search and the other filters (widgets §6.2).
 */
export function MachineSummaryWidgets({
  summary,
  state,
  onStateChange,
}: MachineSummaryWidgetsProps): React.JSX.Element {
  const { presence, playability } = summary;
  const playable =
    playability.byStatus.operational + playability.byStatus.needs_service;

  const presenceSegments: SummaryWidgetSegment<MachinePresenceWidgetStatus>[] =
    PRESENCE_SEGMENTS.map((value) => ({
      value,
      label: getMachinePresenceLabel(value),
      count: presence.byPresence[value],
      textClassName: MACHINE_PRESENCE_WIDGET_COLORS[value].text,
      fillClassName: MACHINE_PRESENCE_WIDGET_COLORS[value].fill,
    }));
  const playabilitySegments: SummaryWidgetSegment<MachineStatus>[] =
    PLAYABILITY_SEGMENTS.map((value) => ({
      value,
      label: getMachineStatusLabel(value),
      count: playability.byStatus[value],
      textClassName: MACHINE_STATUS_COLORS[value].text,
      fillClassName: MACHINE_STATUS_COLORS[value].fill,
    }));
  const playabilityText = `of ${playability.onTheFloor} playable`;
  const playableAccent = MACHINE_STATUS_COLORS.operational.text;

  // The Playability headline (machine-widgets §2.4).
  const summaryRow = (
    <>
      <span className={cn("font-semibold tabular-nums", playableAccent)}>
        {playable}
      </span>{" "}
      {playabilityText}
    </>
  );

  return (
    <SummaryWidgetGroup
      storageKey={STORAGE_KEY}
      summaryRow={summaryRow}
      widgetCount={2}
    >
      <SummaryWidget
        id="machine-widget-presence"
        label="Presence"
        headline={{
          figure: presence.byPresence.on_the_floor,
          text: `on the floor of ${presence.total} ${plural(presence.total, "machine", "machines")}`,
          accentClassName: MACHINE_PRESENCE_WIDGET_COLORS.on_the_floor.text,
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
        headline={{
          figure: playable,
          text: playabilityText,
          accentClassName: playableAccent,
        }}
        segments={playabilitySegments}
        selectedValue={
          soleValue(state.presence) === "on_the_floor"
            ? soleValue(state.status)
            : null
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
    </SummaryWidgetGroup>
  );
}
