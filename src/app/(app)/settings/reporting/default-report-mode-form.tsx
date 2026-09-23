"use client";

import * as React from "react";
import { Button } from "~/components/ui/button";
import { resolveDefaultReportMode } from "~/lib/report/default-mode";
import { REPORT_MODE_VALUES, type ReportMode } from "~/lib/types";
import { cn } from "~/lib/utils";
import {
  updateDefaultReportModeAction,
  type UpdateDefaultReportModeResult,
} from "./actions";

const MODE_DETAILS: Record<ReportMode, { label: string; description: string }> =
  {
    quick: {
      label: "Quick report",
      description: "A few details for one issue.",
    },
    detailed: {
      label: "Detailed report",
      description: "The full form for one issue.",
    },
    multiple: {
      label: "Multiple issues",
      description: "Prepare several issues together.",
    },
  };

export function DefaultReportModeForm({
  initialMobileMode,
  initialDesktopMode,
  canMultiple,
}: {
  initialMobileMode: ReportMode;
  initialDesktopMode: ReportMode;
  canMultiple: boolean;
}): React.JSX.Element {
  const availableMobileMode = resolveDefaultReportMode(
    initialMobileMode,
    canMultiple,
    "quick"
  );
  const availableDesktopMode = resolveDefaultReportMode(
    initialDesktopMode,
    canMultiple,
    "detailed"
  );
  const [selectedMobileMode, setSelectedMobileMode] =
    React.useState(availableMobileMode);
  const [selectedDesktopMode, setSelectedDesktopMode] =
    React.useState(availableDesktopMode);
  const [state, setState] = React.useState<UpdateDefaultReportModeResult>();
  const [isPending, setIsPending] = React.useState(false);
  const savedMobileMode = state?.ok
    ? state.value.mobileMode
    : availableMobileMode;
  const savedDesktopMode = state?.ok
    ? state.value.desktopMode
    : availableDesktopMode;
  const availableModes = REPORT_MODE_VALUES.filter(
    (mode) => mode !== "multiple" || canMultiple
  );

  React.useEffect(() => {
    setSelectedMobileMode(availableMobileMode);
    setSelectedDesktopMode(availableDesktopMode);
  }, [availableMobileMode, availableDesktopMode]);

  React.useEffect(() => {
    if (!state?.ok) return;
    setSelectedMobileMode(state.value.mobileMode);
    setSelectedDesktopMode(state.value.desktopMode);
  }, [state]);

  async function saveReportModes(): Promise<void> {
    const formData = new FormData();
    formData.set("mobileReportMode", selectedMobileMode);
    formData.set("desktopReportMode", selectedDesktopMode);
    setIsPending(true);
    try {
      setState(await updateDefaultReportModeAction(undefined, formData));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="@container space-y-5">
      {(
        [
          {
            key: "mobile",
            label: "Mobile bottom bar",
            help: "Opens when you tap Report in the bottom bar.",
            selectedMode: selectedMobileMode,
            setSelectedMode: setSelectedMobileMode,
          },
          {
            key: "desktop",
            label: "Tablet and desktop header",
            help: "Opens when you select Report in the header.",
            selectedMode: selectedDesktopMode,
            setSelectedMode: setSelectedDesktopMode,
          },
        ] as const
      ).map((surface) => (
        <fieldset
          key={surface.key}
          aria-describedby={`report-mode-${surface.key}-help`}
          disabled={isPending}
          className="space-y-2"
        >
          <legend
            id={`report-mode-${surface.key}-label`}
            className="text-base font-medium"
          >
            {surface.label}
          </legend>
          <p
            id={`report-mode-${surface.key}-help`}
            className="text-sm text-muted-foreground"
          >
            {surface.help}
          </p>
          <div
            role="radiogroup"
            aria-labelledby={`report-mode-${surface.key}-label`}
            aria-describedby={`report-mode-${surface.key}-help`}
            className="grid gap-2 @sm:grid-cols-2 @2xl:grid-cols-3"
          >
            {availableModes.map((mode, index) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={surface.selectedMode === mode}
                tabIndex={surface.selectedMode === mode ? 0 : -1}
                data-report-mode={mode}
                onClick={() => surface.setSelectedMode(mode)}
                onKeyDown={(event) => {
                  const direction =
                    event.key === "ArrowRight" || event.key === "ArrowDown"
                      ? 1
                      : event.key === "ArrowLeft" || event.key === "ArrowUp"
                        ? -1
                        : 0;
                  const nextIndex =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? availableModes.length - 1
                        : direction === 0
                          ? -1
                          : (index + direction + availableModes.length) %
                            availableModes.length;
                  if (nextIndex < 0) return;
                  event.preventDefault();
                  const nextMode = availableModes[nextIndex];
                  if (!nextMode) return;
                  surface.setSelectedMode(nextMode);
                  event.currentTarget.parentElement
                    ?.querySelector<HTMLButtonElement>(
                      `[data-report-mode="${nextMode}"]`
                    )
                    ?.focus();
                }}
                className={cn(
                  "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-left",
                  surface.selectedMode === mode
                    ? "border-primary bg-primary/10"
                    : "border-outline-variant hover:border-primary/60"
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border",
                    surface.selectedMode === mode
                      ? "border-primary"
                      : "border-muted-foreground"
                  )}
                >
                  {surface.selectedMode === mode ? (
                    <span className="size-2 rounded-full bg-primary" />
                  ) : null}
                </span>
                <span className="grid gap-0.5">
                  <span className="font-medium">
                    {MODE_DETAILS[mode].label}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {MODE_DETAILS[mode].description}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>
      ))}

      {state && !state.ok ? (
        <p role="alert" className="text-sm text-destructive-text">
          {state.message}
        </p>
      ) : null}
      {state?.ok &&
      selectedMobileMode === savedMobileMode &&
      selectedDesktopMode === savedDesktopMode ? (
        <p role="status" className="text-sm text-muted-foreground">
          Report screens saved.
        </p>
      ) : null}

      <Button
        type="button"
        onClick={saveReportModes}
        disabled={
          isPending ||
          (selectedMobileMode === savedMobileMode &&
            selectedDesktopMode === savedDesktopMode)
        }
        loading={isPending}
      >
        Save report screens
      </Button>
    </div>
  );
}
