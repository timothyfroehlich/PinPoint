import type React from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, CircleAlert, Trophy } from "lucide-react";
import type {
  MachineArtwork,
  MachineForLayout,
} from "~/app/(app)/m/[initials]/_data";
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
    artwork: MachineArtwork | null;
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

/**
 * Shape of a standard OPDB backglass image, used when Pinball Map reported no
 * dimensions for this one.
 */
const FALLBACK_ARTWORK_RATIO = 444 / 640;

function IdentityLink({
  href,
  name,
  metadata,
  onArtwork,
}: {
  href: string;
  name: string;
  metadata: string;
  onArtwork: boolean;
}): React.JSX.Element {
  return (
    <Link
      href={href}
      className="flex min-h-16 items-center gap-2 rounded-lg text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      aria-label={`${name} details`}
    >
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[26px] leading-tight font-extrabold tracking-tight sm:text-3xl">
          {name}
        </h1>
        <p
          className={`truncate text-xs sm:text-sm ${onArtwork ? "text-foreground/85" : "text-muted-foreground"}`}
        >
          {metadata}
        </p>
      </div>
      <span
        className={`flex shrink-0 flex-col items-center text-[10px] font-semibold ${onArtwork ? "text-foreground/85" : "text-muted-foreground"}`}
      >
        <ChevronRight className="size-5" aria-hidden="true" />
        Details
      </span>
    </Link>
  );
}

/**
 * The artwork band (spec §3.6–§3.7, §5.4). It takes the height the rest of
 * the hub leaves free (`flex-1` from a zero basis), capped at the image's own
 * height at full width, and never below 120px — below that the hub scrolls.
 * When the band is shorter than the image, the image shrinks to fit
 * (`object-contain`) and a blurred copy fills the sides. Below `md` it bleeds
 * 16px past the hub column on each side — viewport-wide on phones, at most
 * 390 + 32 = 422px — so the height cap uses that width; from `md` it is the
 * hub's rounded 390px column.
 */
function ArtworkBand({
  artwork,
  children,
}: {
  artwork: MachineArtwork;
  children: React.ReactNode;
}): React.JSX.Element {
  const ratio =
    artwork.width != null && artwork.height != null
      ? artwork.height / artwork.width
      : FALLBACK_ARTWORK_RATIO;
  const style: React.CSSProperties & Record<"--art-ratio", number> = {
    "--art-ratio": ratio,
  };
  return (
    <figure
      data-testid="hub-artwork-band"
      style={style}
      className="relative m-0 -mx-4 -mt-4 max-h-[calc(min(100vw,422px)*var(--art-ratio))] min-h-[120px] flex-1 basis-0 overflow-hidden bg-card md:mx-0 md:mt-0 md:max-h-[calc(390px*var(--art-ratio))] md:rounded-xl"
    >
      <Image
        src={artwork.url}
        alt=""
        aria-hidden="true"
        fill
        sizes="390px"
        unoptimized
        className="object-cover blur-2xl brightness-50"
      />
      <Image
        src={artwork.url}
        alt=""
        fill
        sizes="(min-width: 768px) 390px, 100vw"
        unoptimized
        priority
        className="object-contain"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-b from-transparent to-background/95"
      />
      <div className="absolute inset-x-4 bottom-1">{children}</div>
      <figcaption className="absolute top-0 right-0 rounded-bl bg-background/90 px-1.5 py-0.5 text-[10px] tracking-wide text-foreground">
        Image: <a href={artwork.url}>OPDB</a>
      </figcaption>
    </figure>
  );
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

  return (
    <div
      data-machine-scan-hub
      className="mx-auto flex min-h-[calc(100dvh-112px-env(safe-area-inset-bottom))] w-full max-w-[390px] flex-col gap-3 py-4 md:min-h-[calc(100dvh-64px)]"
    >
      {machine.artwork != null ? (
        <ArtworkBand artwork={machine.artwork}>
          <IdentityLink
            href={infoHref}
            name={machine.name}
            metadata={metadata.join(" · ")}
            onArtwork
          />
        </ArtworkBand>
      ) : (
        <IdentityLink
          href={infoHref}
          name={machine.name}
          metadata={metadata.join(" · ")}
          onArtwork={false}
        />
      )}

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

      <section className={cardClass} aria-labelledby="hub-issues-heading">
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

      <div className="mt-auto flex gap-2.5 pb-2" aria-label="Machine actions">
        {scoreHref ? (
          <a
            href={scoreHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-[68px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl bg-primary text-center text-base font-bold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Trophy className="size-6" aria-hidden="true" />
            Post a score
          </a>
        ) : null}
        <Link
          href={reportHref}
          className="flex h-[68px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl bg-warning text-center text-base font-bold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <CircleAlert className="size-6" aria-hidden="true" />
          Report a problem
        </Link>
      </div>
    </div>
  );
}
