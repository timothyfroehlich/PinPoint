"use client";
import React from "react";

import Image from "next/image";
import { Dialog, DialogContent, DialogTrigger } from "~/components/ui/dialog";
export interface GalleryImage {
  id: string;
  fullImageUrl: string;
  originalFilename?: string | null;
}

interface ImageGalleryProps {
  images: GalleryImage[];
}

export function ImageGallery({
  images,
}: ImageGalleryProps): React.JSX.Element | null {
  if (images.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {images.map((image) => (
        <Dialog key={image.id}>
          <DialogTrigger asChild>
            <button className="group relative aspect-square w-full cursor-zoom-in overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <Image
                src={image.fullImageUrl}
                alt={image.originalFilename ?? "Issue image"}
                aria-label={image.originalFilename ?? "Issue image"}
                data-testid="gallery-image"
                fill
                unoptimized
                className="object-cover transition-transform group-hover:scale-105"
                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
              />
              {/* Note: Delete button will be added in PR 3 */}
            </button>
          </DialogTrigger>
          <DialogContent
            className="max-w-3xl border-none bg-transparent p-0 shadow-none"
            aria-label={`View image: ${image.originalFilename ?? "Issue image"}`}
          >
            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black/90">
              <Image
                src={image.fullImageUrl}
                alt={image.originalFilename ?? "Issue image"}
                aria-label={image.originalFilename ?? "Issue image"}
                data-testid="dialog-image"
                fill
                unoptimized
                className="object-contain"
                sizes="100vw"
                priority
              />
            </div>
          </DialogContent>
        </Dialog>
      ))}
    </div>
  );
}
