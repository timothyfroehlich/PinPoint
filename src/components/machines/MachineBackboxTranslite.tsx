import type React from "react";
import Image from "next/image";

interface MachineBackboxTransliteProps {
  /** OPDB image URL mirrored from Pinball Map's machine catalog. */
  imageUrl: string | null;
  /** Machine name, for the image's accessible name. */
  name: string;
  /** Link to Pinball Map's configured location, or its home for catalog-only use. */
  pinballmapUrl: string;
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
 * When the catalog has no image, the header keeps its compact identity layout.
 * Pinball Map's image is usually a backglass but can be another primary game
 * image when no primary backglass is available.
 */
export function MachineBackboxTranslite({
  imageUrl,
  name,
  pinballmapUrl,
}: MachineBackboxTransliteProps): React.JSX.Element | null {
  if (imageUrl == null) return null;

  return (
    <figure
      data-testid="machine-translite"
      className="relative m-0 hidden w-[300px] shrink-0 self-stretch overflow-hidden border-b border-l border-outline-variant md:block"
    >
      <Image
        src={imageUrl}
        alt={`${name} game artwork`}
        fill
        sizes="300px"
        unoptimized
        className="object-cover object-center"
      />
      <figcaption className="absolute right-2 bottom-2 rounded bg-background/90 px-1.5 py-0.5 text-[10px] tracking-wide text-foreground">
        Image: <a href={imageUrl}>OPDB</a> · via{" "}
        <a href={pinballmapUrl}>Pinball Map</a>
      </figcaption>
    </figure>
  );
}
