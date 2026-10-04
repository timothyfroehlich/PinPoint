"use client";

import type React from "react";
import { useLayoutEffect, useRef, useState } from "react";

import { ApronCardFace } from "~/components/machines/apron/ApronCardFace";
import {
  APRON_CARD_SIZES,
  APRON_CARD_TEMPLATES,
  apronTitleFit,
  isApronCardSize,
  isApronCardTemplate,
  type ApronCardSize,
  type ApronCardTemplate,
} from "~/lib/machines/apron-card";
import {
  APRON_STRESS_FIXTURES,
  withFilledText,
  type ApronStressCheck,
  type ApronStressFixture,
} from "~/lib/machines/apron-card-fixtures";
import { buildMachineHubUrl } from "~/lib/machines/hub-url";
import { cn } from "~/lib/utils";

// Every size and template the card supports, so a new one shows up here
// unprompted.
const SIZES = Object.keys(APRON_CARD_SIZES).filter(isApronCardSize);
const TEMPLATES = Object.keys(APRON_CARD_TEMPLATES).filter(isApronCardTemplate);

// A realistic scan target, so the QR code has production density.
const SCAN_URL = buildMachineHubUrl(
  "https://pinpoint.austinpinballcollective.org",
  "TEST"
);

/**
 * `blocked` is a card the spec lets not fit (§6.4: the identity panel still
 * reaches the logo at the title's floor size), provided the card reports it
 * so save and export are blocked. It is an outcome to look at, not a failure.
 */
type StressStatus = "pass" | "blocked" | "fail" | "known-issue";

interface StressFailure {
  check: ApronStressCheck;
  message: string;
  /** The bead tracking this failure, when the fixture lists it as known. */
  knownIssue: string | null;
}

interface StressResult {
  status: StressStatus;
  failures: StressFailure[];
  blocked: string | null;
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

// Header band text past its second column overflows sideways (spec §5.7).
function overflows(root: HTMLElement, selector: string): boolean {
  const el = root.querySelector<HTMLElement>(selector);
  return (
    el !== null &&
    (el.scrollHeight > el.clientHeight + 0.5 ||
      el.scrollWidth > el.clientWidth + 0.5)
  );
}

function checkCard(
  root: HTMLElement,
  size: ApronCardSize,
  template: ApronCardTemplate,
  fixture: ApronStressFixture,
  fill: FillState,
  reportedOverflow: boolean
): StressResult {
  const layout = apronTitleFit(template, size);
  const failures: StressFailure[] = [];
  const fail = (check: ApronStressCheck, message: string): void => {
    const known = fixture.knownIssues?.find((issue) => issue.check === check);
    failures.push({ check, message, knownIssue: known?.bead ?? null });
  };
  const title = root.querySelector<HTMLElement>(".apron-card__title");
  const panelOverflows = overflows(root, ".apron-card__identity");
  const textOverflows = overflows(root, ".apron-card__text");
  const titlePx = title
    ? Number.parseFloat(getComputedStyle(title).fontSize)
    : 0;

  if (title && title.scrollWidth > title.clientWidth + 0.5) {
    fail("title-width", "Title wider than the panel");
  }
  if (titlePx < layout.titleMinPx) {
    fail("title-size", `Title below ${layout.titleMinPx}px`);
  }
  let blocked: string | null = null;
  if (panelOverflows && titlePx > layout.titleMinPx) {
    fail(
      "panel-height",
      "Identity panel reaches the logo above the floor size"
    );
  } else if (panelOverflows && reportedOverflow) {
    blocked = "Identity panel does not fit at the floor size (§6.4)";
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
    fail("card-text", "Text still fits one word past the limit");
  }
  // The card's own verdict (spec §3.5, §6.4) gates save and export, so it
  // must agree with what the page measured.
  if (reportedOverflow !== (panelOverflows || textOverflows)) {
    fail(
      "fit-report",
      reportedOverflow
        ? "Card reports overflow the page did not measure"
        : "Card does not report its overflow"
    );
  }

  // A known issue that stops failing was fixed: its entry must be removed.
  for (const issue of fixture.knownIssues ?? []) {
    if (!failures.some((failure) => failure.check === issue.check)) {
      failures.push({
        check: issue.check,
        message: `Known issue ${issue.bead} no longer reproduces; remove it from the fixture`,
        knownIssue: null,
      });
    }
  }

  let status: StressStatus = blocked ? "blocked" : "pass";
  if (failures.some((failure) => failure.knownIssue === null)) {
    status = "fail";
  } else if (failures.length > 0) {
    status = "known-issue";
  }

  return {
    status,
    failures,
    blocked,
    titlePx,
    words: textFill ? renderedWords(fixture, fill) : null,
  };
}

function StressCard({
  fixture,
  size,
  template,
}: {
  fixture: ApronStressFixture;
  size: ApronCardSize;
  template: ApronCardTemplate;
}): React.JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  const reportedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [fill, setFill] = useState<FillState>(() =>
    fixture.textFill
      ? { phase: "search", lo: 0, hi: wordCount(fixture.textFill.words) }
      : { phase: "verify", limit: 0 }
  );
  const [result, setResult] = useState<StressResult | null>(null);

