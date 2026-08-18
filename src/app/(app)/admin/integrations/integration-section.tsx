import type React from "react";

/**
 * Shared visual frame for one integration's section on the Admin Integrations
 * page (spec §2.4 — every integration renders in the same frame, so a new one
 * is added as another section without restructuring the page).
 *
 * Presentational only: a titled card with an opaque header band (design-bible
 * §2 — `bg-muted` for a header zone inside a card), an optional header-row
 * action slot (a Help link, a link-out), and a body slot. Server-safe, so it
 * composes both a Server Component section (Discord) and a client leaf
 * (Pinball Map) without a `"use client"` boundary of its own.
 */
export function IntegrationSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="overflow-hidden rounded-lg border border-outline-variant/50 bg-card">
      <div className="flex items-start justify-between gap-3 border-b border-outline-variant/50 bg-muted px-6 py-3">
        <div>
          <h2 className="text-base font-semibold leading-none">{title}</h2>
          {/* `mt-1 leading-snug` is deliberate, not decoration: globals.css gives
              every bare <p> the prose defaults `leading-7` (28px) and
              `not-first:mt-4` (16px). Inherited by a 12px label they made this
              band 93px tall to show two short lines. Both are overridden here. */}
          {description && (
            <p className="mt-1 text-pretty text-xs leading-snug text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}
