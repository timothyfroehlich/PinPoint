"use client";

import type React from "react";

import {
  APRON_CARD_LAYOUTS,
  APRON_HEADER_BAND_LAYOUTS,
  APRON_SHEET_MARGIN_MM,
  APRON_SIDE_RAIL_LAYOUTS,
  type ApronCardContent,
  type ApronCardSize,
  type ApronCardTemplate,
} from "~/lib/machines/apron-card";
import { ApronCardFace } from "./ApronCardFace";

// Two marks per corner, each on the trim line's extension, clear of the bleed.
const CROP_MARKS = [
  "is-top-left-h",
  "is-top-left-v",
  "is-top-right-h",
  "is-top-right-v",
  "is-bottom-left-h",
  "is-bottom-left-v",
  "is-bottom-right-h",
  "is-bottom-right-v",
] as const;

interface ApronCardSheetProps {
  content: ApronCardContent;
  size: ApronCardSize;
  template: ApronCardTemplate;
  scanUrl: string;
  onReady?: () => void;
}

/**
 * The card as it goes to paper (print route and PDF export): the face at its
 * physical size, the dark panel (or Header band) bled 2mm past the three
 * outer trim edges it touches so a slightly-off cut shows no paper, and crop
 * marks at each corner.
 */
export function ApronCardSheet({
  content,
  size,
  template,
  scanUrl,
  onReady,
}: ApronCardSheetProps): React.JSX.Element {
  const band = template === "header-band";
  const panelLayout =
    template === "side-rail" ? APRON_SIDE_RAIL_LAYOUTS : APRON_CARD_LAYOUTS;
  const style: React.CSSProperties & Record<`--${string}`, string> = band
    ? {
        "--apron-sheet-margin": `${APRON_SHEET_MARGIN_MM}mm`,
        "--apron-bleed-band-height": `${APRON_HEADER_BAND_LAYOUTS[size].bandHeight}px`,
      }
    : {
        "--apron-sheet-margin": `${APRON_SHEET_MARGIN_MM}mm`,
        "--apron-bleed-panel-width": `${panelLayout[size].panelWidth}px`,
      };

  return (
    <div className="apron-sheet" style={style}>
      <div className="apron-sheet__trim">
        <div
          className={band ? "apron-sheet__bleed is-band" : "apron-sheet__bleed"}
          aria-hidden="true"
        />
        {CROP_MARKS.map((mark) => (
          <span
            key={mark}
            className={`apron-sheet__mark ${mark}`}
            aria-hidden="true"
          />
        ))}
        <ApronCardFace
          content={content}
          size={size}
          template={template}
          scanUrl={scanUrl}
          {...(onReady ? { onReady } : {})}
        />
      </div>
    </div>
  );
}
