"use client";

import { useActionState, useState, useEffect } from "react";
import { SaveCancelButtons } from "~/components/save-cancel-buttons";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import {
  updateNotificationPreferencesAction,
  type UpdatePreferencesResult,
} from "./actions";
import { cn } from "~/lib/utils";
import React from "react";

/** Minimal preference shape for client rendering (CORE-SEC-006) */
export interface NotificationPreferencesData {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  emailNotifyOnAssigned: boolean;
  inAppNotifyOnAssigned: boolean;
  emailNotifyOnStatusChange: boolean;
  inAppNotifyOnStatusChange: boolean;
  emailNotifyOnNewComment: boolean;
  inAppNotifyOnNewComment: boolean;
  emailNotifyOnNewIssue: boolean;
  inAppNotifyOnNewIssue: boolean;
  emailWatchNewIssuesGlobal: boolean;
  inAppWatchNewIssuesGlobal: boolean;
}

interface NotificationPreferencesFormProps {
  preferences: NotificationPreferencesData;
}

export function NotificationPreferencesForm({
  preferences,
}: NotificationPreferencesFormProps): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<
    UpdatePreferencesResult | undefined,
    FormData
  >(updateNotificationPreferencesAction, undefined);

  // Control visibility of feedback (flash message and button state)
  const [showFeedback, setShowFeedback] = useState(false);

  // Show feedback when state updates
  useEffect(() => {
    if (state) {
      setShowFeedback(true);
    }
  }, [state]);

  // Client-side state for main switches to control disabled state of other inputs
  const [emailMainEnabled, setEmailMainEnabled] = useState(
    preferences.emailEnabled
  );
  const [inAppMainEnabled, setInAppMainEnabled] = useState(
    preferences.inAppEnabled
  );

  // Update state if preferences change (e.g. after server action)
  useEffect(() => {
    setEmailMainEnabled(preferences.emailEnabled);
    setInAppMainEnabled(preferences.inAppEnabled);
  }, [preferences.emailEnabled, preferences.inAppEnabled]);

  // Reset key to force re-render on cancel
  const [resetKey, setResetKey] = useState(0);

  return (
    <form
      key={resetKey}
      action={formAction}
      className="space-y-8"
      data-testid="notification-preferences-form"
    >
      {state && !state.ok && showFeedback && (
        <div
          className={cn(
            "rounded-md border p-4 border-destructive/20 bg-destructive/10 text-destructive"
          )}
        >
          <p className="text-sm font-medium">{state.message}</p>
        </div>
      )}

      {/* Main Switches */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Channels
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <MainSwitchItem
            id="emailEnabled"
            label="Email Notifications"
            description="Main switch for all email notifications"
            checked={emailMainEnabled}
            onCheckedChange={setEmailMainEnabled}
          />
          <MainSwitchItem
            id="inAppEnabled"
            label="In-App Notifications"
            description="Main switch for all in-app notifications"
            checked={inAppMainEnabled}
            onCheckedChange={setInAppMainEnabled}
          />
        </div>
      </div>

      {/* New Issue Notifications */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          New Issue Notifications
        </h3>
        <div className="rounded-lg border border-outline-variant/50 bg-surface/50 overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-outline-variant/50 bg-surface-variant/30 p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <div>Scope</div>
            <div className="text-center w-16">Email</div>
            <div className="text-center w-16">In-App</div>
          </div>
          <div className="divide-y divide-outline-variant/50">
            <PreferenceRow
              label="Owned Machines"
              description="New issues on machines you own"
              emailId="emailNotifyOnNewIssue"
              inAppId="inAppNotifyOnNewIssue"
              emailDefault={preferences.emailNotifyOnNewIssue}
              inAppDefault={preferences.inAppNotifyOnNewIssue}
              emailDisabled={!emailMainEnabled}
              inAppDisabled={!inAppMainEnabled}
            />
            <PreferenceRow
              label="All Machines"
              description="Notify for EVERY new issue on the platform"
              emailId="emailWatchNewIssuesGlobal"
              inAppId="inAppWatchNewIssuesGlobal"
              emailDefault={preferences.emailWatchNewIssuesGlobal}
              inAppDefault={preferences.inAppWatchNewIssuesGlobal}
              emailDisabled={!emailMainEnabled}
              inAppDisabled={!inAppMainEnabled}
            />
          </div>
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
              emailDisabled={!emailMainEnabled}
              inAppDisabled={!inAppMainEnabled}
            />
            <PreferenceRow
              label="Status Changes"
              description="When status changes on watched issues"
              emailId="emailNotifyOnStatusChange"
              inAppId="inAppNotifyOnStatusChange"
              emailDefault={preferences.emailNotifyOnStatusChange}
              inAppDefault={preferences.inAppNotifyOnStatusChange}
              emailDisabled={!emailMainEnabled}
              inAppDisabled={!inAppMainEnabled}
            />
            <PreferenceRow
              label="New Comments"
              description="When comments are added to watched issues"
              emailId="emailNotifyOnNewComment"
              inAppId="inAppNotifyOnNewComment"
              emailDefault={preferences.emailNotifyOnNewComment}
              inAppDefault={preferences.inAppNotifyOnNewComment}
              emailDisabled={!emailMainEnabled}
              inAppDisabled={!inAppMainEnabled}
            />
          </div>
        </div>
      </div>

      <div className="pt-2">
        <SaveCancelButtons
          isPending={isPending}
          isSuccess={!!state?.ok && showFeedback}
          onCancel={() => {
            setResetKey((k) => k + 1);
            setEmailMainEnabled(preferences.emailEnabled);
            setInAppMainEnabled(preferences.inAppEnabled);
            setShowFeedback(false);
          }}
          saveLabel="Save Preferences"
        />
      </div>
    </form>
  );
}

interface MainSwitchItemProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function MainSwitchItem({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: MainSwitchItemProps): React.JSX.Element {
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
