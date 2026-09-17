// Negative fixture: every animate utility is paired with
// motion-reduce:animate-none, motion-safe-gated, or is not one of the three
// bare motion utilities — and the last two cases carry a bare animate string in
// a NON-class position, which the rule must not inspect. So
// pinpoint/no-unpaired-animate-motion must stay silent. Must produce zero
// diagnostics.
import { cn } from "~/lib/utils";

// A non-class-merge helper: its string argument is not a class list, so the
// rule must not treat it as one even in className position.
function iconClass(name: string): string {
  return `${name} motion-reduce:animate-none`;
}

export function PairedAnimate({
  busy,
  label,
}: {
  busy: boolean;
  label: string;
}) {
  return (
    <div>
      <span className="size-4 animate-spin motion-reduce:animate-none" />
      <span
        className={cn(
          "animate-pulse motion-reduce:animate-none",
          busy && "opacity-50"
        )}
      />
      <span
        className={`animate-bounce ${busy ? "opacity-50" : ""} motion-reduce:animate-none`}
      />
      <span className="motion-safe:animate-spin" />
      <span className="md:animate-pulse md:motion-reduce:animate-none" />
      <span className="animate-none transition-none" />
      {/* Non-merge call in className position: the argument is not a class list. */}
      <span className={iconClass("animate-spin")} />
      {/* Comparison operand inside a merge call is a value, not a class. */}
      <span className={cn("gap-2", label === "animate-spin" && "font-bold")} />
    </div>
  );
}
