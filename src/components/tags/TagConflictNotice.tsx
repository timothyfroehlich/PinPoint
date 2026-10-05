import type React from "react";
import Link from "next/link";
import type { TagConflictMachine } from "~/lib/tags/types";

interface TagConflictNoticeProps {
  /** Why the change is blocked, announced as an alert. */
  message: string;
  /** The machines in the way, each with its tags of the tag type. */
  machines?: readonly TagConflictMachine[];
  /** What to do about it; shown under the machines. */
  help?: string;
}

/**
 * Why a tag type cannot be made exclusive (spec 11.7) or a tag cannot move
 * (11.16), with the machines that block it.
 */
export function TagConflictNotice({
  message,
  machines = [],
  help,
}: TagConflictNoticeProps): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p role="alert" className="text-sm font-medium text-destructive-text">
        {message}
      </p>
      {machines.length > 0 ? (
        <ul className="max-h-60 divide-y divide-outline-variant overflow-y-auto overscroll-contain rounded-lg border border-outline-variant">
          {machines.map((machine) => (
            <li
              key={machine.initials}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 px-3 py-2.5 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Link
                  href={`/m/${machine.initials}`}
                  className="truncate font-medium text-primary hover:underline"
                >
                  {machine.name}
                </Link>
                {/* Names repeat (three Godzillas); initials tell them apart. */}
                <span className="shrink-0 rounded border border-outline-variant px-1.5 text-[11px] font-semibold text-muted-foreground">
                  {machine.initials}
                </span>
              </span>
              <span className="min-w-0 text-muted-foreground">
                {machine.tags.join(", ")}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {help !== undefined ? (
        <p className="text-[13px] text-muted-foreground">{help}</p>
      ) : null}
    </div>
  );
}
