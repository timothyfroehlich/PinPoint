import { Barlow, Barlow_Condensed } from "next/font/google";

// The card's typefaces (design canvas, PP-esta). Self-hosted by next/font, so
// the preview, the print route, and PNG/PDF exports all render the same glyphs.
export const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--apron-font-body",
  display: "block",
});

export const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  variable: "--apron-font-display",
  display: "block",
});
