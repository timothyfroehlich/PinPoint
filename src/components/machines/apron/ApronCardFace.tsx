"use client";

import type React from "react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Trophy, Wrench } from "lucide-react";

import {
  APRON_CARD_LAYOUTS,
  apronCreditRows,
  cardParagraphs,
  fitTitleSize,
  shrinkUntilFits,
  type ApronCardContent,
  type ApronCardSize,
} from "~/lib/machines/apron-card";
import { qrSvgPath } from "~/lib/machines/apron-qr";
import { cn } from "~/lib/utils";
import { barlow, barlowCondensed } from "./fonts";
import "./apron-card.css";

interface ApronCardFaceProps {
  content: ApronCardContent;
  size: ApronCardSize;
  scanUrl: string;
  /** Reports whether description + tip overflow their shared region (§3.5). */
  onOverflowChange?: (overflowing: boolean) => void;
  /** Fires once fonts are loaded and the title has been fitted. */
  onReady?: () => void;
  className?: string;
}

/**
 * The printed apron card at its physical size (spec §5). One component
 * renders the editor preview, the Service-tab thumbnail, the print route, and
 * the PNG/PDF exports, so what an editor sees is what prints.
 */
export function ApronCardFace({
  content,
  size,
  scanUrl,
  onOverflowChange,
  onReady,
  className,
}: ApronCardFaceProps): React.JSX.Element {
  const layout = APRON_CARD_LAYOUTS[size];
  const [titlePx, setTitlePx] = useState(layout.titleMaxPx);
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

  const description = cardParagraphs(content.description);
  const tip = content.tipEnabled ? cardParagraphs(content.tip) : [];
  const showTip = content.tipEnabled;
  const qrPx = showTip ? layout.qrWithTipPx : layout.qrPx;
  const creditRows = apronCreditRows(content);
  const logoWidth =
    creditRows.length > 0 ? layout.logoWithCreditsWidth : layout.logoWidth;
  // Everything in the identity panel other than the title — the title fit's
  // last step re-runs when any of it changes (spec 6.3).
  const panelKey = JSON.stringify([
    content.edition,
    content.manufacturer,
    content.year,
    content.ownerName,
    creditRows,
  ]);

  // Title fit (spec §1, §6.1, §6.3), measured against the loaded faces:
  // first the three-line fit by text width, then down until the identity
  // panel's content fits above the logo.
  useLayoutEffect(() => {
    let cancelled = false;
    const family = barlowCondensed.style.fontFamily;
    const context = document.createElement("canvas").getContext("2d");
    const fit = (): void => {
      if (cancelled) return;
      if (context) {
        const lineFit = fitTitleSize({
          title: content.name.toUpperCase(),
          maxWidth: layout.titleMaxWidth,
          maxPx: layout.titleMaxPx,
          minPx: layout.titleMinPx,
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
            minPx: layout.titleMinPx,
            fits: (size) => {
              title.style.fontSize = `${size}px`;
              return identity.scrollHeight <= identity.clientHeight + 0.5;
            },
          });
          // The last size tried is not always the result (the floor is never
          // measured), and React skips the write when state is unchanged.
          title.style.fontSize = `${px}px`;
        }
        setTitlePx(px);
      }
      onReadyRef.current?.();
    };
    void document.fonts
      .load(`800 ${layout.titleMaxPx}px ${family}`)
      .then(() => document.fonts.ready)
      .then(fit, fit);
    return () => {
      cancelled = true;
    };
  }, [content.name, layout, panelKey]);

  // Combined-region overflow (spec §3.5): a boolean, no line counting.
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const check = (): void => {
      onOverflowRef.current?.(el.scrollHeight > el.clientHeight + 0.5);
    };
    check();
    void document.fonts.ready.then(check);
  });

  const makerYear = [content.manufacturer, content.year]
    .filter((v) => v !== null && v !== "")
    .join(" · ");

  const style: React.CSSProperties & Record<`--${string}`, string> = {
    "--apron-width": layout.width,
    "--apron-height": layout.height,
    "--apron-panel-width": `${layout.panelWidth}px`,
    "--apron-panel-padding": layout.panelPadding,
    "--apron-body-padding": layout.bodyPadding,
    "--apron-logo-width": `${logoWidth}px`,
    "--apron-qr-size": `${qrPx}px`,
    "--apron-body-font": `${layout.bodyFontPx}px`,
  };

  return (
    <div
      className={cn(
        "apron-card",
        barlow.variable,
        barlowCondensed.variable,
        className
      )}
      style={style}
      data-apron-size={size}
    >
      <div className="apron-card__panel">
        <div className="apron-card__identity" ref={identityRef}>
          <div
            ref={titleRef}
            className="apron-card__display apron-card__title"
            style={{ fontSize: `${titlePx}px` }}
          >
            {content.name}
          </div>
          {content.edition ? (
            <div className="apron-card__display apron-card__edition">
              {content.edition}
            </div>
          ) : null}
          {makerYear ? (
            <div className="apron-card__meta">{makerYear}</div>
          ) : null}
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
          {content.ownerName ? (
            <div className="apron-card__owner">Owner: {content.ownerName}</div>
          ) : null}
        </div>
        <img
          src="/apc-logo.png"
          alt="Austin Pinball Collective"
          className="apron-card__logo"
        />
      </div>

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
          </div>
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
        </div>
        <div className="apron-card__rule" />
        <div className="apron-card__text" ref={textRef}>
          {showTip ? (
            <>
              {description.length > 0 ? (
                <div>
                  <div className="apron-card__display apron-card__label">
                    Description
                  </div>
                  {description.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              ) : null}
              {tip.length > 0 ? (
                <div>
                  <div className="apron-card__display apron-card__label">
                    Tip
                  </div>
                  {tip.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <div>
              {description.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
