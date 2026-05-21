import * as React from "react";

import { cn } from "~/lib/utils";

function Input({
  className,
  type,
  onBlur,
  ...props
}: React.ComponentProps<"input">): React.JSX.Element {
  function handleBlur(e: React.FocusEvent<HTMLInputElement>): void {
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
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground bg-input/30 border-input h-9 w-full min-w-0 rounded-md border px-3 py-2 text-base shadow-xs transition-[color,box-shadow] duration-150 outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        "[&:user-invalid]:border-destructive [&:user-invalid]:ring-destructive/40",
        className
      )}
      onBlur={handleBlur}
      {...props}
    />
  );
}

export { Input };
