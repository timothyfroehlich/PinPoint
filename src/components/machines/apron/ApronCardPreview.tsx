"use client";

import type React from "react";
import { useLayoutEffect, useRef, useState } from "react";

import {
  apronCardPixelSize,
  type ApronCardContent,
  type ApronCardSize,
} from "~/lib/machines/apron-card";
import { cn } from "~/lib/utils";
import { ApronCardFace } from "./ApronCardFace";

interface ApronCardPreviewProps {
  content: ApronCardContent;
  size: ApronCardSize;
  scanUrl: string;
  /** Upper bound on the scale; 1 shows the card at print size. */
  maxScale?: number;
  onOverflowChange?: (overflowing: boolean) => void;
  className?: string;
}

/**
 * The card face scaled to the width it is given, never above `maxScale`.
 * Scaling is a transform, so the face lays out (and measures overflow) at its
 * physical size exactly as it prints.
 */
export function ApronCardPreview({
  content,
  size,
  scanUrl,
  maxScale = 1,
  onOverflowChange,
  className,
}: ApronCardPreviewProps): React.JSX.Element {
  const frameRef = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState<number | null>(null);
  const natural = apronCardPixelSize(size);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setAvailable(entry.contentRect.width);
    });
    observer.observe(frame);
    return () => {
      observer.disconnect();
    };
  }, []);

  const scale = Math.min(
    maxScale,
    (available ?? natural.width) / natural.width
  );

  return (
    <div ref={frameRef} className={cn("w-full", className)}>
      <div
        className="relative overflow-hidden"
        style={{
          width: natural.width * scale,
          height: natural.height * scale,
        }}
      >
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{ transform: `scale(${scale})` }}
        >
          <ApronCardFace
            content={content}
            size={size}
            scanUrl={scanUrl}
            {...(onOverflowChange ? { onOverflowChange } : {})}
          />
        </div>
      </div>
    </div>
  );
}
