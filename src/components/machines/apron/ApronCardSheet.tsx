"use client";

import type React from "react";

import {
  APRON_CARD_LAYOUTS,
  APRON_SHEET_MARGIN_MM,
  type ApronCardContent,
  type ApronCardSize,
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
  scanUrl: string;
  onReady?: () => void;
}

/**
 * The card as it goes to paper (print route and PDF export): the face at its
 * physical size, the dark panel bled 2mm past the three outer trim edges so a
 * slightly-off cut shows no paper, and crop marks at each corner.
 */
export function ApronCardSheet({
  content,
  size,
  scanUrl,
  onReady,
}: ApronCardSheetProps): React.JSX.Element {
  const style: React.CSSProperties & Record<`--${string}`, string> = {
    "--apron-sheet-margin": `${APRON_SHEET_MARGIN_MM}mm`,
    "--apron-bleed-panel-width": `${APRON_CARD_LAYOUTS[size].panelWidth}px`,
  };

  return (
    <div className="apron-sheet" style={style}>
      <div className="apron-sheet__trim">
        <div className="apron-sheet__bleed" aria-hidden="true" />
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
          scanUrl={scanUrl}
          {...(onReady ? { onReady } : {})}
        />
      </div>
    </div>
  );
}
