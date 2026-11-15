import type React from "react";
import type { CollectionSummary } from "~/lib/collections/summary";

interface Props {
  title: string;
  /** Line above the title, e.g. a tag's breadcrumb. */
  eyebrow?: React.ReactNode;
  summary: CollectionSummary;
  /** Action slot rendered to the right of the title/count block. */
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
    // The title block keeps at least 16rem; when the actions can't fit beside
    // it (phones), they wrap onto their own row instead of squeezing the
    // title and summary to a word per line.
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 flex-[1_1_16rem]">
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
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
