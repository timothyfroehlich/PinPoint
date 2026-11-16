import type React from "react";
import type { CollectionSummary } from "~/lib/collections/summary";

interface Props {
  title: string;
  /** Line above the title, e.g. a tag's breadcrumb. */
  eyebrow?: React.ReactNode;
  summary: CollectionSummary;
  /** The page actions (4.14), which fill the rest of the row. */
  action?: React.ReactNode;
}

function plural(n: number, word: string): string {
  return `${String(n)} ${word}${n === 1 ? "" : "s"}`;
}

export function CollectionHeader({
  title,
  eyebrow,
  summary,
  action,
}: Props): React.JSX.Element {
  const parts: string[] = [
    summary.total === 0 ? "No machines" : plural(summary.total, "machine"),
  ];
  if (summary.total > 0) {
    parts.push(`${String(summary.operational)} operational`);
    if (summary.needsService > 0)
      parts.push(`${String(summary.needsService)} need service`);
    if (summary.unplayable > 0)
      parts.push(`${String(summary.unplayable)} unplayable`);
    parts.push(plural(summary.openIssues, "open issue"));
  }
  return (
    // The title block takes the room its text needs and the page actions
    // fit themselves into what is left, down to a lone ⋯ (list-views §8.11).
    <header className="flex items-center gap-3">
      <div className="min-w-0 flex-[0_1_auto]">
        {eyebrow ? <div className="mb-1">{eyebrow}</div> : null}
        <h1 className="min-w-0 break-words text-2xl font-bold text-foreground sm:text-3xl">
          {title}
        </h1>
        <p
          className="mt-1 text-sm text-muted-foreground"
          data-testid="collection-summary"
        >
          {parts.join(" · ")}
        </p>
      </div>
      {action}
    </header>
  );
}
