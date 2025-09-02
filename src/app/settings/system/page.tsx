/**
 * System Settings Page
 * Server Component with application preferences and configuration
 * Phase 4B.3: Basic System Settings
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import {
  SettingsIcon,
  BellIcon,
  ShieldCheckIcon,
  DatabaseIcon,
  PaletteIcon,
  ClockIcon,
  GlobeIcon,
  ZapIcon,
} from "lucide-react";
import { requireMemberAccess } from "~/lib/organization-context";
import { getSystemSettings } from "~/lib/dal/system-settings";
import { SystemNotificationSettings } from "./components/SystemNotificationSettings";
import { SystemSecuritySettings } from "./components/SystemSecuritySettings";
import { SystemPreferences } from "./components/SystemPreferences";

export default async function SystemSettingsPage(): Promise<React.JSX.Element> {
  const { organization } = await requireMemberAccess();
  const organizationId = organization.id;

  // Fetch system settings from database
  const systemSettings = await getSystemSettings(organizationId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">System Settings</h1>
        <p className="text-muted-foreground">
          Configure application preferences and system-wide settings
        </p>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ZapIcon className="h-5 w-5" />
            <span>System Status</span>
          </CardTitle>
          <CardDescription>
            Current system health and configuration overview
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 bg-tertiary rounded-full"></div>
                <span className="text-sm font-medium">System Health</span>
              </div>
              <Badge variant="secondary" className="text-tertiary">
                Operational
              </Badge>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <DatabaseIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Database</span>
              </div>
              <Badge variant="secondary" className="text-tertiary">
                Connected
              </Badge>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <GlobeIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">API Status</span>
              </div>
              <Badge variant="secondary" className="text-tertiary">
                Active
              </Badge>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <ClockIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Last Updated</span>
              </div>
              <p className="text-sm text-muted-foreground">2 minutes ago</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BellIcon className="h-5 w-5" />
              <span>Notification Settings</span>
            </CardTitle>
            <CardDescription>
              Configure system-wide notification preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SystemNotificationSettings
              settings={systemSettings.notifications}
            />
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <ShieldCheckIcon className="h-5 w-5" />
              <span>Security Settings</span>
            </CardTitle>
            <CardDescription>
              Manage authentication and security policies
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SystemSecuritySettings settings={systemSettings.security} />
          </CardContent>
        </Card>
      </div>

      {/* System Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <PaletteIcon className="h-5 w-5" />
            <span>System Preferences</span>
          </CardTitle>
          <CardDescription>
            Application-wide preferences and display settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SystemPreferences settings={systemSettings.preferences} />
        </CardContent>
      </Card>

      {/* Feature Flags */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <SettingsIcon className="h-5 w-5" />
            <span>Feature Configuration</span>
          </CardTitle>
          <CardDescription>
            Enable or disable system features and experimental functionality
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              {
                name: "Real-time Updates",
                description: "Enable live updates for issues and comments",
                enabled: systemSettings.features.realTimeUpdates,
                key: "realTimeUpdates",
              },
              {
                name: "Analytics Tracking",
                description: "Collect usage analytics for system improvement",
                enabled: systemSettings.features.analyticsTracking,
                key: "analyticsTracking",
              },
              {
                name: "Beta Features",
                description: "Enable experimental features and early access",
                enabled: systemSettings.features.betaFeatures,
                key: "betaFeatures",
              },
              {
                name: "Maintenance Mode",
                description:
                  "Temporarily disable system access for maintenance",
                enabled: systemSettings.features.maintenanceMode,
                key: "maintenanceMode",
                warning: true,
              },
            ].map((feature, index) => (
              <div key={feature.key}>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-medium">{feature.name}</h4>
                      {feature.warning && (
                        <Badge variant="destructive" className="text-xs">
                          Caution
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                  <Badge variant={feature.enabled ? "default" : "secondary"}>
                    {feature.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                {index < 3 && <Separator className="my-4" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle>System Information</CardTitle>
          <CardDescription>
            Technical details and version information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">Application Version</p>
                <p className="text-sm text-muted-foreground">v1.0.0-beta</p>
              </div>
              <div>
                <p className="text-sm font-medium">Database Version</p>
                <p className="text-sm text-muted-foreground">PostgreSQL 15.3</p>
              </div>
              <div>
                <p className="text-sm font-medium">Node.js Version</p>
                <p className="text-sm text-muted-foreground">v20.10.0</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">Environment</p>
                <p className="text-sm text-muted-foreground">Development</p>
              </div>
              <div>
                <p className="text-sm font-medium">Deployment</p>
                <p className="text-sm text-muted-foreground">
                  Local Development
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Last Deployment</p>
                <p className="text-sm text-muted-foreground">Never deployed</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
