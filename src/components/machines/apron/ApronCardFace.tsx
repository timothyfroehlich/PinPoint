"use client";

import type React from "react";
import { Fragment, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Lightbulb, Trophy, Wrench } from "lucide-react";

import {
  APRON_CARD_LAYOUTS,
  APRON_HEADER_BAND_LAYOUTS,
  APRON_SIDE_RAIL_LAYOUTS,
  apronCreditRows,
  apronTitleFit,
  fitTitleSize,
  shrinkUntilFits,
  titleWords,
  type ApronCardContent,
  type ApronCardSize,
  type ApronCardTemplate,
} from "~/lib/machines/apron-card";
import type {
  CardTextBlock,
  CardTextRun,
} from "~/lib/machines/apron-card-text";
import { qrSvgPath } from "~/lib/machines/apron-qr";
import { cn } from "~/lib/utils";
import { barlow, barlowCondensed } from "./fonts";
import "./apron-card.css";

interface ApronCardFaceProps {
  content: ApronCardContent;
  size: ApronCardSize;
  template: ApronCardTemplate;
  scanUrl: string;
  /** Reports whether description + tip overflow their shared region (§3.5). */
  onOverflowChange?: (overflowing: boolean) => void;
  /** Fires once fonts are loaded and the title has been fitted. */
  onReady?: () => void;
  className?: string;
}

type CustomProperties = React.CSSProperties & Record<`--${string}`, string>;

/**
 * The printed apron card at its physical size (spec §5), in any template
 * (§5.5–5.7). One component renders the editor preview, the print route, and
 * the PNG/PDF exports, so what an editor sees is what prints.
 */
