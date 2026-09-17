// Fixture: pinpoint/no-unpaired-animate-motion must fire on each bare motion
// utility (animate-spin/animate-pulse/animate-bounce) that lacks its
// motion-reduce:animate-none pairing. Line numbers are asserted by
// src/test/lint/oxlint-fixtures.test.ts.
import { cn } from "~/lib/utils";

export function UnpairedAnimate({ busy }: { busy: boolean }) {
  return (
    <div>
      <span className="size-4 animate-spin" />
      <span className={cn("animate-pulse", busy && "opacity-50")} />
      <span className={`size-4 animate-bounce ${busy ? "opacity-50" : ""}`} />
      <span className="md:animate-spin" />
    </div>
  );
}
