import type React from "react";

export function PreBetaBanner(): React.JSX.Element {
  return (
    <div
      role="alert"
      className="flex w-full items-center justify-center gap-3 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-900 border-b border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-900"
    >
      <p className="text-center text-sm font-medium text-on-secondary-container">
        🚧 PinPoint Pre-Beta Notice: Development in progress. Database resets
        may occur.
      </p>
    </div>
  );
}
