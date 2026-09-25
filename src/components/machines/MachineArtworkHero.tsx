import type React from "react";
import Image from "next/image";
import type { MachineForLayout } from "~/app/(app)/m/[initials]/_data";
import { MachineDetailHeader } from "~/components/machines/MachineDetailHeader";

/**
 * Shape reserved before the image loads when Pinball Map reported no
 * dimensions: the landscape ratio of a standard OPDB backglass image. The
 * loaded image's own ratio replaces it (`h-auto`).
 */
const FALLBACK_WIDTH = 640;
const FALLBACK_HEIGHT = 444;

/**
 * MachineArtworkHero — the Info tab's header on narrow screens (PP-o355.43).
 *
 * The whole game artwork, full-bleed and never cropped, with the machine's
 * identity drawn over a fade at its bottom edge and the OPDB credit in the top
 * corner. The tab strip sits directly beneath it. Every other tab, and every
 * tab from `md` up, uses the compact header with the artwork square instead —
 * `MachineHeaderSwitch` decides which renders.
 *
 * Full-bleed by cancelling `MainLayout`'s horizontal padding and
 * `PageContainer`'s top padding; keep those offsets in step with them.
 */
export function MachineArtworkHero({
  machine,
}: {
  machine: MachineForLayout;
}): React.JSX.Element | null {
  const { artwork } = machine;
  if (artwork == null) return null;

  return (
    <figure
      data-testid="machine-artwork-hero"
      className="relative m-0 -mx-4 -mt-6 sm:-mx-8"
    >
      <Image
        src={artwork.url}
        alt={`${machine.name} game artwork`}
        width={artwork.width ?? FALLBACK_WIDTH}
        height={artwork.height ?? FALLBACK_HEIGHT}
        sizes="100vw"
        unoptimized
        priority
        className="block h-auto w-full"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-28 bg-linear-to-b from-transparent to-background/95"
      />
      <div className="absolute inset-x-4 bottom-3 sm:inset-x-8">
        <MachineDetailHeader machine={machine} placement="overlay" />
      </div>
      <figcaption className="absolute top-0 right-0 rounded-bl bg-background/90 px-1.5 py-0.5 text-[10px] tracking-wide text-foreground">
        Image: <a href={artwork.url}>OPDB</a>
      </figcaption>
    </figure>
  );
}
