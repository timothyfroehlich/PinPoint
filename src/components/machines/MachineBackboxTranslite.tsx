import type React from "react";
import Image from "next/image";

interface MachineBackboxTransliteProps {
  /** OPDB backbox image URL (via PinballMap). Null until PP-o355.2 lands. */
  imageUrl: string | null;
  /** Machine name, for the image's accessible name. */
  name: string;
}

/**
 * MachineBackboxTranslite — desktop-only backbox art block for the machine
 * detail header zone. It sits flush to the right edge and stretches to the
 * full height of the identity + tab-strip column beside it.
 *
 * Fixed-width box with the image absolutely positioned via `fill` +
 * `object-cover`. This is load-bearing: a height-driven version
 * (`height:100%; width:auto`) had no hard width cap and fell back to the
 * image's natural ~1099px width, blowing out the page. A fixed box can't.
 *
 * Frame-first: when `imageUrl` is null (no OPDB match, or PBM not yet
 * ingested) this renders nothing — the header degrades to chip + identity
 * only. Not rendered on mobile: a translite is a large, busy ~2-foot-wide
 * image that is illegible at thumbnail size.
 *
 * NOTE: when PP-o355.2 supplies real OPDB URLs, add the OPDB image host to
 * `next.config` `images.remotePatterns` — until then `imageUrl` is always
 * null so `next/image` never renders and no host config is required.
 */
export function MachineBackboxTranslite({
  imageUrl,
  name,
}: MachineBackboxTransliteProps): React.JSX.Element | null {
  if (imageUrl == null || imageUrl === "") return null;

  return (
    <figure
      data-testid="machine-translite"
      className="relative m-0 hidden w-[300px] shrink-0 self-stretch overflow-hidden border-b border-l border-outline-variant md:block"
    >
      <Image
        src={imageUrl}
        alt={`${name} backbox`}
        fill
        sizes="300px"
        className="object-cover object-center"
      />
      <figcaption className="absolute right-2 bottom-2 rounded bg-background/75 px-1.5 py-0.5 text-[8.5px] tracking-wide text-muted-foreground">
        OPDB · PinballMap
      </figcaption>
    </figure>
  );
}
