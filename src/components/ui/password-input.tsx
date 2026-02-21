"use client";

import * as React from "react";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, "type">;

function PasswordInput({
  className,
  ...props
}: PasswordInputProps): React.JSX.Element {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        className={cn("pr-10", className)}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-0 top-0 flex h-full items-center px-3 text-muted-foreground hover:text-foreground"
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden="true" />
        ) : (
          <Eye className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

export { PasswordInput };
