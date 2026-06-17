import type React from "react";
import type { CollectionSummary } from "~/lib/collections/summary";

interface Props {
  title: string;
  summary: CollectionSummary;
}

function plural(n: number, word: string): string {
  return `${String(n)} ${word}${n === 1 ? "" : "s"}`;
}

export function CollectionHeader({ title, summary }: Props): React.JSX.Element {
  const parts: string[] = [plural(summary.total, "machine")];
  if (summary.total > 0) {
    parts.push(`${String(summary.operational)} operational`);
    if (summary.needsService > 0)
      parts.push(`${String(summary.needsService)} need service`);
    if (summary.unplayable > 0)
      parts.push(`${String(summary.unplayable)} unplayable`);
    parts.push(plural(summary.openIssues, "open issue"));
  }
  return (
    <header>
      <h1 className="min-w-0 truncate text-2xl font-bold text-foreground sm:text-3xl">
        {title}
      </h1>
      <p
        className="mt-1 text-sm text-muted-foreground"
        data-testid="collection-summary"
      >
        {parts.join(" · ")}
      </p>
    </header>
  );
}
