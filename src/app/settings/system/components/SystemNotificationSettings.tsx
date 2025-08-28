/**
 * System Notification Settings Client Island
 * Phase 4B.3: Notification configuration with Server Actions
 */

"use client";

import { useState, useActionState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Separator } from "~/components/ui/separator";
import { SaveIcon, LoaderIcon } from "lucide-react";
import { toast } from "sonner";
import { updateSystemSettingsAction } from "~/lib/actions/admin-actions";

interface SystemNotificationSettingsProps {
  settings: {
    emailNotifications: boolean;
    pushNotifications: boolean;
    issueUpdates: boolean;
    weeklyDigest: boolean;
    maintenanceAlerts: boolean;
  };
}

export function SystemNotificationSettings({ settings }: SystemNotificationSettingsProps) {
  const [formData, setFormData] = useState(settings);
  const [state, formAction, isPending] = useActionState(updateSystemSettingsAction, null);

  const handleToggle = (key: keyof typeof formData, value: boolean) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  // Handle successful save
  useEffect(() => {
    if (state?.success) {
      toast.success(state.message || "Notification settings saved successfully!");
    } else if (state && !state.success) {
      if (state.message) {
        toast.error(state.message);
      }
    }
  }, [state]);

  const hasChanges = JSON.stringify(formData) !== JSON.stringify(settings);

  return (
    <div className="space-y-6">
      {/* Email Notifications */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Email Notifications</Label>
            <p className="text-sm text-muted-foreground">
              Send notifications via email
            </p>
          </div>
          <Switch
            checked={formData.emailNotifications}
            onCheckedChange={(checked) => handleToggle("emailNotifications", checked)}
            disabled={isPending}
          />
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Push Notifications</Label>
            <p className="text-sm text-muted-foreground">
              Browser push notifications (when supported)
            </p>
          </div>
          <Switch
            checked={formData.pushNotifications}
            onCheckedChange={(checked) => handleToggle("pushNotifications", checked)}
            disabled={isPending}
          />
        </div>
      </div>

      <Separator />

      {/* Specific Notification Types */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium">Notification Types</h4>
        
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Issue Updates</Label>
            <p className="text-sm text-muted-foreground">
              Notifications for issue status changes and comments
            </p>
          </div>
          <Switch
            checked={formData.issueUpdates}
            onCheckedChange={(checked) => handleToggle("issueUpdates", checked)}
            disabled={isLoading || !formData.emailNotifications}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Weekly Digest</Label>
            <p className="text-sm text-muted-foreground">
              Weekly summary of organization activity
            </p>
          </div>
          <Switch
            checked={formData.weeklyDigest}
            onCheckedChange={(checked) => handleToggle("weeklyDigest", checked)}
            disabled={isLoading || !formData.emailNotifications}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Maintenance Alerts</Label>
            <p className="text-sm text-muted-foreground">
              System maintenance and downtime notifications
            </p>
          </div>
          <Switch
            checked={formData.maintenanceAlerts}
            onCheckedChange={(checked) => handleToggle("maintenanceAlerts", checked)}
            disabled={isLoading || !formData.emailNotifications}
          />
        </div>
      </div>

      {/* Save Button */}
      <form action={formAction} className="pt-4">
        <input 
          type="hidden" 
          name="settings" 
          value={JSON.stringify(formData)}
        />
        <Button 
          type="submit"
          disabled={isPending || !hasChanges}
          className="w-full"
        >
          {isPending ? (
            <>
              <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <SaveIcon className="mr-2 h-4 w-4" />
              Save Notification Settings
            </>
          )}
        </Button>
      </form>
    </div>
  );
}