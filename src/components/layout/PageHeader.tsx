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
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  titleAdornment,
  actions,
  className,
}: PageHeaderProps): React.JSX.Element {
  return (
    <div className={cn("border-b border-outline-variant pb-2", className)}>
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {typeof title === "string" ? (
            <h1 className="text-balance text-3xl font-bold tracking-tight">
              {title}
            </h1>
          ) : (
            title
          )}
          {titleAdornment}
        </div>
        {actions != null && (
          <div className="flex items-center gap-3">{actions}</div>
        )}
      </div>
    </div>
  );
}
