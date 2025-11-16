"use client";

import React from "react";
import { useFormStatus } from "react-dom";
import { Button } from "~/components/ui/button";

export function AddCommentSubmitButton(): React.JSX.Element {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} aria-live="polite">
      {pending ? "Adding comment..." : "Add comment"}
    </Button>
  );
}
