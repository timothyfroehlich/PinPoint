"use client";

import type React from "react";
import { Check, X } from "lucide-react";

interface PasswordMismatchProps {
  password: string;
  confirmPassword: string;
}

export function PasswordMismatch({
  password,
  confirmPassword,
}: PasswordMismatchProps): React.JSX.Element {
  if (confirmPassword.length === 0) {
    return <></>;
  }

  const matches = password === confirmPassword;

  return (
    <p
      aria-live="polite"
      className={`flex items-center gap-1 text-xs ${matches ? "text-success" : "text-destructive"}`}
    >
      {matches ? (
        <>
          <Check className="size-3" aria-hidden="true" />
          Passwords match
        </>
      ) : (
        <>
          <X className="size-3" aria-hidden="true" />
          Passwords do not match
        </>
      )}
    </p>
  );
}
