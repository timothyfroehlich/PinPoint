import type { MetadataRoute } from "next";

/**
 * Web app manifest, served at /manifest.webmanifest.
 *
 * Android reads it for "Add to Home screen". The maskable icons are
 * full-bleed tiles that the launcher crops to its own shape (circle,
 * squircle, ...); the mark sits inside the central safe zone. iOS ignores
 * the manifest and uses apple-touch-icon.png from the layout metadata.
 *
 * Sources: public/logo-pinpoint.svg (mark) and public/logo-pinpoint-tile.svg
 * (tile).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PinPoint",
    short_name: "PinPoint",
    description:
      "Issue tracking for pinball machines at Austin Pinball Collective",
    start_url: "/dashboard",
    display: "browser",
    background_color: "#0f0f11",
    theme_color: "#0f0f11",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
