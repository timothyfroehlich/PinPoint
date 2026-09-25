"use client";

import type React from "react";
import { useLayoutEffect, useRef, useState } from "react";

import { ApronCardFace } from "~/components/machines/apron/ApronCardFace";
import {
  APRON_CARD_LAYOUTS,
  APRON_CARD_SIZES,
  isApronCardSize,
  type ApronCardSize,
} from "~/lib/machines/apron-card";
import {
  APRON_STRESS_FIXTURES,
  withFilledText,
  type ApronFixtureCredits,
  type ApronStressCheck,
  type ApronStressFixture,
} from "~/lib/machines/apron-card-fixtures";
import { buildMachineHubUrl } from "~/lib/machines/hub-url";
import { cn } from "~/lib/utils";

// Every size the card supports, so a new size shows up here unprompted.
const SIZES = Object.keys(APRON_CARD_SIZES).filter(isApronCardSize);

// A realistic scan target, so the QR code has production density.
const SCAN_URL = buildMachineHubUrl(
  "https://pinpoint.austinpinballcollective.org",
  "TEST"
);

type StressStatus = "pass" | "fail" | "known-issue";

interface StressFailure {
  check: ApronStressCheck;
  message: string;
  /** The bead tracking this failure, when the fixture lists it as known. */
  knownIssue: string | null;
}

interface StressResult {
  status: StressStatus;
  failures: StressFailure[];
  titlePx: number;
  words: number | null;
}

/** Fill search state: `lo` words are known to fit; `hi` is the upper bound. */
type FillState =
  | { phase: "search"; lo: number; hi: number }
  | { phase: "verify"; limit: number }
  | { phase: "done"; limit: number };

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function renderedWords(fixture: ApronStressFixture, fill: FillState): number {
  if (fill.phase === "search") return Math.ceil((fill.lo + fill.hi) / 2);
  return fixture.textFill?.at === "over" ? fill.limit + 1 : fill.limit;
}

function checkCard(
  root: HTMLElement,
  size: ApronCardSize,
  fixture: ApronStressFixture,
  fill: FillState,
  textOverflows: boolean
): StressResult {
  const layout = APRON_CARD_LAYOUTS[size];
  const failures: StressFailure[] = [];
  const fail = (check: ApronStressCheck, message: string): void => {
    const known = fixture.knownIssues?.find((issue) => issue.check === check);
    failures.push({ check, message, knownIssue: known?.bead ?? null });
  };
  const title = root.querySelector<HTMLElement>(".apron-card__title");
  const panel = root.querySelector<HTMLElement>(".apron-card__panel");
  const titlePx = title
    ? Number.parseFloat(getComputedStyle(title).fontSize)
    : 0;

  if (title && title.scrollWidth > title.clientWidth + 0.5) {
    fail("title-width", "Title wider than the panel");
  }
  if (titlePx < layout.titleMinPx) {
    fail("title-size", `Title below ${layout.titleMinPx}px`);
  }
  if (panel && panel.scrollHeight > panel.clientHeight + 0.5) {
    fail("panel-height", "Identity panel pushes the logo off the card");
  }

  const textFill = fixture.textFill;
  const limit = fill.phase === "search" ? null : fill.limit;
  if (!textFill) {
    if (textOverflows) fail("card-text", "Card text overflows");
  } else if (limit !== null && limit >= wordCount(textFill.words)) {
    fail("card-text", "Filler text too short for this size");
  } else if (textFill.at === "limit" && textOverflows) {
    fail("card-text", "Card text overflows");
  } else if (textFill.at === "over" && !textOverflows) {
    fail("card-text", "Overflow not reported one word past the limit");
  }

  let status: StressStatus = "pass";
  if (failures.some((failure) => failure.knownIssue === null)) {
    status = "fail";
  } else if (failures.length > 0) {
    status = "known-issue";
  }

  return {
    status,
    failures,
    titlePx,
    words: textFill ? renderedWords(fixture, fill) : null,
  };
}

