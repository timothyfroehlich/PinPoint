"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";

import { cn } from "~/lib/utils";
import { Button, type ButtonProps } from "~/components/ui/button";

interface CopyButtonProps extends ButtonProps {
  value: string;
}

export function CopyButton({
  value,
  className,
  variant = "ghost",
  size = "icon",
  ...props
}: CopyButtonProps): React.JSX.Element {
  const [hasCopied, setHasCopied] = React.useState(false);

  React.useEffect(() => {
    if (!hasCopied) return;

    const timeoutId = window.setTimeout(() => {
      setHasCopied(false);
    }, 2000);

    return () => window.clearTimeout(timeoutId);
  }, [hasCopied]);

  return (
    <Button
      size={size}
      variant={variant}
      className={cn(
        "relative z-10 size-8 text-on-surface-variant hover:bg-surface-variant hover:text-on-surface",
        className
      )}
      onClick={() => {
        void navigator.clipboard.writeText(value);
        setHasCopied(true);
      }}
      {...props}
    >
      <span className="sr-only">{hasCopied ? "Copied" : "Copy"}</span>
      {hasCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
    </Button>
  );
}
