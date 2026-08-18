"use client";

import type React from "react";
import { useId } from "react";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

/**
 * The on/off control for an integration section, rendered on the section's
 * heading line via `IntegrationSection`'s `action` slot rather than stranded at
 * the bottom of the body.
 *
 * Both sections use it, so the rule is one rule: a toggle that governs a whole
 * section lives on that section's heading line.
 *
 * `disabledReason` is rendered as **visible text**, not a `title` tooltip.
 * CORE-A11Y-005 forbids `title` as a tooltip, and a disabled control whose only
 * explanation is a hover string is unreachable by touch and is not reliably
 * announced. The text is tied to the switch with `aria-describedby`, so the
 * reason reaches a screen reader with the control (WCAG 3.3.2).
 */
export function SectionToggle({
  id,
  checked,
  onCheckedChange,
  disabledReason,
  onLabel = "Enabled",
  offLabel = "Disabled",
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  /** When set, the switch cannot be turned on and this is shown beneath it. */
  disabledReason?: string | undefined;
  onLabel?: string;
  offLabel?: string;
}): React.JSX.Element {
  const reasonId = useId();
  // Turning OFF is always allowed; only turning ON is gated.
  const locked = !!disabledReason && !checked;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2.5">
        <Label
          htmlFor={id}
          className="text-xs font-medium text-muted-foreground"
        >
          {checked ? onLabel : offLabel}
        </Label>
        <Switch
          id={id}
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={locked}
          aria-describedby={locked ? reasonId : undefined}
        />
      </div>
      {locked && (
        <p
          id={reasonId}
          className="max-w-[220px] text-pretty text-right text-[11px] leading-snug text-muted-foreground"
        >
          {disabledReason}
        </p>
      )}
    </div>
  );
}
