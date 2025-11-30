"use client";

import { useActionState, useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import {
  updateNotificationPreferencesAction,
  type UpdatePreferencesResult,
} from "./actions";
import { type notificationPreferences } from "~/server/db/schema";
import React from "react";

interface NotificationPreferencesFormProps {
  preferences: typeof notificationPreferences.$inferSelect;
}

export function NotificationPreferencesForm({
  preferences,
}: NotificationPreferencesFormProps): React.JSX.Element {
  const [state, formAction] = useActionState<
    UpdatePreferencesResult | undefined,
    FormData
  >(updateNotificationPreferencesAction, undefined);

  // Client-side state for master switches to control disabled state of other inputs
  const [emailMasterEnabled, setEmailMasterEnabled] = useState(
    preferences.emailEnabled
  );
  const [inAppMasterEnabled, setInAppMasterEnabled] = useState(
    preferences.inAppEnabled
  );

  // Update state if preferences change (e.g. after server action)
  useEffect(() => {
    setEmailMasterEnabled(preferences.emailEnabled);
    setInAppMasterEnabled(preferences.inAppEnabled);
  }, [preferences.emailEnabled, preferences.inAppEnabled]);

  return (
    <form action={formAction} className="space-y-8">
      {state && !state.ok && (
        <div className="text-sm text-destructive">{state.message}</div>
      )}

      {/* Master Switches */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Channels
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <MasterSwitchItem
            id="emailEnabled"
            label="Email Notifications"
            description="Master switch for all email notifications"
            checked={emailMasterEnabled}
            onCheckedChange={setEmailMasterEnabled}
          />
          <MasterSwitchItem
            id="inAppEnabled"
            label="In-App Notifications"
            description="Master switch for all in-app notifications"
            checked={inAppMasterEnabled}
            onCheckedChange={setInAppMasterEnabled}
          />
        </div>
      </div>

      {/* Events Matrix */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Events
        </h3>
        <div className="rounded-lg border border-outline-variant/50 bg-surface/50 overflow-hidden">
          {/* Header Row */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-outline-variant/50 bg-surface-variant/30 p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <div>Event Type</div>
            <div className="text-center w-16">Email</div>
            <div className="text-center w-16">In-App</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-outline-variant/50">
            <PreferenceRow
              label="Issue Assignment"
              description="When an issue is assigned to you"
              emailId="emailNotifyOnAssigned"
              inAppId="inAppNotifyOnAssigned"
              emailDefault={preferences.emailNotifyOnAssigned}
              inAppDefault={preferences.inAppNotifyOnAssigned}
              emailDisabled={!emailMasterEnabled}
              inAppDisabled={!inAppMasterEnabled}
            />
            <PreferenceRow
              label="Status Changes"
              description="When status changes on watched issues"
              emailId="emailNotifyOnStatusChange"
              inAppId="inAppNotifyOnStatusChange"
              emailDefault={preferences.emailNotifyOnStatusChange}
              inAppDefault={preferences.inAppNotifyOnStatusChange}
              emailDisabled={!emailMasterEnabled}
              inAppDisabled={!inAppMasterEnabled}
            />
            <PreferenceRow
              label="New Comments"
              description="When comments are added to watched issues"
              emailId="emailNotifyOnNewComment"
              inAppId="inAppNotifyOnNewComment"
              emailDefault={preferences.emailNotifyOnNewComment}
              inAppDefault={preferences.inAppNotifyOnNewComment}
              emailDisabled={!emailMasterEnabled}
              inAppDisabled={!inAppMasterEnabled}
            />
          </div>
        </div>
      </div>

      {/* Machine Ownership Matrix */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Machine Ownership
        </h3>
        <div className="rounded-lg border border-outline-variant/50 bg-surface/50 overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-outline-variant/50 bg-surface-variant/30 p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <div>Event Type</div>
            <div className="text-center w-16">Email</div>
            <div className="text-center w-16">In-App</div>
          </div>
          <div className="divide-y divide-outline-variant/50">
            <PreferenceRow
              label="New Issues"
              description="New issues on machines you own"
              emailId="emailNotifyOnNewIssue"
              inAppId="inAppNotifyOnNewIssue"
              emailDefault={preferences.emailNotifyOnNewIssue}
              inAppDefault={preferences.inAppNotifyOnNewIssue}
              emailDisabled={!emailMasterEnabled}
              inAppDisabled={!inAppMasterEnabled}
            />
          </div>
        </div>

        {/* Auto-watch is separate as it's logic, not a notification channel */}
        <div className="mt-4">
          <SingleSwitchItem
            id="autoWatchOwnedMachines"
            label="Auto-Watch Owned Machines"
            description="Automatically watch new issues reported on machines you own"
            defaultChecked={preferences.autoWatchOwnedMachines}
          />
        </div>
      </div>

      {/* Global Matrix */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Global
        </h3>
        <div className="rounded-lg border border-outline-variant/50 bg-surface/50 overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-outline-variant/50 bg-surface-variant/30 p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <div>Event Type</div>
            <div className="text-center w-16">Email</div>
            <div className="text-center w-16">In-App</div>
          </div>
          <div className="divide-y divide-outline-variant/50">
            <PreferenceRow
              label="Watch All New Issues"
              description="Notify for EVERY new issue (use with caution)"
              emailId="emailWatchNewIssuesGlobal"
              inAppId="inAppWatchNewIssuesGlobal"
              emailDefault={preferences.emailWatchNewIssuesGlobal}
              inAppDefault={preferences.inAppWatchNewIssuesGlobal}
              emailDisabled={!emailMasterEnabled}
              inAppDisabled={!inAppMasterEnabled}
            />
          </div>
        </div>
      </div>

      <div className="pt-2">
        <Button type="submit">Save Preferences</Button>
      </div>
    </form>
  );
}

interface MasterSwitchItemProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function MasterSwitchItem({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: MasterSwitchItemProps): React.JSX.Element {
  return (
    <div className="flex items-center justify-between rounded-lg border border-outline-variant/50 bg-surface/50 p-3 shadow-sm transition-colors hover:bg-surface-variant/30">
      <div className="space-y-0.5 pr-4">
        <Label htmlFor={id} className="text-sm font-medium cursor-pointer">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={id}
        name={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

interface SingleSwitchItemProps {
  id: string;
  label: string;
  description: string;
  defaultChecked: boolean;
}

function SingleSwitchItem({
  id,
  label,
  description,
  defaultChecked,
}: SingleSwitchItemProps): React.JSX.Element {
  return (
    <div className="flex items-center justify-between rounded-lg border border-outline-variant/50 bg-surface/50 p-3 shadow-sm transition-colors hover:bg-surface-variant/30">
      <div className="space-y-0.5 pr-4">
        <Label htmlFor={id} className="text-sm font-medium cursor-pointer">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} name={id} defaultChecked={defaultChecked} />
    </div>
  );
}

interface PreferenceRowProps {
  label: string;
  description: string;
  emailId: string;
  inAppId: string;
  emailDefault: boolean;
  inAppDefault: boolean;
  emailDisabled: boolean;
  inAppDisabled: boolean;
}

function PreferenceRow({
  label,
  description,
  emailId,
  inAppId,
  emailDefault,
  inAppDefault,
  emailDisabled,
  inAppDisabled,
}: PreferenceRowProps): React.JSX.Element {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] gap-4 p-3 items-center hover:bg-surface-variant/30 transition-colors">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex justify-center w-16">
        <Switch
          id={emailId}
          name={emailId}
          defaultChecked={emailDefault}
          disabled={emailDisabled}
        />
      </div>
      <div className="flex justify-center w-16">
        <Switch
          id={inAppId}
          name={inAppId}
          defaultChecked={inAppDefault}
          disabled={inAppDisabled}
        />
      </div>
    </div>
  );
}
