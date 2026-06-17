"use client";

import type React from "react";
import { formatCompactAge } from "~/lib/dates";
import { useRelativeNow } from "./RelativeTimeProvider";

interface CompactAgeProps {
  value: Date | string;
  /** Pre-mount / SSR label. Empty by default so the cell stays blank until the
   *  shared ticker provides a `now` — keeps SSR and hydration in agreement
   *  without a locale-dependent fallback. */
  fallback?: string;
}

/**
 * Compact elapsed-age label ("2mo 5d") for dense tables, sharing the
 * {@link RelativeTimeProvider} ticker so SSR and hydration agree (renders the
 * fallback until the provider's first tick, then the computed age).
 */
export function CompactAge({
  value,
  fallback = "",
}: CompactAgeProps): React.JSX.Element {
  const now = useRelativeNow();
  if (now === null) {
    return <>{fallback}</>;
  }

  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return <>{fallback}</>;
  }

  return <>{formatCompactAge(date, now)}</>;
}
