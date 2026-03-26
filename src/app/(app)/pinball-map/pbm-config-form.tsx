"use client";

import type React from "react";
import { useActionState, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { updatePbmConfigAction } from "~/app/(app)/m/pinball-map-actions";
import type { Result } from "~/lib/result";
import { cn } from "~/lib/utils";

interface PbmConfigFormProps {
  existingConfig: {
    locationId: number;
    userEmail: string;
    userToken: string;
  } | null;
}

export function PbmConfigForm({
  existingConfig,
}: PbmConfigFormProps): React.JSX.Element {
  const [showToken, setShowToken] = useState(false);

  const [state, formAction, isPending] = useActionState<
    Result<void, "UNAUTHORIZED" | "VALIDATION" | "SERVER"> | undefined,
    FormData
  >(updatePbmConfigAction, undefined);

  return (
    <div className="space-y-4">
      <p className="text-sm text-on-surface-variant">
        Configure the Pinball Map API credentials used to add and remove
        machines from your location&apos;s listing. These are stored securely in
        the database with admin-only access.
      </p>

      {/* Flash message */}
      {state && !state.ok && (
        <div
          className={cn(
            "rounded-md border p-4",
            "border-destructive/20 bg-destructive/10 text-destructive"
          )}
        >
          <p className="text-sm font-medium">{state.message}</p>
        </div>
      )}

      {state?.ok && (
        <div
          className={cn(
            "rounded-md border p-4",
            "border-green-600/20 bg-green-600/10 text-green-400"
          )}
        >
          <p className="text-sm font-medium">Credentials saved successfully.</p>
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="pbm-location-id" className="text-on-surface">
            Location ID *
          </Label>
          <Input
            id="pbm-location-id"
            name="locationId"
            type="number"
            required
            defaultValue={existingConfig?.locationId ?? ""}
            placeholder="e.g., 8498"
            className="border-outline bg-surface text-on-surface"
          />
          <p className="text-xs text-on-surface-variant">
            Find this in the Pinball Map URL for your location.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pbm-email" className="text-on-surface">
            User Email *
          </Label>
          <Input
            id="pbm-email"
            name="userEmail"
            type="email"
            required
            defaultValue={existingConfig?.userEmail ?? ""}
            placeholder="your@email.com"
            className="border-outline bg-surface text-on-surface"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="pbm-token" className="text-on-surface">
            API Token *
          </Label>
          <div className="flex gap-2">
            <Input
              id="pbm-token"
              name="userToken"
              type={showToken ? "text" : "password"}
              required
              defaultValue={existingConfig?.userToken ?? ""}
              placeholder="Your Pinball Map API token"
              className="border-outline bg-surface text-on-surface flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowToken(!showToken)}
              aria-label={showToken ? "Hide token" : "Show token"}
            >
              {showToken ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-on-surface-variant">
            Get this from your Pinball Map account settings.
          </p>
        </div>

        <Button
          type="submit"
          className="bg-primary text-on-primary hover:bg-primary/90"
          loading={isPending}
        >
          Save Credentials
        </Button>
      </form>
    </div>
  );
}
