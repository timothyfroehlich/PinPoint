"use client";
import React from "react";

import Image from "next/image";
import { Dialog, DialogContent, DialogTrigger } from "~/components/ui/dialog";
import { Card } from "~/components/ui/card";
import { type IssueImage } from "~/server/db/schema";

interface ImageGalleryProps {
  images: IssueImage[];
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
            <Card className="group relative aspect-square cursor-zoom-in overflow-hidden">
              <Image
                src={image.fullImageUrl}
                alt={image.originalFilename ?? "Issue image"}
                fill
                className="object-cover transition-transform group-hover:scale-105"
                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
              />
              {/* Note: Delete button will be added in PR 3 */}
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-3xl border-none bg-transparent p-0 shadow-none">
            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black/90">
              <Image
                src={image.fullImageUrl}
                alt={image.originalFilename ?? "Issue image"}
                fill
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
