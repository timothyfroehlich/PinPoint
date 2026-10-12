import * as React from "react";
import { cn } from "~/lib/utils";
import { SUMMARY_WIDGET_SLOT_CLASSES } from "./layout";

interface SummaryWidgetGroupProps {
  /** The host's Summary Widgets, in its widgets spec's order (§2.1). */
  children: React.ReactNode;
}

/**
 * Lays out a host's Summary Widgets (widgets spec §2): side by side in one
 * row at every width, each at least 240px wide, always expanded, with no
 * collapse control (§2.3). When they do not all fit, whole widgets drop from
 * the right until the rest do (§2.7); when not even one fits, the group is
 * not shown. At md+ the row sits in one card; on phones it runs bare.
 */
export function SummaryWidgetGroup({
  children,
}: SummaryWidgetGroupProps): React.JSX.Element {
  const widgets = React.Children.toArray(children);
  return (
    // Two query containers: the outer one hides the whole group when not
    // even one widget fits, and the row inside the card is what the slots
    // measure, so the card's padding stays out of their thresholds. (Phones
    // have no card, so there both widths are the same.)
    <div className="@container">
      <div className="hidden @min-[240px]:block md:rounded-lg md:border md:border-border md:bg-card md:px-4 md:py-2">
        <div className="@container">
          <div className="flex gap-6">
            {widgets.map((widget, index) => (
              <div
                key={React.isValidElement(widget) ? widget.key : index}
                className={cn(
                  "min-w-0 flex-1 basis-60",
                  // Every host shows two or three widgets; a widget past
                  // the last slot would be outside the spec, so it never
                  // shows.
                  SUMMARY_WIDGET_SLOT_CLASSES[index] ?? "hidden"
                )}
              >
                {widget}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
