/**
 * System Preferences Client Island
 * Phase 4B.3: Application-wide preferences and display settings with Server Actions
 */

"use client";

import { useState, useActionState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { SaveIcon, LoaderIcon, GlobeIcon, ClockIcon, PaletteIcon } from "lucide-react";
import { toast } from "sonner";
import { updateSystemSettingsAction } from "~/lib/actions/admin-actions";

interface SystemPreferencesProps {
  settings: {
    timezone: string;
    dateFormat: string;
    theme: string;
    language: string;
    itemsPerPage: number;
  };
}

export function SystemPreferences({ settings }: SystemPreferencesProps) {
  const [formData, setFormData] = useState(settings);
  const [state, formAction, isPending] = useActionState(updateSystemSettingsAction, null);

  const handleSelectChange = (key: keyof typeof formData, value: string) => {
    if (key === "itemsPerPage") {
      setFormData(prev => ({ ...prev, [key]: parseInt(value, 10) }));
    } else {
      setFormData(prev => ({ ...prev, [key]: value }));
    }
  };

  // Handle successful save
  useEffect(() => {
    if (state?.success) {
      toast.success(state.message || "System preferences saved successfully!");
    } else if (state && !state.success) {
      if (state.error) {
        toast.error(state.error);
      }
    }
  }, [state]);

  const hasChanges = JSON.stringify(formData) !== JSON.stringify(settings);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Timezone */}
        <div className="space-y-2">
          <Label className="flex items-center space-x-2">
            <ClockIcon className="h-4 w-4" />
            <span>Timezone</span>
          </Label>
          <p className="text-sm text-muted-foreground mb-2">
            Default timezone for the organization
          </p>
          <Select
            value={formData.timezone}
            onValueChange={(value) => { handleSelectChange("timezone", value); }}
            disabled={isPending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UTC">UTC (Coordinated Universal Time)</SelectItem>
              <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
              <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
              <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
              <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
              <SelectItem value="Europe/London">GMT (Greenwich Mean Time)</SelectItem>
              <SelectItem value="Europe/Berlin">CET (Central European Time)</SelectItem>
              <SelectItem value="Asia/Tokyo">JST (Japan Standard Time)</SelectItem>
              <SelectItem value="Asia/Shanghai">CST (China Standard Time)</SelectItem>
              <SelectItem value="Australia/Sydney">AEDT (Australian Eastern)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Date Format */}
        <div className="space-y-2">
          <Label>Date Format</Label>
          <p className="text-sm text-muted-foreground mb-2">
            How dates are displayed throughout the application
          </p>
          <Select
            value={formData.dateFormat}
            onValueChange={(value) => { handleSelectChange("dateFormat", value); }}
            disabled={isPending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (US Format)</SelectItem>
              <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (EU Format)</SelectItem>
              <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (ISO Format)</SelectItem>
              <SelectItem value="MMM DD, YYYY">MMM DD, YYYY (Long Format)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Example: {new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: formData.dateFormat.includes('MMM') ? 'short' : '2-digit',
              day: '2-digit'
            })}
          </p>
        </div>

        {/* Theme */}
        <div className="space-y-2">
          <Label className="flex items-center space-x-2">
            <PaletteIcon className="h-4 w-4" />
            <span>Theme</span>
          </Label>
          <p className="text-sm text-muted-foreground mb-2">
            Default theme preference for new users
          </p>
          <Select
            value={formData.theme}
            onValueChange={(value) => { handleSelectChange("theme", value); }}
            disabled={isPending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">System (Auto)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Language */}
        <div className="space-y-2">
          <Label className="flex items-center space-x-2">
            <GlobeIcon className="h-4 w-4" />
            <span>Language</span>
          </Label>
          <p className="text-sm text-muted-foreground mb-2">
            Default language for the application interface
          </p>
          <Select
            value={formData.language}
            onValueChange={(value) => { handleSelectChange("language", value); }}
            disabled={isPending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="es">Español (Spanish)</SelectItem>
              <SelectItem value="fr">Français (French)</SelectItem>
              <SelectItem value="de">Deutsch (German)</SelectItem>
              <SelectItem value="it">Italiano (Italian)</SelectItem>
              <SelectItem value="pt">Português (Portuguese)</SelectItem>
              <SelectItem value="zh">中文 (Chinese)</SelectItem>
              <SelectItem value="ja">日本語 (Japanese)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Note: Full translation support coming in future updates
          </p>
        </div>
      </div>

      <Separator />

      {/* Display Preferences */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium">Display Preferences</h4>
        
        <div className="space-y-2">
          <Label>Items Per Page</Label>
          <p className="text-sm text-muted-foreground mb-2">
            Default number of items to show in lists and tables
          </p>
          <Select
            value={formData.itemsPerPage.toString()}
            onValueChange={(value) => { handleSelectChange("itemsPerPage", value); }}
            disabled={isPending}
          >
            <SelectTrigger className="w-full md:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 items</SelectItem>
              <SelectItem value="25">25 items</SelectItem>
              <SelectItem value="50">50 items</SelectItem>
              <SelectItem value="100">100 items</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Save Button */}
      <form action={formAction} className="pt-4">
        <input 
          type="hidden" 
          name="settings" 
          value={JSON.stringify({ preferences: formData })}
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
              Save Preferences
            </>
          )}
        </Button>
      </form>
    </div>
  );
}