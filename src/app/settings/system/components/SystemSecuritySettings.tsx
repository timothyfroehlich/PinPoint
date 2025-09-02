/**
 * System Security Settings Client Island
 * Phase 4B.3: Security and authentication configuration with Server Actions
 */

"use client";

import React, { useState, useActionState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { Badge } from "~/components/ui/badge";
import { SaveIcon, LoaderIcon, ShieldAlertIcon } from "lucide-react";
import { toast } from "sonner";
import { updateSystemSettingsAction } from "~/lib/actions/admin-actions";

interface SystemSecuritySettingsProps {
  settings: {
    twoFactorRequired: boolean;
    sessionTimeout: number;
    passwordMinLength: number;
    loginAttempts: number;
  };
}

export function SystemSecuritySettings({
  settings,
}: SystemSecuritySettingsProps): JSX.Element {
  const [formData, setFormData] = useState(settings);
  const [state, formAction, isPending] = useActionState(
    updateSystemSettingsAction,
    null,
  );

  const handleToggle = (key: keyof typeof formData, value: boolean): void => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleInputChange = (key: keyof typeof formData, value: string): void => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      setFormData((prev) => ({ ...prev, [key]: numValue }));
    }
  };

  const handleSelectChange = (key: keyof typeof formData, value: string): void => {
    const numValue = parseInt(value, 10);
    setFormData((prev) => ({ ...prev, [key]: numValue }));
  };

  // Handle successful save
  useEffect(() => {
    if (state?.success) {
      toast.success(state.message ?? "Security settings saved successfully!");
    } else if (state) {
      if (state.error) {
        toast.error(state.error);
      }
    }
  }, [state]);

  const hasChanges = JSON.stringify(formData) !== JSON.stringify(settings);

  return (
    <div className="space-y-6">
      {/* Two-Factor Authentication */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Require Two-Factor Authentication</Label>
            <p className="text-sm text-muted-foreground">
              Enforce 2FA for all organization members
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {formData.twoFactorRequired && (
              <Badge variant="default" className="text-xs">
                Enforced
              </Badge>
            )}
            <Switch
              checked={formData.twoFactorRequired}
              onCheckedChange={(checked) => {
                handleToggle("twoFactorRequired", checked);
              }}
              disabled={isPending}
            />
          </div>
        </div>

        <Separator />

        {/* Session Timeout */}
        <div className="space-y-2">
          <Label>Session Timeout</Label>
          <p className="text-sm text-muted-foreground mb-2">
            Automatically log out users after inactivity
          </p>
          <Select
            value={formData.sessionTimeout.toString()}
            onValueChange={(value) => {
              handleSelectChange("sessionTimeout", value);
            }}
            disabled={isPending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15 minutes</SelectItem>
              <SelectItem value="30">30 minutes</SelectItem>
              <SelectItem value="60">1 hour</SelectItem>
              <SelectItem value="120">2 hours</SelectItem>
              <SelectItem value="240">4 hours</SelectItem>
              <SelectItem value="480">8 hours</SelectItem>
              <SelectItem value="0">Never (not recommended)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Password Requirements */}
        <div className="space-y-2">
          <Label>Minimum Password Length</Label>
          <p className="text-sm text-muted-foreground mb-2">
            Minimum number of characters required for passwords
          </p>
          <Input
            type="number"
            min="6"
            max="128"
            value={formData.passwordMinLength}
            onChange={(e) => {
              handleInputChange("passwordMinLength", e.target.value);
            }}
            disabled={isPending}
          />
          <p className="text-xs text-muted-foreground">
            Recommended: 8 or more characters
          </p>
        </div>

        <Separator />

        {/* Login Attempts */}
        <div className="space-y-2">
          <Label>Max Login Attempts</Label>
          <p className="text-sm text-muted-foreground mb-2">
            Lock account after this many failed login attempts
          </p>
          <Select
            value={formData.loginAttempts.toString()}
            onValueChange={(value) => {
              handleSelectChange("loginAttempts", value);
            }}
            disabled={isPending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 attempts</SelectItem>
              <SelectItem value="5">5 attempts</SelectItem>
              <SelectItem value="10">10 attempts</SelectItem>
              <SelectItem value="0">Unlimited (not recommended)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Security Warning */}
      {(formData.sessionTimeout === 0 || formData.loginAttempts === 0) && (
        <div className="flex items-start space-x-2 p-3 bg-secondary-container rounded-md border border-secondary">
          <ShieldAlertIcon className="h-4 w-4 text-secondary mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-on-secondary-container">
              Security Warning
            </p>
            <p className="text-secondary">
              Your current settings may reduce security. Consider enabling
              session timeouts and login attempt limits.
            </p>
          </div>
        </div>
      )}

      {/* Save Button */}
      <form action={formAction} className="pt-4">
        <input
          type="hidden"
          name="settings"
          value={JSON.stringify({ security: formData })}
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
              Save Security Settings
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
