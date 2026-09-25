"use client";

import * as React from "react";
import { resolveDefaultReportMode } from "~/lib/report/default-mode";
import { REPORT_MODE_VALUES, type ReportMode } from "~/lib/types";
import { cn } from "~/lib/utils";
import { updateDefaultReportModeAction } from "./actions";

const MODE_LABELS: Record<ReportMode, string> = {
  quick: "Quick",
  detailed: "Detailed",
  multiple: "Multiple",
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
  const initialModes = {
    mobileMode: availableMobileMode,
    desktopMode: availableDesktopMode,
  };
  const [selectedModes, setSelectedModes] = React.useState(initialModes);
  const [saveStatus, setSaveStatus] = React.useState<
    "idle" | "saving" | "saved"
  >("idle");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const saveInFlight = React.useRef(false);
  const hasInteracted = React.useRef(false);
  const desiredModes = React.useRef(initialModes);
  const savedModes = React.useRef(initialModes);
  // Mirrors savedModes for rendering: a selection the server has not yet
  // confirmed is drawn muted until this catches up.
  const [confirmedModes, setConfirmedModes] = React.useState(initialModes);
  const availableModes = REPORT_MODE_VALUES.filter(
    (mode) => mode !== "multiple" || canMultiple
  );

  React.useEffect(() => {
    if (hasInteracted.current) return;
    const modes = {
      mobileMode: availableMobileMode,
      desktopMode: availableDesktopMode,
    };
    desiredModes.current = modes;
    savedModes.current = modes;
    setSelectedModes(modes);
    setConfirmedModes(modes);
  }, [availableMobileMode, availableDesktopMode]);

  async function flushSelections(): Promise<void> {
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    try {
      while (
        desiredModes.current.mobileMode !== savedModes.current.mobileMode ||
        desiredModes.current.desktopMode !== savedModes.current.desktopMode
      ) {
        const submittingModes = desiredModes.current;
        const formData = new FormData();
        formData.set("mobileReportMode", submittingModes.mobileMode);
        formData.set("desktopReportMode", submittingModes.desktopMode);
        let failureMessage: string;
        try {
          const result = await updateDefaultReportModeAction(
            undefined,
            formData
          );
          if (result.ok) {
            savedModes.current = result.value;
            setConfirmedModes(result.value);
            if (desiredModes.current === submittingModes) {
              desiredModes.current = result.value;
              setSelectedModes(result.value);
            }
            continue;
          }
          failureMessage = result.message;
        } catch {
          failureMessage = "Could not save your preference. Try again.";
        }
        // A newer choice arrived while this save was in flight; it carries
        // this one too, so submit it rather than discarding it.
        if (desiredModes.current !== submittingModes) continue;
        desiredModes.current = savedModes.current;
        setSelectedModes(savedModes.current);
        setSaveStatus("idle");
        setErrorMessage(failureMessage);
        return;
      }
      setSaveStatus("saved");
    } finally {
      saveInFlight.current = false;
    }
  }

  function selectMode(surface: "mobile" | "desktop", mode: ReportMode): void {
    const nextModes = {
      ...desiredModes.current,
      [surface === "mobile" ? "mobileMode" : "desktopMode"]: mode,
    };
    desiredModes.current = nextModes;
    hasInteracted.current = true;
    setSelectedModes(nextModes);
    setSaveStatus("saving");
    setErrorMessage(null);
    void flushSelections();
  }

  return (
    <div className="@container flex flex-col gap-1">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
        Default Report Form
      </h3>
      {(
        [
          {
            key: "mobile",
            label: "Mobile",
            selectedMode: selectedModes.mobileMode,
            confirmedMode: confirmedModes.mobileMode,
          },
          {
            key: "desktop",
            label: "Desktop / Tablet",
            selectedMode: selectedModes.desktopMode,
            confirmedMode: confirmedModes.desktopMode,
          },
        ] as const
      ).map((surface) => (
        <fieldset
          key={surface.key}
          aria-busy={surface.selectedMode !== surface.confirmedMode}
          className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-x-1 @sm:gap-x-2"
        >
          <legend className="sr-only">{surface.label} report form</legend>
          <span aria-hidden="true" className="text-xs font-medium @sm:text-sm">
            {surface.label}:
          </span>
          <div className="flex flex-wrap items-center gap-x-1 @sm:gap-x-2">
            {availableModes.map((mode) => (
              <label
                key={mode}
                htmlFor={`report-mode-${surface.key}-${mode}`}
                className="flex min-h-11 cursor-pointer items-center gap-1 rounded-md px-0.5 text-sm hover:bg-muted/50 @sm:gap-1.5 @sm:px-1"
              >
                <input
                  id={`report-mode-${surface.key}-${mode}`}
                  type="radio"
                  name={`${surface.key}ReportMode`}
                  value={mode}
                  checked={surface.selectedMode === mode}
                  onChange={() => selectMode(surface.key, mode)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-150 motion-reduce:transition-none peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
                    surface.selectedMode === mode &&
                      surface.confirmedMode === mode
                      ? "border-primary"
                      : "border-muted-foreground"
                  )}
                >
                  {/* Muted until the server confirms the choice, then green. */}
                  {surface.selectedMode === mode ? (
                    <span
                      className={cn(
                        "size-2 rounded-full transition-colors duration-150 motion-reduce:transition-none",
                        surface.confirmedMode === mode
                          ? "bg-primary"
                          : "bg-muted-foreground"
                      )}
                    />
                  ) : null}
                </span>
                <span>{MODE_LABELS[mode]}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      {/* Sighted users read save progress from the radio color; this
          visually hidden live region announces it to screen readers. */}
      <p role="status" className="sr-only">
        {saveStatus === "saving"
          ? "Saving…"
          : saveStatus === "saved"
            ? "Saved"
            : null}
      </p>
      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive-text">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
