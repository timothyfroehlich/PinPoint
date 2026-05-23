import * as React from "react";

import { cn } from "~/lib/utils";

function Textarea({
  className,
  onBlur,
  ...props
}: React.ComponentProps<"textarea">): React.JSX.Element {
  function handleBlur(e: React.FocusEvent<HTMLTextAreaElement>): void {
    // Skip native-validity sync when the caller controls aria-invalid
    // (e.g. react-hook-form, Radix FormControl) — otherwise blur would
    // clobber schema/library-driven invalid state with checkValidity().
    if (!("aria-invalid" in props)) {
      e.currentTarget.setAttribute(
        "aria-invalid",
        e.currentTarget.checkValidity() ? "false" : "true"
      );
    }
    onBlur?.(e);
  }

  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border px-3 py-2 text-base shadow-xs transition-[color,box-shadow] duration-150 outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "[&:user-invalid]:border-destructive [&:user-invalid]:ring-destructive/40",
        className
      )}
      onBlur={handleBlur}
      {...props}
    />
  );
}

export { Textarea };