export function ApronCardFace({
  content,
  size,
  template,
  scanUrl,
  onOverflowChange,
  onReady,
  className,
}: ApronCardFaceProps): React.JSX.Element {
  const fit = useMemo(() => apronTitleFit(template, size), [template, size]);
  const [titlePx, setTitlePx] = useState(fit.titleMaxPx);
  const textRef = useRef<HTMLDivElement>(null);
  const identityRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const qr = useMemo(() => qrSvgPath(scanUrl), [scanUrl]);

  const onOverflowRef = useRef(onOverflowChange);
  const onReadyRef = useRef(onReady);
  useLayoutEffect(() => {
    onOverflowRef.current = onOverflowChange;
    onReadyRef.current = onReady;
  });

  // Only the Standard template shows credits (spec §10.2).
  const creditRows = template === "standard" ? apronCreditRows(content) : [];
  // Everything beside the title in the identity panel or band — the title
  // fit's last step re-runs when any of it changes (spec 6.3, 6.5).
  const panelKey = JSON.stringify([
    content.edition,
    content.manufacturer,
    content.year,
    content.ownerName,
    creditRows,
  ]);

  // The card does not fit when description and tip overflow their region
  // (§3.5) or when the identity panel or band still overflows with the title
  // at its floor (§6.4, §6.5). Header band text that runs past its second
  // column overflows sideways. Reads refs only, so any render's copy is
  // current.
  const reportOverflow = (): void => {
    const text = textRef.current;
    const identity = identityRef.current;
    if (!text) return;
    const overflows = (el: HTMLElement): boolean =>
      el.scrollHeight > el.clientHeight + 0.5 ||
      el.scrollWidth > el.clientWidth + 0.5;
    onOverflowRef.current?.(
      overflows(text) || (identity !== null && overflows(identity))
    );
  };

  // Title fit (spec §1, §6.1, §6.3, §6.5), measured against the loaded faces:
  // first the line fit by text width, then down until the identity panel's
  // content fits above the logo (or the band's content fits its height).
  useLayoutEffect(() => {
    let cancelled = false;
    const family = barlowCondensed.style.fontFamily;
    const context = document.createElement("canvas").getContext("2d");
    const runFit = (): void => {
      if (cancelled) return;
      if (context) {
        const lineFit = fitTitleSize({
          title: content.name.toUpperCase(),
          maxWidth: fit.titleMaxWidth,
          maxPx: fit.titleMaxPx,
          minPx: fit.titleMinPx,
          maxLines: fit.maxLines,
          measure: (text, px) => {
            context.font = `800 ${px}px ${family}`;
            return context.measureText(text).width;
          },
        });
        const identity = identityRef.current;
        const title = titleRef.current;
        // Sizes are tried on the element directly so each measurement is one
        // synchronous layout, not one render; state gets the final size.
        let px = lineFit;
        if (identity && title) {
          px = shrinkUntilFits({
            startPx: lineFit,
            minPx: fit.titleMinPx,
            fits: (next) => {
              title.style.fontSize = `${next}px`;
              return identity.scrollHeight <= identity.clientHeight + 0.5;
            },
          });
          // The last size tried is not always the result (the floor is never
          // measured), and React skips the write when state is unchanged.
          title.style.fontSize = `${px}px`;
        }
        setTitlePx(px);
        // The fit can finish without a re-render (same size as before), so
        // re-check here rather than rely on the per-render check alone.
        reportOverflow();
      }
      onReadyRef.current?.();
    };
    void document.fonts
      .load(`800 ${fit.titleMaxPx}px ${family}`)
      .then(() => document.fonts.ready)
      .then(runFit, runFit);
    return () => {
      cancelled = true;
    };
  }, [content.name, fit, panelKey]);

  // Combined-region overflow (spec §3.5, §6.4): a boolean, no line counting.
  useLayoutEffect(() => {
    reportOverflow();
    void document.fonts.ready.then(reportOverflow);
  });

  const makerYear = [content.manufacturer, content.year]
    .filter((v) => v !== null && v !== "")
    .join(" · ");

  const title = (
    <div
      ref={titleRef}
      className="apron-card__display apron-card__title"
      style={{ fontSize: `${titlePx}px` }}
    >
      {/* Break points match the title fit's words (spec §1): a <wbr>
          after each hyphen and ellipsis, a space elsewhere. */}
      {titleWords(content.name).map((word, i) => (
        <Fragment key={i}>
          {i === 0 ? null : word.joiner === " " ? " " : <wbr />}
          {word.text}
        </Fragment>
      ))}
    </div>
  );
  const edition = content.edition ? (
    <div className="apron-card__display apron-card__edition">
      {content.edition}
    </div>
  ) : null;
  const meta = makerYear ? (
    <div className="apron-card__meta">{makerYear}</div>
  ) : null;
  const owner = content.ownerName ? (
    <div className="apron-card__owner">Owner: {content.ownerName}</div>
  ) : null;
  const logo = (
    <img
      src="/apc-logo.png"
      alt="Austin Pinball Collective"
      className="apron-card__logo"
    />
  );
  const qrCode = (
    <svg
      className="apron-card__qr"
      viewBox={`0 0 ${qr.size} ${qr.size}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`QR code for ${scanUrl}`}
    >
      <rect width={qr.size} height={qr.size} fill="#ffffff" />
      <path d={qr.path} fill="#0f0f11" />
    </svg>
  );
  const cardText = (
    <CardTextRegion
      description={content.description}
      tip={content.tip}
      tipEnabled={content.tipEnabled}
    />
  );
  // Side rail and Header band name the QR's destinations as short captions
  // under it (spec §5.3, §5.6, §5.7).
  const qrWithCaptions = (
    <div className="apron-card__qr-block">
      {qrCode}
      <ScanCaptions hasPinTips={content.hasPinTips} />
    </div>
  );
  const cardClass = cn(
    "apron-card",
    `is-${template}`,
    barlow.variable,
    barlowCondensed.variable,
    className
  );

  if (template === "header-band") {
    const layout = APRON_HEADER_BAND_LAYOUTS[size];
    const style: CustomProperties = {
      "--apron-width": layout.width,
      "--apron-height": layout.height,
      "--apron-band-height": `${layout.bandHeight}px`,
      "--apron-band-padding": layout.bandPadding,
      "--apron-body-padding": layout.bodyPadding,
      "--apron-logo-width": `${layout.logoWidth}px`,
      "--apron-qr-size": `${layout.qrPx}px`,
      "--apron-body-font": `${layout.bodyFontPx}px`,
    };
    return (
      <div className={cardClass} style={style} data-apron-size={size}>
        <div className="apron-card__band">
          <div className="apron-card__identity" ref={identityRef}>
            <div className="apron-card__band-lines">
              {title}
              <div className="apron-card__band-meta">
                {edition}
                {meta}
                {owner}
              </div>
            </div>
          </div>
          {logo}
        </div>
        <div className="apron-card__body">
          <div className="apron-card__text" ref={textRef}>
            {cardText}
          </div>
          {qrWithCaptions}
        </div>
      </div>
    );
  }

  const layout =
    template === "side-rail"
      ? APRON_SIDE_RAIL_LAYOUTS[size]
      : APRON_CARD_LAYOUTS[size];
  const showTip = content.tipEnabled;
  const logoWidth =
    creditRows.length > 0 ? layout.logoWithCreditsWidth : layout.logoWidth;
  const style: CustomProperties = {
    "--apron-width": layout.width,
    "--apron-height": layout.height,
    "--apron-panel-width": `${layout.panelWidth}px`,
    "--apron-panel-padding": layout.panelPadding,
    "--apron-body-padding": layout.bodyPadding,
    "--apron-logo-width": `${logoWidth}px`,
    "--apron-qr-size": `${showTip ? layout.qrWithTipPx : layout.qrPx}px`,
    "--apron-body-font": `${layout.bodyFontPx}px`,
  };

  return (
    <div className={cardClass} style={style} data-apron-size={size}>
      <div className="apron-card__panel">
        <div className="apron-card__identity" ref={identityRef}>
          {title}
          {edition}
          {meta}
          {creditRows.length > 0 ? (
            <dl className="apron-card__credits">
              {creditRows.map((row) => (
                <div key={row.label} className="apron-card__credit">
                  <dt className="apron-card__display apron-card__credit-label">
                    {row.label}
                  </dt>
                  <dd className="apron-card__credit-names">{row.text}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {owner}
        </div>
        {logo}
      </div>

      {template === "side-rail" ? (
        // The QR floats at the column's top right and the text wraps around
        // it (spec §5.6); the whole column is the text region.
        <div className="apron-card__body apron-card__text" ref={textRef}>
          {qrWithCaptions}
          {cardText}
        </div>
      ) : (
        <div className="apron-card__body">
          <div className="apron-card__scan">
            <div className="apron-card__actions">
              <div className="apron-card__display apron-card__scan-heading">
                Scan this machine
              </div>
              <div className="apron-card__action">
                <Wrench aria-hidden="true" />
                <span>Report a problem</span>
              </div>
              <div className="apron-card__action">
                <Trophy aria-hidden="true" />
                <span>
                  Post your score on{" "}
                  <span className="apron-card__iscored">iScored</span>
                </span>
              </div>
              {content.hasPinTips ? (
                <div className="apron-card__action">
                  <Lightbulb aria-hidden="true" />
                  <span>Get playing tips</span>
                </div>
              ) : null}
            </div>
            {qrCode}
          </div>
          <div className="apron-card__rule" />
          <div className="apron-card__text" ref={textRef}>
            {cardText}
          </div>
        </div>
      )}
    </div>
  );
}

/** The QR's destinations as short captions (spec §5.3, §5.6, §5.7). */
function ScanCaptions({
  hasPinTips,
}: {
  hasPinTips: boolean;
}): React.JSX.Element {
  return (
    <div className="apron-card__captions">
      <div className="apron-card__display apron-card__captions-heading">
        Scan to
      </div>
      <div className="apron-card__display apron-card__caption">
        <Wrench aria-hidden="true" />
        <span>Report a problem</span>
      </div>
      <div className="apron-card__display apron-card__caption">
        <Trophy aria-hidden="true" />
        <span>
          Post on <span className="apron-card__iscored">iScored</span>
        </span>
      </div>
      {hasPinTips ? (
        <div className="apron-card__display apron-card__caption">
          <Lightbulb aria-hidden="true" />
          <span>Playing tips</span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Description and tip (spec §3.3): one unlabelled block when the tip is off,
 * labelled Description and Tip blocks when it is on.
 */
function CardTextRegion({
  description,
  tip,
  tipEnabled,
}: {
  description: CardTextBlock[];
  tip: CardTextBlock[];
  tipEnabled: boolean;
}): React.JSX.Element {
  if (!tipEnabled) {
    return (
      <div className="apron-card__text-block">
        <CardText blocks={description} />
      </div>
    );
  }
  return (
    <>
      {description.length > 0 ? (
        <div className="apron-card__text-block">
          <div className="apron-card__display apron-card__label">
            Description
          </div>
          <CardText blocks={description} />
        </div>
      ) : null}
      {tip.length > 0 ? (
        <div className="apron-card__text-block">
          <div className="apron-card__display apron-card__label">Tip</div>
          <CardText blocks={tip} />
        </div>
      ) : null}
    </>
  );
}

function Runs({ runs }: { runs: CardTextRun[] }): React.JSX.Element {
  return (
    <>
      {runs.map((run, i) => {
        if (run.text === "\n") return <br key={i} />;
        let node: React.ReactNode = run.text;
        if (run.italic) node = <em>{node}</em>;
        if (run.bold) node = <strong>{node}</strong>;
        return <Fragment key={i}>{node}</Fragment>;
      })}
    </>
  );
}

/** Card text with its bold, italic, and lists (spec §3.7). */
function CardText({ blocks }: { blocks: CardTextBlock[] }): React.JSX.Element {
  return (
    <>
      {blocks.map((block, i) => {
        if (block.kind === "paragraph") {
          return (
            <p key={i}>
              <Runs runs={block.runs} />
            </p>
          );
        }
        const items = block.items.map((runs, j) => (
          <li key={j}>
            <Runs runs={runs} />
          </li>
        ));
        return block.ordered ? (
          <ol key={i}>{items}</ol>
        ) : (
          <ul key={i}>{items}</ul>
        );
      })}
    </>
  );
}