  // Runs after ApronCardFace's own layout effects, so the DOM and the face's
  // overflow verdict (reportedRef) are current for the text rendered this pass.
  useLayoutEffect(() => {
    if (!ready || result) return;
    const root = rootRef.current;
    if (!root) return;
    if (fill.phase === "search") {
      const probe = renderedWords(fixture, fill);
      if (fill.lo >= fill.hi) {
        setFill({ phase: "verify", limit: fill.lo });
      } else if (overflows(root, ".apron-card__text")) {
        setFill({ ...fill, hi: probe - 1 });
      } else {
        setFill({ ...fill, lo: probe });
      }
      return;
    }
    setFill({ phase: "done", limit: fill.limit });
    setResult(
      checkCard(root, size, template, fixture, fill, reportedRef.current)
    );
  }, [ready, result, fill, fixture, size, template]);

  const content = fixture.textFill
    ? withFilledText(fixture, renderedWords(fixture, fill))
    : fixture.content;

  return (
    <figure
      className="flex flex-col gap-2"
      data-testid="apron-stress-card"
      data-fixture={fixture.id}
      data-size={size}
      data-template={template}
      data-stress-status={result?.status}
    >
      <div ref={rootRef} className="w-fit ring-1 ring-border">
        <ApronCardFace
          content={content}
          size={size}
          template={template}
          scanUrl={SCAN_URL}
          onOverflowChange={(overflowing) => {
            reportedRef.current = overflowing;
          }}
          onReady={() => {
            setReady(true);
          }}
        />
      </div>
      <figcaption className="flex flex-col gap-0.5 text-sm">
        <span className="text-muted-foreground">
          {APRON_CARD_SIZES[size].label} ·{" "}
          {APRON_CARD_TEMPLATES[template].label}
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
  if (result.status === "blocked") {
    return (
      <span className="font-medium text-warning">
        Blocked: {result.blocked}
      </span>
    );
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

export function ApronStressGallery(): React.JSX.Element {
  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-10 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Apron card stress fixtures</h1>
        <p className="max-w-3xl text-muted-foreground">
          Every fixture at every apron size and template, at print size. Each
          card checks title width, title size, identity panel height, card text
          overflow, and that the card's own fit verdict agrees; text fixtures
          fill word by word to the overflow limit. Fixtures live in
          src/lib/machines/apron-card-fixtures.ts (PP-xeki).
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
          </div>
          <div className="flex flex-wrap gap-6">
            {TEMPLATES.flatMap((template) =>
              SIZES.map((size) => (
                <StressCard
                  key={`${template}-${size}`}
                  fixture={fixture}
                  size={size}
                  template={template}
                />
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
