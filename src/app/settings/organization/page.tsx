/**
 * Organization Settings Page
 * Server Component with organization profile management
 * Phase 4B.1: Organization Settings
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { Badge } from "~/components/ui/badge";
import { CalendarIcon, GlobeIcon } from "lucide-react";
import { requireMemberAccess } from "~/lib/organization-context";
import { getCurrentOrganization, getOrganizationStats } from "~/lib/dal/organizations";
import { OrganizationProfileForm } from "./components/OrganizationProfileForm";
import { OrganizationLogoForm } from "./components/OrganizationLogoForm";
import { format } from "date-fns";

export default async function OrganizationSettingsPage() {
  const { organization: _organization } = await requireMemberAccess();
  
  // Fetch organization details and statistics in parallel
  const [organization, stats] = await Promise.all([
    getCurrentOrganization(),
    getOrganizationStats(),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Organization Settings</h1>
        <p className="text-muted-foreground">
          Manage your organization profile, logo, and basic information
        </p>
      </div>

      {/* Organization Overview Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{organization.name}</CardTitle>
              <CardDescription>
                Organization ID: <code className="text-xs">{organization.id}</code>
              </CardDescription>
            </div>
            <div className="text-right">
              <Badge variant="secondary">Active</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center text-sm text-muted-foreground">
                <CalendarIcon className="mr-2 h-4 w-4" />
                Created {format(new Date(organization.created_at), "PPP")}
              </div>
              {organization.subdomain && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <GlobeIcon className="mr-2 h-4 w-4" />
                  Subdomain: {organization.subdomain}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center text-sm text-muted-foreground">
                <CalendarIcon className="mr-2 h-4 w-4" />
                Updated {format(new Date(organization.updated_at), "PPP")}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Organization Profile Form */}
        <Card>
          <CardHeader>
            <CardTitle>Organization Profile</CardTitle>
            <CardDescription>
              Update your organization's basic information and contact details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OrganizationProfileForm 
              organization={{
                name: organization.name,
                description: organization.description || "",
                website: organization.website || "",
                phone: organization.phone || "",
                address: organization.address || "",
              }}
            />
          </CardContent>
        </Card>

        {/* Organization Logo Form */}
        <Card>
          <CardHeader>
            <CardTitle>Organization Logo</CardTitle>
            <CardDescription>
              Upload or update your organization's logo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OrganizationLogoForm 
              currentLogoUrl={organization.logo_url || ""} 
            />
          </CardContent>
        </Card>
      </div>

      {/* Advanced Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Advanced Settings</CardTitle>
          <CardDescription>
            Advanced organization configuration and preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Separator />
            
            {/* Organization Statistics */}
            <div>
              <h4 className="text-sm font-medium mb-3">Organization Statistics</h4>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <div className="text-2xl font-bold">{stats.members.total}</div>
                  <p className="text-xs text-muted-foreground">Total Members</p>
                </div>
                <div className="space-y-2">
                  <div className="text-2xl font-bold">{stats.issues.total}</div>
                  <p className="text-xs text-muted-foreground">Active Issues</p>
                </div>
                <div className="space-y-2">
                  <div className="text-2xl font-bold">{stats.machines.total}</div>
                  <p className="text-xs text-muted-foreground">Total Machines</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Danger Zone */}
            <div>
              <h4 className="text-sm font-medium text-destructive mb-3">Danger Zone</h4>
              <p className="text-sm text-muted-foreground mb-4">
                These actions are permanent and cannot be undone. Proceed with caution.
              </p>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Contact support to delete your organization or transfer ownership.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}