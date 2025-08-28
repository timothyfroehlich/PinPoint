/**
 * Create Machine Form Client Component
 * Phase 3B: Client component for machine creation with Server Actions
 */

"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Loader2, Plus } from "lucide-react";
import type { ActionResult } from "~/lib/actions/shared";

interface Location {
  id: string;
  name: string;
  city?: string | null;
  state?: string | null;
}

interface Model {
  id: string;
  name: string;
  manufacturer?: string | null;
  year?: number | null;
  is_custom?: boolean;
}

interface CreateMachineFormClientProps {
  locations: Location[];
  models: Model[];
  action: (formData: FormData) => Promise<ActionResult<{ machineId: string }>>;
}

export function CreateMachineFormClient({
  locations,
  models,
  action,
}: CreateMachineFormClientProps) {
  const router = useRouter();
  
  const [state, formAction, isPending] = useActionState(action, null);

  // Redirect on success
  if (state?.success && state.data?.machineId) {
    router.push(`/machines/${state.data.machineId}`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Machine Information
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-6">
          {/* Error Alert */}
          {state && !state.success && (
            <Alert variant="destructive">
              <AlertDescription>
                {state.error || "Failed to create machine. Please try again."}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Machine Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Machine Name *</Label>
              <Input
                id="name"
                name="name"
                placeholder="Enter machine name"
                disabled={isPending}
                required
              />
              {state?.fieldErrors?.name && (
                <p className="text-sm text-destructive">{state.fieldErrors.name[0]}</p>
              )}
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="locationId">Location *</Label>
              <Select name="locationId" disabled={isPending} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                      {location.city && location.state && (
                        <span className="text-muted-foreground">
                          {" "}- {location.city}, {location.state}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {state?.fieldErrors?.locationId && (
                <p className="text-sm text-destructive">{state.fieldErrors.locationId[0]}</p>
              )}
            </div>

            {/* Model */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="modelId">Machine Model *</Label>
              <Select name="modelId" disabled={isPending} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select machine model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex items-center gap-2">
                        {model.manufacturer && (
                          <span className="font-medium">{model.manufacturer}</span>
                        )}
                        <span>{model.name}</span>
                        {model.year && (
                          <span className="text-muted-foreground">({model.year})</span>
                        )}
                        {model.is_custom && (
                          <span className="text-xs bg-muted px-1 rounded">Custom</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {state?.fieldErrors?.modelId && (
                <p className="text-sm text-destructive">{state.fieldErrors.modelId[0]}</p>
              )}
            </div>

            {/* Owner (Optional) */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="ownerId">Owner (Optional)</Label>
              <Input
                id="ownerId"
                name="ownerId"
                placeholder="Enter owner information"
                disabled={isPending}
              />
              {state?.fieldErrors?.ownerId && (
                <p className="text-sm text-destructive">{state.fieldErrors.ownerId[0]}</p>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-4 pt-4">
            <Button
              type="submit"
              disabled={isPending}
              className="flex-1"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isPending ? "Creating Machine..." : "Create Machine"}
            </Button>
            
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/machines")}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}