import type React from "react";

export function PreBetaBanner(): React.JSX.Element {
  return (
    <div
      role="alert"
      className="flex w-full items-center justify-center gap-3 bg-blue-950 px-4 py-3 text-sm font-medium text-blue-200 border-b border-blue-900"
    >
      <p className="text-center">
        🚧 PinPoint Pre-Beta Notice: Development in progress. Database resets
        may occur.
      </p>
    </div>
  );
}
