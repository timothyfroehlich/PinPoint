import type React from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, CircleAlert, Trophy } from "lucide-react";
import type { MachineForLayout } from "~/app/(app)/m/[initials]/_data";
import { formatCompactAge, formatDate } from "~/lib/dates";
import type { IscoredScore } from "~/lib/iscored/types";
import {
  getIssueSeverityLabel,
  getIssueSeverityStyles,
} from "~/lib/issues/status";

interface MachineScanHubProps {
  machine: {
    initials: string;
    name: string;
    manufacturer: string | null;
    year: number | null;
    owner: { name: string } | null;
    invitedOwner: { name: string } | null;
    iscoredGameId: string | null;
    issues: HubIssue[];
  };
  scores: IscoredScore[];
  scoreHref: string | null;
  gameHref: string | null;
  fromApron: boolean;
}

type HubIssue = Pick<
  MachineForLayout["issues"][number],
  "id" | "severity" | "title" | "createdAt"
>;

const cardClass = "rounded-xl border border-outline-variant bg-card px-4 py-3";
const labelClass =
  "text-[11px] font-bold uppercase tracking-wider text-muted-foreground";

function displayScoreDate(date: string): string {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? date : formatDate(parsed);
}

function IssueRow({ issue }: { issue: HubIssue }): React.JSX.Element {
  return (
    <li className="flex min-h-10 items-center gap-2 border-t border-border/60 text-sm">
      <span
        className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getIssueSeverityStyles(issue.severity)}`}
      >
        {getIssueSeverityLabel(issue.severity)}
      </span>
      <span className="min-w-0 flex-1 truncate">{issue.title}</span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatCompactAge(issue.createdAt)}
      </span>
    </li>
  );
}

export function MachineScanHub({
  machine,
  scores,
  scoreHref,
  gameHref,
  fromApron,
}: MachineScanHubProps): React.JSX.Element {
  const infoHref = `/m/${machine.initials}`;
  const issuesHref = `/m/${machine.initials}/i`;
  const reportHref = `/report?machine=${encodeURIComponent(machine.initials)}${fromApron ? "&source=apron" : ""}`;
  const ownerName = machine.owner?.name ?? machine.invitedOwner?.name;
  const metadata = [
    machine.manufacturer,
    machine.year,
    ownerName ? `Owned by ${ownerName}` : "Owner not listed",
  ].filter(Boolean);
  const openIssues = machine.issues;
  const newestIssue = openIssues[0];

  return (
    <div
      data-machine-scan-hub
      className="mx-auto flex min-h-[calc(100dvh-112px-env(safe-area-inset-bottom))] w-full max-w-[390px] flex-col gap-3 py-4 md:min-h-[calc(100dvh-64px)]"
    >
      <Link
        href={infoHref}
        className="flex min-h-16 items-center gap-2 rounded-lg text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        aria-label={`${machine.name} details`}
      >
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[26px] leading-tight font-extrabold tracking-tight sm:text-3xl">
            {machine.name}
          </h1>
          <p className="truncate text-xs text-muted-foreground sm:text-sm">
            {metadata.join(" · ")}
          </p>
        </div>
        <span className="flex shrink-0 flex-col items-center text-[10px] font-semibold text-muted-foreground">
          <ChevronRight className="size-5" aria-hidden="true" />
          Details
        </span>
      </Link>

      <section className={cardClass} aria-labelledby="hub-scores-heading">
        <div className="flex min-h-6 items-center justify-between gap-2">
          <h2 id="hub-scores-heading" className={labelClass}>
            Top scores
          </h2>
          {gameHref ? (
            <a
              href={gameHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-7 items-center gap-1 text-xs font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label="View all scores on iScored (opens in a new tab)"
            >
              View all on
              <Image
                src="/iscored-logo.svg"
                alt="iScored"
                width={55}
                height={22}
                className="h-[18px] w-auto"
                unoptimized
              />
            </a>
          ) : (
            <Image
              src="/iscored-logo.svg"
              alt="iScored"
              width={55}
              height={22}
              className="h-[18px] w-auto"
              unoptimized
            />
          )}
        </div>
        {!machine.iscoredGameId ? (
          <p className="py-3 text-sm text-muted-foreground">
            No iScored game is linked to this machine.
          </p>
        ) : scores.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">
            No scores recorded yet
          </p>
        ) : (
          <ol className="mt-1">
            {scores.slice(0, 3).map((score) => (
              <li
                key={score.id}
                className="flex min-h-10 items-center gap-3 text-sm"
              >
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${score.rank === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
                >
                  {score.rank}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {score.playerName}
                  </span>
                  {score.date ? (
                    <span className="block text-[11px] leading-3 text-muted-foreground">
                      {displayScoreDate(score.date)}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 font-mono text-sm font-bold tabular-nums">
                  {score.score.toLocaleString("en-US")}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section
        className={`${cardClass} [@media(max-height:700px)]:hidden`}
        aria-labelledby="hub-issues-heading"
      >
        <div className="flex min-h-7 items-center justify-between gap-2">
          <h2 id="hub-issues-heading" className={labelClass}>
            Open issues · {openIssues.length}
          </h2>
          {openIssues.length > 0 ? (
            <Link
              href={issuesHref}
              className="text-xs font-semibold text-primary"
            >
              See all
            </Link>
          ) : null}
        </div>
        {openIssues.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">No open issues</p>
        ) : (
          <ol>
            {openIssues.slice(0, 3).map((issue) => (
              <IssueRow key={issue.id} issue={issue} />
            ))}
          </ol>
        )}
      </section>

      {newestIssue ? (
        <Link
          href={issuesHref}
          className={`${cardClass} hidden text-foreground [@media(max-height:700px)]:block`}
          aria-label={`Open issues: ${openIssues.length}. See all issues for ${machine.name}`}
        >
          <span className={labelClass}>Open issues · {openIssues.length}</span>
          <span className="mt-1 flex min-h-10 items-center gap-2 text-sm">
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getIssueSeverityStyles(newestIssue.severity)}`}
            >
              {getIssueSeverityLabel(newestIssue.severity)}
            </span>
            <span className="min-w-0 flex-1 truncate">{newestIssue.title}</span>
            {openIssues.length > 1 ? (
              <span className="shrink-0 text-xs text-muted-foreground">
                +{openIssues.length - 1} more
              </span>
            ) : null}
          </span>
        </Link>
      ) : (
        <section
          className={`${cardClass} hidden [@media(max-height:700px)]:block`}
          aria-label="Open issues"
        >
          <span className={labelClass}>Open issues · 0</span>
          <p className="mt-1 text-sm text-muted-foreground">No open issues</p>
        </section>
      )}

      <div className="flex-1" aria-hidden="true" />
      <div className="flex gap-2.5 pb-2" aria-label="Machine actions">
        {scoreHref ? (
          <a
            href={scoreHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-[100px] min-w-0 flex-1 flex-col items-center justify-center gap-2 rounded-xl bg-primary text-center text-base font-bold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Trophy className="size-7" aria-hidden="true" />
            Post a score
          </a>
        ) : null}
        <Link
          href={reportHref}
          className="flex h-[100px] min-w-0 flex-1 flex-col items-center justify-center gap-2 rounded-xl bg-warning text-center text-base font-bold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <CircleAlert className="size-7" aria-hidden="true" />
          Report a problem
        </Link>
      </div>
    </div>
  );
}
