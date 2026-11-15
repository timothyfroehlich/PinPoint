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

/** Presence and Playability (machine-widgets §2.1). */
export const MACHINE_SUMMARY_WIDGET_COUNT = 2;

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

/** The value a filter holds when it holds exactly one value, else null. */
function soleValue<T>(values: "all" | T[]): T | null {
  return values !== "all" && values.length === 1 ? (values[0] ?? null) : null;
}

/** Operational and Needs Service machines are playable (machine-widgets §2.4). */
function playableCount(summary: MachineViewSummary): number {
  return (
    summary.playability.byStatus.operational +
    summary.playability.byStatus.needs_service
  );
}

/**
 * The Summary Row: how many On the Floor machines are playable out of all On
 * the Floor machines (machine-widgets §2.4). The `compact` form fits the
 * phone title row (list-views §7.2) as "7/9 playable", read as "7 of 9
 * playable", keeping "playable" only for assistive technology below 360px.
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
          <span aria-hidden="true">
            {playableCount(summary)}/{summary.playability.onTheFloor}
          </span>
          <span className="sr-only">
            {`${playableCount(summary)} of ${summary.playability.onTheFloor}`}
          </span>
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

/**
 * The Presence and Playability widgets on Machine View (machine-widgets
 * spec), always counting the route's whole scope. Segment selection sets
 * Machine View filters, keeping search and the other filters (widgets §6.2).
 */
export function MachineSummaryWidgets({
  summary,
  state,
  onStateChange,
  controller,
}: MachineSummaryWidgetsProps): React.JSX.Element {
  const { presence, playability } = summary;

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

  return (
    <SummaryWidgetGroup
      storageKey={MACHINE_SUMMARY_STORAGE_KEY}
      summaryRow={<MachineSummaryRow summary={summary} />}
      widgetCount={MACHINE_SUMMARY_WIDGET_COUNT}
      controller={controller}
    >
      <SummaryWidget
        id="machine-widget-presence"
        label="Presence"
        segments={presenceSegments}
        selectedValue={soleValue(state.presence)}
        onSegmentSelect={(value) =>
          onStateChange({ ...state, presence: [value], page: 1 })
        }
      />
      <SummaryWidget
        id="machine-widget-playability"
        label="Playability"
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
