/**
 * Shared image metadata and gallery types
 */

export interface ImageMetadata {
  blobUrl: string;
  blobPathname: string;
  originalFilename: string;
  fileSizeBytes: number;
  mimeType: string;
  imageId?: string;
}

export interface GalleryImage {
  id: string;
  fullImageUrl: string;
  originalFilename?: string | null;
}
