"use client";

import type React from "react";
import {
  SummaryWidget,
  SummaryWidgetGroup,
  type SummaryWidgetSegment,
  type SummaryWidgetsController,
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

/** Browser storage key for the Machines widgets' expanded choice (widgets §2.6). */
export const MACHINE_SUMMARY_STORAGE_KEY = "pinpoint:summary-widgets:machines";

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
  /** Shares the expanded state with a Summary Row toggle in the title row. */
  controller?: SummaryWidgetsController | undefined;
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
function playableCount(summary: MachineViewSummary): number {
  return (
    summary.playability.byStatus.operational +
    summary.playability.byStatus.needs_service
  );
}

/**
 * The Summary Row: the Playability headline (machine-widgets §2.4). The
 * `compact` form fits the phone title row (list-views §7.2) as "7/9
 * playable", keeping "playable" only for assistive technology below 360px.
 * Its accessible name holds the visible "7/9" (WCAG 2.5.3).
 */
export function MachineSummaryRow({
  summary,
  compact = false,
}: {
  summary: MachineViewSummary;
  compact?: boolean;
}): React.JSX.Element {
  if (compact) {
    return (
      <>
        <span
          className={cn(
            "font-semibold tabular-nums",
            MACHINE_STATUS_COLORS.operational.text
          )}
        >
          {`${playableCount(summary)}/${summary.playability.onTheFloor}`}
        </span>{" "}
        <span className="max-[359px]:sr-only">playable</span>
      </>
    );
  }
  return (
    <>
      <span
        className={cn(
          "font-semibold tabular-nums",
          MACHINE_STATUS_COLORS.operational.text
        )}
      >
        {playableCount(summary)}
      </span>{" "}
      of {summary.playability.onTheFloor} playable
    </>
  );
}

export function MachineSummaryWidgets({
  summary,
  state,
  onStateChange,
  controller,
}: MachineSummaryWidgetsProps): React.JSX.Element {
  const { presence, playability } = summary;
  const playable = playableCount(summary);

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

  return (
    <SummaryWidgetGroup
      storageKey={MACHINE_SUMMARY_STORAGE_KEY}
      summaryRow={<MachineSummaryRow summary={summary} />}
      widgetCount={2}
      controller={controller}
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
