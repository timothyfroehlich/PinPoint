"use client";

import * as React from "react";

export interface MeasuredWidths {
  /** The container's inner width. */
  available: number;
  /** Each `[data-measure]` element's width, keyed by its attribute value. */
  widths: Readonly<Record<string, number>>;
}

function sameMeasurements(
  left: MeasuredWidths | null,
  right: MeasuredWidths
): boolean {
  if (!left || left.available !== right.available) return false;
  const leftKeys = Object.keys(left.widths);
  const rightKeys = Object.keys(right.widths);
  return (
    leftKeys.length === rightKeys.length &&
    rightKeys.every((key) => left.widths[key] === right.widths[key])
  );
}

function innerWidth(element: HTMLElement): number {
  const style = getComputedStyle(element);
  return (
    element.getBoundingClientRect().width -
    parseFloat(style.paddingLeft || "0") -
    parseFloat(style.paddingRight || "0")
  );
}

/**
 * Measures a container and the controls in its hidden measurement lane, so a
 * component can decide which controls stay inline and which move into an
 * overflow menu (list-views §8). This is the CORE-RESP-002 boundary pattern
 * RouteTabStrip uses: component-local ResizeObserver geometry that derives
 * menu membership, never viewport detection, and never styling CSS can do.
 * Returns null until the first measurement, so the server render and the
 * first client render agree.
 *
 * `contentKey` changes whenever the lane's content changes (labels, values),
 * so the observers re-attach to the new elements.
 */
export function useMeasuredWidths(
  containerRef: React.RefObject<HTMLElement | null>,
  laneRef: React.RefObject<HTMLElement | null>,
  contentKey: string
): MeasuredWidths | null {
  const [measured, setMeasured] = React.useState<MeasuredWidths | null>(null);

  React.useLayoutEffect(() => {
    const container = containerRef.current;
    const lane = laneRef.current;
    if (!container || !lane) return;
    const items = Array.from(
      lane.querySelectorAll<HTMLElement>("[data-measure]")
    );
    const measure = (): void => {
      const widths: Record<string, number> = {};
      for (const item of items) {
        const key = item.dataset["measure"];
        if (key) widths[key] = Math.ceil(item.getBoundingClientRect().width);
      }
      const next = { available: Math.floor(innerWidth(container)), widths };
      setMeasured((current) =>
        sameMeasurements(current, next) ? current : next
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    for (const item of items) observer.observe(item);
    return () => observer.disconnect();
  }, [containerRef, laneRef, contentKey]);

  return measured;
}
