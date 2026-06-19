import type React from "react";
import Link from "next/link";

interface OwnedMachinesProps {
  machines: { id: string; initials: string; name: string }[];
  total: number;
  hasMore: boolean;
  ownerId: string;
  openCounts: Map<string, number>;
}

export function OwnedMachines({
  machines,
  total,
  hasMore,
  ownerId,
  openCounts,
}: OwnedMachinesProps): React.JSX.Element | null {
  if (total === 0) return null;
  return (
    <section>
      <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Owned machines · {total}
      </h2>
      <div className="mt-2 grid gap-3 @lg:grid-cols-2">
        {machines.map((m) => {
          const open = openCounts.get(m.initials) ?? 0;
          return (
            <Link
              key={m.id}
              href={`/m/${m.initials}`}
              className="flex items-center gap-3 rounded-xl border border-outline-variant bg-card p-3 transition-[border-color,box-shadow] duration-150 hover:border-primary/50 hover:glow-primary"
            >
              <span className="shrink-0 rounded-lg border border-secondary/30 bg-secondary/15 px-2 py-1 font-mono text-xs font-bold text-secondary">
                {m.initials}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  {m.name}
                </span>
                {open > 0 ? (
                  <span className="text-xs text-muted-foreground">
                    {open} open issue{open === 1 ? "" : "s"}
                  </span>
                ) : null}
              </span>
            </Link>
          );
        })}
      </div>
      <Link
        href={`/c/owner/${ownerId}`}
        className="mt-2 inline-block text-sm text-primary hover:underline"
      >
        {hasMore ? `View all ${total} →` : "View full collection →"}
      </Link>
    </section>
  );
}
