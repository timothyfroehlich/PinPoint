import type React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ExternalLink, Plus, Trophy } from "lucide-react";
import { Button } from "~/components/ui/button";
import { formatDate } from "~/lib/dates";
import { getGameroomUrl, getGameUrl, getScoreEntryUrl } from "~/lib/iscored";
import type { IscoredScore } from "~/lib/iscored/types";

export interface TopScoresCardProps {
  /** The machine's linked iScored game ID string, or null if unlinked. */
  iscoredGameId: string | null;
  /** Top scores (up to 3) for this machine. */
  scores: IscoredScore[];
  /**
   * Internal URL to the Manage tab (e.g. `/m/[initials]/edit`), or null
   * if the current viewer is not authorized to access Manage.
   */
  manageHref: string | null;
}

const CARD =
  "rounded-xl border border-outline-variant bg-card p-4 overflow-hidden";
const UNLINKED_CARD =
  "rounded-xl border border-dashed border-secondary/50 bg-card p-4 overflow-hidden";
const LABEL =
  "text-[10px] font-bold uppercase tracking-wider text-muted-foreground";

function formatScoreDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return formatDate(d);
  } catch {
    return dateStr;
  }
}

/**
 * TopScoresCard — displays the top 3 high scores for a machine in the Info tab's
 * reference rail (Spec §4).
 *
 * Supports four states:
 * 1. Linked with scores: Displays top 3 ranked rows, "Add score" button, and "View all on iScored" link.
 * 2. Linked without scores: Quiet empty state with trophy icon, "Add score" button, and "View all on iScored" link.
 * 3. Unlinked (manager): Dashed card with "Not linked to iScored." and "Link it on Manage →" link.
 * 4. Unlinked (guest): Dashed card with "Not linked to iScored." message only.
 */
export function TopScoresCard({
  iscoredGameId,
  scores,
  manageHref,
}: TopScoresCardProps): React.JSX.Element {
  const isLinked = Boolean(iscoredGameId && iscoredGameId.trim().length > 0);
  const scoreEntryUrl = iscoredGameId ? getScoreEntryUrl(iscoredGameId) : null;
  const gameUrl = iscoredGameId ? getGameUrl(iscoredGameId) : null;
  const externalIscoredUrl = gameUrl ?? getGameroomUrl();

  const headerLogo =
    isLinked && externalIscoredUrl ? (
      <a
        href={externalIscoredUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="View on iScored"
        className="inline-flex shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xs"
        data-testid="iscored-logo-link"
      >
        <Image
          src="/iscored-logo.svg"
          alt="iScored"
          width={55}
          height={22}
          className="h-[22px] w-auto block"
          unoptimized
        />
      </a>
    ) : (
      <span
        className="inline-flex shrink-0"
        data-testid="iscored-logo-decorative"
      >
        <Image
          src="/iscored-logo.svg"
          alt="iScored"
          width={55}
          height={22}
          className="h-[22px] w-auto block"
          unoptimized
        />
      </span>
    );

  // State 3 & 4: Unlinked
  if (!isLinked) {
    return (
      <section
        aria-label="Top scores"
        className={UNLINKED_CARD}
        data-testid="machine-top-scores-card"
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className={`m-0 leading-tight ${LABEL}`}>Top scores</p>
          {headerLogo}
        </div>
        <p className="mt-2 text-sm text-muted-foreground leading-snug">
          Not linked to iScored.
        </p>
        {manageHref ? (
          <Link
            href={manageHref}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            data-testid="iscored-link-manage"
          >
            Link it on Manage{" "}
            <ArrowRight className="size-3" aria-hidden="true" />
          </Link>
        ) : null}
      </section>
    );
  }

  // State 2: Linked, no scores recorded yet
  if (scores.length === 0) {
    return (
      <section
        aria-label="Top scores"
        className={CARD}
        data-testid="machine-top-scores-card"
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className={`m-0 leading-tight ${LABEL}`}>Top scores</p>
          {headerLogo}
        </div>
        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground leading-snug">
          <Trophy
            className="size-5 text-muted-foreground/60 shrink-0"
            aria-hidden="true"
          />
          No scores recorded yet
        </p>
        <div className="flex items-center justify-between gap-3 pt-3">
          {scoreEntryUrl ? (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="gap-1.5 shadow-xs border-outline bg-surface text-foreground"
            >
              <a
                href={scoreEntryUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="iscored-add-score-btn"
              >
                <Plus className="size-4" aria-hidden="true" />
                Add score
                <ExternalLink className="size-4" aria-hidden="true" />
              </a>
            </Button>
          ) : null}
          {externalIscoredUrl ? (
            <a
              href={externalIscoredUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline ml-auto"
              data-testid="iscored-view-all-link"
            >
              View all on iScored{" "}
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </section>
    );
  }

  // State 1: Linked with scores
  return (
    <section
      aria-label="Top scores"
      className={CARD}
      data-testid="machine-top-scores-card"
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className={`m-0 leading-tight ${LABEL}`}>Top scores</p>
        {headerLogo}
      </div>

      <ol
        className="list-none m-0 p-0 flex flex-col"
        data-testid="iscored-scores-list"
      >
        {scores.slice(0, 3).map((score) => {
          const isRank1 = score.rank === 1;
          const isRank2 = score.rank === 2;

          return (
            <li
              key={score.id || `${score.gameId}-${score.rank}`}
              className={`flex items-center gap-3 py-2.5 px-4 -mx-4 border-b border-border ${
                isRank1 ? "bg-primary/[0.06]" : "bg-transparent"
              }`}
              data-testid={`iscored-score-row-${score.rank}`}
            >
              <span
                className={`size-7 rounded-full inline-flex items-center justify-center font-mono tabular-nums text-xs font-bold shrink-0 ${
                  isRank1
                    ? "bg-primary text-primary-foreground"
                    : isRank2
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-muted text-foreground"
                }`}
              >
                {score.rank}
              </span>

              <div className="min-w-0 flex-1 flex flex-col">
                <span className="truncate text-foreground text-sm font-semibold leading-tight">
                  {score.playerName}
                </span>
                {score.date ? (
                  <span className="text-[11px] text-muted-foreground leading-4 mt-0.5">
                    {formatScoreDate(score.date)}
                  </span>
                ) : null}
              </div>

              <span
                className={`shrink-0 font-mono tabular-nums font-bold ${
                  isRank1
                    ? "text-lg text-primary"
                    : "text-[15px] text-foreground"
                }`}
              >
                {score.score.toLocaleString("en-US")}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="flex items-center justify-between gap-3 pt-3">
        {scoreEntryUrl ? (
          <Button
            variant="outline"
            size="sm"
            asChild
            className="gap-1.5 shadow-xs border-outline bg-surface text-foreground"
          >
            <a
              href={scoreEntryUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="iscored-add-score-btn"
            >
              <Plus className="size-4" aria-hidden="true" />
              Add score
              <ExternalLink className="size-4" aria-hidden="true" />
            </a>
          </Button>
        ) : null}
        {externalIscoredUrl ? (
          <a
            href={externalIscoredUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline ml-auto"
            data-testid="iscored-view-all-link"
          >
            View all on iScored{" "}
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </section>
  );
}
