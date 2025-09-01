/**
 * Organization Profile Form Client Island
 * Phase 4B.1: Organization profile management
 */

"use client";

import { useActionState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { LoaderIcon, SaveIcon } from "lucide-react";
import { toast } from "sonner";
import { updateOrganizationProfileAction } from "~/lib/actions/organization-actions";
import { useEffect } from "react";

interface OrganizationProfileFormProps {
  organization: {
    name: string;
    description: string;
    website: string;
    phone: string;
    address: string;
  };
}

export function OrganizationProfileForm({
  organization,
}: OrganizationProfileFormProps) {
  const [state, formAction, isPending] = useActionState(
    updateOrganizationProfileAction,
    null,
  );

  // Show toast notifications based on action state
  useEffect(() => {
    if (state?.success && state.message) {
      toast.success(state.message);
    } else if (state && !state.success) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      {/* Organization Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Organization Name</Label>
        <Input
          id="name"
          name="name"
          type="text"
          defaultValue={organization.name}
          placeholder="Enter organization name"
          disabled={isPending}
          required
        />
        {state && !state.success && state.fieldErrors?.["name"] && (
          <p className="text-sm text-destructive">
            {state.fieldErrors["name"][0]}
          </p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={organization.description}
          placeholder="Brief description of your organization"
          disabled={isPending}
          rows={3}
        />
        {state && !state.success && state.fieldErrors?.["description"] && (
          <p className="text-sm text-destructive">
            {state.fieldErrors["description"][0]}
          </p>
        )}
      </div>

      {/* Website */}
      <div className="space-y-2">
        <Label htmlFor="website">Website</Label>
        <Input
          id="website"
          name="website"
          type="url"
          defaultValue={organization.website}
          placeholder="https://example.com"
          disabled={isPending}
        />
        {state && !state.success && state.fieldErrors?.["website"] && (
          <p className="text-sm text-destructive">
            {state.fieldErrors["website"][0]}
          </p>
        )}
      </div>

      {/* Phone */}
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={organization.phone}
          placeholder="(555) 123-4567"
          disabled={isPending}
        />
        {state && !state.success && state.fieldErrors?.["phone"] && (
          <p className="text-sm text-destructive">
            {state.fieldErrors["phone"][0]}
          </p>
        )}
      </div>

      {/* Address */}
      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Textarea
          id="address"
          name="address"
          defaultValue={organization.address}
          placeholder="Organization address"
          disabled={isPending}
          rows={2}
        />
        {state && !state.success && state.fieldErrors?.["address"] && (
          <p className="text-sm text-destructive">
            {state.fieldErrors["address"][0]}
          </p>
        )}
      </div>

      {/* Submit Button */}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? (
          <>
            <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
            Updating...
          </>
        ) : (
          <>
            <SaveIcon className="mr-2 h-4 w-4" />
            Update Profile
          </>
        )}
      </Button>

      {/* Error Display */}
      {state && !state.success && !state.fieldErrors && (
        <div className="rounded-md bg-destructive/15 p-3">
          <p className="text-sm text-destructive">{state.error}</p>
        </div>
      )}
    </form>
  );
}
