import type React from "react";
import Link from "next/link";
import { CircleHelp } from "lucide-react";

import { cn } from "~/lib/utils";

/**
 * A "Help" link to a help article, placed beside the controls it explains.
 * `topic` completes the accessible name ("Help: Pinball Map") so several Help
 * links on one page stay distinguishable to a screen reader.
 */
export function HelpLink({
  href,
  topic,
  className,
}: {
  href: string;
  topic: string;
  className?: string;
}): React.JSX.Element {
  return (
    <Link
      href={href}
      aria-label={`Help: ${topic}`}
      className={cn("inline-flex items-center gap-1.5 text-link", className)}
    >
      <CircleHelp className="size-4" aria-hidden="true" />
      <span>Help</span>
    </Link>
  );
}
