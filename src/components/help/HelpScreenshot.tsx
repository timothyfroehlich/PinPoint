import type React from "react";
import Image from "next/image";

/**
 * A screenshot in a help article. `width` and `height` are CSS pixels — half
 * the PNG's size, since captures are taken at 2x. Wider shots scale down to
 * the article column; clicking one opens it full size.
 */
export function HelpScreenshot({
  src,
  alt,
  width,
  height,
  caption,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption?: string;
}): React.JSX.Element {
  return (
    <figure className="mt-4">
      <a href={src} target="_blank" rel="noopener noreferrer">
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          className="h-auto max-w-full rounded-lg border border-border"
        />
      </a>
      {caption !== undefined ? (
        <figcaption className="mt-2 text-xs text-muted-foreground">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
