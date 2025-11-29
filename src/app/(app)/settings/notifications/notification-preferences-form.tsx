"use client";

import { useActionState } from "react";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  updateNotificationPreferencesAction,
  type UpdatePreferencesResult,
} from "./actions";
import { type notificationPreferences } from "~/server/db/schema";

interface NotificationPreferencesFormProps {
  preferences: typeof notificationPreferences.$inferSelect;
}

import React from "react";

export function NotificationPreferencesForm({
  preferences,
}: NotificationPreferencesFormProps): React.JSX.Element {
  const [state, formAction] = useActionState<
    UpdatePreferencesResult | undefined,
    FormData
  >(updateNotificationPreferencesAction, undefined);

  return (
    <form action={formAction}>
      <Card className="border-outline-variant">
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>
            Manage how and when you receive notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {state && !state.ok && (
            <div className="text-sm text-destructive">{state.message}</div>
          )}

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Channels
            </h3>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="emailEnabled">Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications via email
                </p>
              </div>
              <Switch
                id="emailEnabled"
                name="emailEnabled"
                defaultChecked={preferences.emailEnabled}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="inAppEnabled">In-App Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Show notifications in the app header
                </p>
              </div>
              <Switch
                id="inAppEnabled"
                name="inAppEnabled"
                defaultChecked={preferences.inAppEnabled}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Events
            </h3>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notifyOnAssigned">Issue Assignment</Label>
                <p className="text-sm text-muted-foreground">
                  When an issue is assigned to you
                </p>
              </div>
              <Switch
                id="notifyOnAssigned"
                name="notifyOnAssigned"
                defaultChecked={preferences.notifyOnAssigned}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notifyOnStatusChange">Status Changes</Label>
                <p className="text-sm text-muted-foreground">
                  When status changes on watched issues
                </p>
              </div>
              <Switch
                id="notifyOnStatusChange"
                name="notifyOnStatusChange"
                defaultChecked={preferences.notifyOnStatusChange}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notifyOnNewComment">New Comments</Label>
                <p className="text-sm text-muted-foreground">
                  When comments are added to watched issues
                </p>
              </div>
              <Switch
                id="notifyOnNewComment"
                name="notifyOnNewComment"
                defaultChecked={preferences.notifyOnNewComment}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Machine Ownership
            </h3>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notifyOnNewIssue">
                  New Issues on Owned Machines
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications for new issues on machines you own
                </p>
              </div>
              <Switch
                id="notifyOnNewIssue"
                name="notifyOnNewIssue"
                defaultChecked={preferences.notifyOnNewIssue}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="autoWatchOwnedMachines">
                  Auto-Watch Owned Machines
                </Label>
                <p className="text-sm text-muted-foreground">
                  Automatically watch new issues reported on machines you own
                </p>
              </div>
              <Switch
                id="autoWatchOwnedMachines"
                name="autoWatchOwnedMachines"
                defaultChecked={preferences.autoWatchOwnedMachines}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Global
            </h3>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="watchNewIssuesGlobal">
                  Watch All New Issues
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications for EVERY new issue reported (use with
                  caution)
                </p>
              </div>
              <Switch
                id="watchNewIssuesGlobal"
                name="watchNewIssuesGlobal"
                defaultChecked={preferences.watchNewIssuesGlobal}
              />
            </div>
          </div>

          <div className="pt-4">
            <Button type="submit">Save Preferences</Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
