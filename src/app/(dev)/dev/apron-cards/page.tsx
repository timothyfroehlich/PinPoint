import type React from "react";
import type { Metadata } from "next";

import { ApronStressGallery } from "./apron-stress-gallery";

export const metadata: Metadata = { title: "Apron card stress fixtures" };

/**
 * Every apron stress fixture at every apron size (PP-xeki), with each card's
 * fit checks run in the browser. The smoke suite reads the same checks.
 */
export default function ApronCardStressPage(): React.JSX.Element {
  return <ApronStressGallery />;
}
