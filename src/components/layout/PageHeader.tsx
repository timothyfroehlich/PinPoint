import type React from "react";
import { cn } from "~/lib/utils";

interface PageHeaderProps {
  /**
   * Title content. Pass a string for the default `<h1 className="text-balance text-3xl font-bold tracking-tight">` treatment,
   * or a React node for full control (e.g., to embed an editable title component). When passing a node, the consumer is
   * responsible for the heading element and matching typography. Passing `null` or `undefined` renders no heading element.
   */
  title: React.ReactNode;
  titleAdornment?: React.ReactNode;
  /** The page's primary action(s). Stay on the title's row at every width. */
  actions?: React.ReactNode;
  /**
   * Less-used actions. Sit before `actions` on the title's row from `md` up;
   * below `md` they take their own row under the title so the title row keeps
   * room for the primary action (design-bible §4, 320px floor).
   */
  secondaryActions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  titleAdornment,
  actions,
  secondaryActions,
  className,
}: PageHeaderProps): React.JSX.Element {
  return (
    <div className={cn("border-b border-outline-variant pb-2", className)}>
      {/* Anything that still runs out of width wraps rather than overrunning
          the page. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="mr-auto flex flex-wrap items-center gap-3">
          {typeof title === "string" ? (
            <h1 className="text-balance text-3xl font-bold tracking-tight">
              {title}
            </h1>
          ) : (
            title
          )}
          {titleAdornment}
        </div>
        {secondaryActions != null && (
          <div className="order-last flex basis-full flex-wrap items-center gap-2 md:order-none md:basis-auto md:gap-3">
            {secondaryActions}
          </div>
        )}
        {actions != null && (
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