function StressCard({
  fixture,
  size,
}: {
  fixture: ApronStressFixture;
  size: ApronCardSize;
}): React.JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  const overflowRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [fill, setFill] = useState<FillState>(() =>
    fixture.textFill
      ? { phase: "search", lo: 0, hi: wordCount(fixture.textFill.words) }
      : { phase: "verify", limit: 0 }
  );
  const [result, setResult] = useState<StressResult | null>(null);

  // Runs after ApronCardFace's own layout effects, so overflowRef holds the
  // face's overflow verdict (spec §3.5) for the text rendered this pass.
  useLayoutEffect(() => {
    if (!ready || result) return;
    if (fill.phase === "search") {
      const probe = renderedWords(fixture, fill);
      if (fill.lo >= fill.hi) {
        setFill({ phase: "verify", limit: fill.lo });
      } else if (overflowRef.current) {
        setFill({ ...fill, hi: probe - 1 });
      } else {
        setFill({ ...fill, lo: probe });
      }
      return;
    }
    const root = rootRef.current;
    if (!root) return;
    setFill({ phase: "done", limit: fill.limit });
    setResult(checkCard(root, size, fixture, fill, overflowRef.current));
  }, [ready, result, fill, fixture, size]);

  const content = fixture.textFill
    ? withFilledText(fixture, renderedWords(fixture, fill))
    : fixture.content;

  return (
    <figure
      className="flex flex-col gap-2"
      data-testid="apron-stress-card"
      data-fixture={fixture.id}
      data-size={size}
      data-stress-status={result?.status}
    >
      <div ref={rootRef} className="w-fit ring-1 ring-border">
        <ApronCardFace
          content={content}
          size={size}
          scanUrl={SCAN_URL}
          onOverflowChange={(overflowing) => {
            overflowRef.current = overflowing;
          }}
          onReady={() => {
            setReady(true);
          }}
        />
      </div>
      <figcaption className="flex flex-col gap-0.5 text-sm">
        <span className="text-muted-foreground">
          {APRON_CARD_SIZES[size].label}
          {result ? ` · title ${result.titlePx}px` : null}
          {result && result.words !== null ? ` · ${result.words} words` : null}
        </span>
        <StatusLine result={result} />
      </figcaption>
    </figure>
  );
}

function StatusLine({
  result,
}: {
  result: StressResult | null;
}): React.JSX.Element {
  if (!result) {
    return <span className="text-muted-foreground">Checking…</span>;
  }
  if (result.status === "pass") {
    return <span className="font-medium text-success">Pass</span>;
  }
  return (
    <span className="flex flex-col">
      {result.failures.map((failure) => (
        <span
          key={failure.check}
          className={cn(
            "font-medium",
            failure.knownIssue ? "text-warning" : "text-destructive-text"
          )}
        >
          {failure.knownIssue
            ? `Known issue (${failure.knownIssue}): `
            : "Fail: "}
          {failure.message}
        </span>
      ))}
    </span>
  );
}

function creditLine(label: string, names: readonly string[]): string {
  return `${label}: ${names.length > 0 ? names.join(", ") : "Unknown"}`;
}

function CreditsNote({
  credits,
}: {
  credits: ApronFixtureCredits;
}): React.JSX.Element {
  return (
    <p className="text-sm text-muted-foreground">
      {creditLine("Design", credits.design)} · {creditLine("Art", credits.art)}
      <span className="block text-xs">
        Credits are not on the card until PP-tv2u lands.
      </span>
    </p>
  );
}

export function ApronStressGallery(): React.JSX.Element {
  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-10 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Apron card stress fixtures</h1>
        <p className="max-w-3xl text-muted-foreground">
          Every fixture at every apron size, at print size. Each card checks
          title width, title size, identity panel height, and card text
          overflow; text fixtures fill word by word to the overflow limit.
          Fixtures live in src/lib/machines/apron-card-fixtures.ts (PP-xeki).
        </p>
      </header>
      {APRON_STRESS_FIXTURES.map((fixture) => (
        <section
          key={fixture.id}
          id={fixture.id}
          className="flex flex-col gap-3 border-t border-border pt-6"
        >
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">
              {fixture.content.name}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {fixture.id}
                {fixture.opdbId ? ` · OPDB ${fixture.opdbId}` : " · synthetic"}
              </span>
            </h2>
            <p className="text-sm">{fixture.stresses}</p>
            <CreditsNote credits={fixture.credits} />
          </div>
          <div className="flex flex-wrap gap-6">
            {SIZES.map((size) => (
              <StressCard key={size} fixture={fixture} size={size} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
