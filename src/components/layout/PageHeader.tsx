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
  /**
   * The page's PageActions (design-bible §26), placed in the title row so
   * they lose labels and fold into the room beside the title.
   */
  pageActions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  titleAdornment,
  actions,
  pageActions,
  className,
}: PageHeaderProps): React.JSX.Element {
  return (
    <div className={cn("border-b border-outline-variant pb-2", className)}>
      <div className="flex items-center justify-between gap-3">
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
        {/* PageActions sits in the row itself and takes its free width, so
            it can measure the room it has and fold (design-bible §26.2). */}
        {pageActions}
      </div>
    </div>
  );
}
