"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { formatRelative } from "~/lib/dates";

interface RelativeTimeProps {
  value: Date | string;
  /** Initial label rendered on the server and during hydration. Avoids a
   *  hydration mismatch from `Date.now()` diverging between server and client. */
  fallback: string;
}

export function RelativeTime({
  value,
  fallback,
}: RelativeTimeProps): React.JSX.Element {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const date = typeof value === "string" ? new Date(value) : value;
    const update = (): void => {
      setLabel(formatRelative(date));
    };
    update();
    const interval = window.setInterval(update, 60_000);
    return () => {
      window.clearInterval(interval);
    };
  }, [value]);

  return <>{label ?? fallback}</>;
}
