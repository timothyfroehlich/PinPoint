import type React from "react";
import { IssueBadge } from "~/components/issues/IssueBadge";
import { ISSUE_STATUS_VALUES } from "~/lib/issues/status";
import type { IssueSeverity, IssuePriority, IssueFrequency } from "~/lib/types";

export default function BadgeDebugPage(): React.JSX.Element {
  const severities: IssueSeverity[] = [
    "cosmetic",
    "minor",
    "major",
    "unplayable",
  ];
  const priorities: IssuePriority[] = ["low", "medium", "high"];
  const frequencies: IssueFrequency[] = [
    "intermittent",
    "frequent",
    "constant",
  ];

  return (
    <div className="py-8 space-y-12 bg-background min-h-screen">
      <div className="space-y-2 text-center">
        <h1 className="text-4xl font-bold">Issue Badge System</h1>
        <p className="text-muted-foreground">
          Standardized badges with fixed width (120px) and vibrant colors.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
        {/* Statuses Section */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold border-b pb-2 flex items-center gap-2">
            Status Variations
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ISSUE_STATUS_VALUES.map((status) => {
              return (
                <div
                  key={status}
                  className="flex items-center gap-3 bg-surface p-2 rounded-lg border border-outline-variant"
                >
                  <IssueBadge type="status" value={status} />
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {status}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <div className="space-y-8">
          {/* Severities Section */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold border-b pb-2 text-amber-500">
              Severity Variations
            </h2>
            <div className="flex flex-col gap-3">
              {severities.map((severity) => {
                return (
                  <div
                    key={severity}
                    className="flex items-center gap-3 bg-surface p-2 rounded-lg border border-outline-variant"
                  >
                    <IssueBadge type="severity" value={severity} />
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {severity}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Priorities Section */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold border-b pb-2 text-purple-500">
              Priority Variations
            </h2>
            <div className="flex flex-col gap-3">
              {priorities.map((priority) => {
                return (
                  <div
                    key={priority}
                    className="flex items-center gap-3 bg-surface p-2 rounded-lg border border-outline-variant"
                  >
                    <IssueBadge type="priority" value={priority} />
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {priority}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Frequencies Section */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold border-b pb-2 text-cyan-500">
              Frequency Variations
            </h2>
            <div className="flex flex-col gap-3">
              {frequencies.map((frequency) => {
                return (
                  <div
                    key={frequency}
                    className="flex items-center gap-3 bg-surface p-2 rounded-lg border border-outline-variant"
                  >
                    <IssueBadge type="frequency" value={frequency} />
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {frequency}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
