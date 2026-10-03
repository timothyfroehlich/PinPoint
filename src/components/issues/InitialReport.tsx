import type React from "react";
import { RichTextDisplay } from "~/components/editor/RichTextDisplay";
import { ImageGallery } from "~/components/images/ImageGallery";
import { ExactRelativeTime } from "~/components/issues/ExactRelativeTime";
import { OwnerBadge } from "~/components/issues/OwnerBadge";
import { PersonHoverCard } from "~/components/people/PersonHoverCard";
import { formatDateTime } from "~/lib/dates";
import { FREQUENCY_CONFIG } from "~/lib/issues/status";
import { isUserMachineOwner } from "~/lib/issues/owner";
import { resolveIssueReporter } from "~/lib/issues/utils";
import type { IssueWithAllRelations } from "~/lib/types";
import { cn } from "~/lib/utils";

/**
 * The initial report (spec issue-detail §5): who reported it and when, the
 * description as plain body text, a frequency line, and the photos.
 */
export function InitialReport({
  issue,
}: {
  issue: IssueWithAllRelations;
}): React.JSX.Element {
  const reporter = resolveIssueReporter(issue);
  const frequency = FREQUENCY_CONFIG[issue.frequency];
  const FrequencyIcon = frequency.icon;

  return (
    <section
      aria-label="Initial report"
      className="space-y-3"
      data-testid="initial-report"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
        <span data-testid="initial-report-reporter">
          {/* Only a real userProfiles.id links; an invited or former reporter
              degrades to plain text. */}
          <PersonHoverCard
            userId={issue.reportedByUser?.id ?? null}
            displayName={reporter.name}
            className="font-semibold text-foreground"
          />
        </span>
        {isUserMachineOwner(issue, reporter.id) && <OwnerBadge size="sm" />}
        <ExactRelativeTime
          value={issue.createdAt.toISOString()}
          fallback={formatDateTime(issue.createdAt)}
          prefix="reported"
          className="text-sm"
        />
      </div>

      {issue.description ? (
        <RichTextDisplay content={issue.description} />
      ) : null}

      <div
        className="flex items-center gap-2 text-sm"
        data-testid="initial-report-frequency"
      >
        <span className="text-muted-foreground">Frequency</span>
        <FrequencyIcon
          className={cn("size-4 shrink-0", frequency.iconColor)}
          aria-hidden="true"
        />
        <span className="font-semibold text-foreground">{frequency.label}</span>
      </div>

      {issue.images.length > 0 ? <ImageGallery images={issue.images} /> : null}
    </section>
  );
}
