import type React from "react";
import { Info } from "lucide-react";

export function PreBetaBanner(): React.JSX.Element {
  return (
    <div
      role="alert"
      className="flex w-full items-center justify-center gap-3 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-900 border-b border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-900"
    >
      <Info className="size-5 shrink-0" aria-hidden="true" />
      <p>
        Pre-Beta Notice (Updated): PinPoint is in active development. Data may
        be reset at any time. Do not rely on this for production tracking.
      </p>
    </div>
  );
}
