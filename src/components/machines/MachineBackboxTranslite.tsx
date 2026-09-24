import type React from "react";
import Image from "next/image";

interface MachineBackboxTransliteProps {
  /** OPDB image URL mirrored from Pinball Map's machine catalog. */
  imageUrl: string | null;
  /** Machine name, for the image's accessible name. */
  name: string;
}

/**
 * MachineBackboxTranslite — game artwork for the machine detail header zone,
 * placed in the layout grid's `art` area. Below md it sits beside the identity,
 * above the tab strip; from md it sits flush to the right edge and stretches
 * to the full height of the identity + tab strip.
 *
 * Fixed-width box (per breakpoint) with the image absolutely positioned via `fill` +
 * `object-cover`. This is load-bearing: a height-driven version
 * (`height:100%; width:auto`) had no hard width cap and fell back to the
 * image's natural ~1099px width, blowing out the page. A fixed box can't.
 *
 * When the catalog has no image, the header keeps its compact identity layout.
 * Pinball Map's image is usually a backglass but can be another primary game
 * image when no primary backglass is available.
 */
export function MachineBackboxTranslite({
  imageUrl,
  name,
}: MachineBackboxTransliteProps): React.JSX.Element | null {
  if (imageUrl == null) return null;

  return (
    <figure
      data-testid="machine-translite"
      className="relative m-0 ml-3 w-28 overflow-hidden rounded-md [grid-area:art] sm:w-44 md:ml-0 md:w-[300px] md:rounded-none md:border-b md:border-l md:border-outline-variant"
    >
      <Image
        src={imageUrl}
        alt={`${name} game artwork`}
        fill
        sizes="(min-width: 768px) 300px, (min-width: 640px) 176px, 112px"
        unoptimized
        className="object-cover object-center"
      />
      <figcaption className="absolute right-0 bottom-0 rounded-tl bg-background/90 px-1.5 py-0.5 text-[10px] tracking-wide text-foreground">
        Image: <a href={imageUrl}>OPDB</a>
      </figcaption>
    </figure>
  );
}
