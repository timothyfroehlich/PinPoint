/**
 * Organization Logo Form Client Island
 * Phase 4B.1: Organization logo management
 */

"use client";

import { useActionState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card } from "~/components/ui/card";
import { LoaderIcon, UploadIcon, ImageIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { updateOrganizationLogoAction } from "~/lib/actions/organization-actions";
import { useEffect, useState } from "react";

interface OrganizationLogoFormProps {
  currentLogoUrl: string;
}

export function OrganizationLogoForm({ currentLogoUrl }: OrganizationLogoFormProps) {
  const [state, formAction, isPending] = useActionState(
    updateOrganizationLogoAction,
    null,
  );
  const [previewUrl, setPreviewUrl] = useState(currentLogoUrl);

  // Show toast notifications based on action state
  useEffect(() => {
    if (state?.success && state.message) {
      toast.success(state.message);
    } else if (!state?.success && state?.message) {
      toast.error(state.message);
    }
  }, [state]);

  const handleUrlChange = (url: string) => {
    setPreviewUrl(url);
  };

  const clearLogo = () => {
    setPreviewUrl("");
  };

  return (
    <div className="space-y-4">
      {/* Current Logo Preview */}
      {previewUrl && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-12 w-12 rounded border flex items-center justify-center overflow-hidden bg-muted">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Organization logo"
                    className="h-full w-full object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.parentElement!.innerHTML = '<ImageIcon class="h-6 w-6 text-muted-foreground" />';
                    }}
                  />
                ) : (
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium">Current Logo</p>
                <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                  {previewUrl}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearLogo}
              disabled={isPending}
            >
              <XIcon className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Logo URL Form */}
      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="logoUrl">Logo URL</Label>
          <Input
            id="logoUrl"
            name="logoUrl"
            type="url"
            value={previewUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://example.com/logo.png"
            disabled={isPending}
          />
          {state?.fieldErrors?.logoUrl && (
            <p className="text-sm text-destructive">{state.fieldErrors.logoUrl[0]}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Enter a URL to an image file (PNG, JPG, or SVG recommended)
          </p>
        </div>

        {/* Submit Button */}
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? (
            <>
              <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
              Updating Logo...
            </>
          ) : (
            <>
              <UploadIcon className="mr-2 h-4 w-4" />
              Update Logo
            </>
          )}
        </Button>

        {/* Error Display */}
        {state?.message && !state.success && !state.fieldErrors && (
          <div className="rounded-md bg-destructive/15 p-3">
            <p className="text-sm text-destructive">{state.message}</p>
          </div>
        )}
      </form>

      {/* Logo Guidelines */}
      <Card className="p-4 bg-muted/50">
        <h4 className="text-sm font-medium mb-2">Logo Guidelines</h4>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• Recommended size: 200x200 pixels or larger</li>
          <li>• Supported formats: PNG, JPG, GIF, SVG</li>
          <li>• Square or rectangular aspect ratios work best</li>
          <li>• Ensure the image is publicly accessible</li>
        </ul>
      </Card>
    </div>
  );
}