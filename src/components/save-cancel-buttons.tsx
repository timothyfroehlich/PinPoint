"use client";

import * as React from "react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { Loader2, Check } from "lucide-react";

interface SaveCancelButtonsProps {
  isPending: boolean;
  isSuccess?: boolean;
  onCancel: () => void;
  saveLabel?: string;
  className?: string;
  disabled?: boolean;
}

export function SaveCancelButtons({
  isPending,
  isSuccess,
  onCancel,
  saveLabel = "Save",
  className,
  disabled,
}: SaveCancelButtonsProps): React.JSX.Element {
  const [showSaved, setShowSaved] = React.useState(false);

  React.useEffect(() => {
    if (isSuccess && !isPending) {
      setShowSaved(true);
      const timer = window.setTimeout(() => {
        setShowSaved(false);
      }, 3000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [isSuccess, isPending]);

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <Button
        type="submit"
        disabled={isPending || showSaved || disabled}
        className={cn(
          "min-w-[140px] transition-all duration-300",
          showSaved && "bg-green-600 hover:bg-green-700 text-white"
        )}
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : showSaved ? (
          <>
            <Check className="mr-2 h-4 w-4" />
            Saved!
          </>
        ) : (
          saveLabel
        )}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={isPending}
      >
        Cancel
      </Button>
    </div>
  );
}
