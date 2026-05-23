"use client";

import { useActionState, useState, useEffect, useRef } from "react";
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
  discordEnabled: boolean;
  suppressOwnActions: boolean;
  emailNotifyOnAssigned: boolean;
  inAppNotifyOnAssigned: boolean;
  discordNotifyOnAssigned: boolean;
  emailNotifyOnStatusChange: boolean;
  inAppNotifyOnStatusChange: boolean;
  discordNotifyOnStatusChange: boolean;
  emailNotifyOnNewComment: boolean;
  inAppNotifyOnNewComment: boolean;
  discordNotifyOnNewComment: boolean;
  emailNotifyOnMentioned: boolean;
  inAppNotifyOnMentioned: boolean;
  discordNotifyOnMentioned: boolean;
  emailNotifyOnNewIssue: boolean;
  inAppNotifyOnNewIssue: boolean;
  discordNotifyOnNewIssue: boolean;
  emailWatchNewIssuesGlobal: boolean;
  inAppWatchNewIssuesGlobal: boolean;
  discordWatchNewIssuesGlobal: boolean;
}

interface NotificationPreferencesFormProps {
  preferences: NotificationPreferencesData;
  isInternalAccount?: boolean;
  /** True when the bot integration is enabled (admin-side); column is rendered. */
  discordIntegrationEnabled?: boolean;
  /** True when the user has linked Discord; column is enabled, no Link CTA. */
  userHasDiscord?: boolean;
}

export function NotificationPreferencesForm({
  preferences,
  isInternalAccount,
  discordIntegrationEnabled = false,
  userHasDiscord = false,
}: NotificationPreferencesFormProps): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<
    UpdatePreferencesResult | undefined,
    FormData
  >(updateNotificationPreferencesAction, undefined);

  // Control visibility of feedback (flash message and button state)
  const [showFeedback, setShowFeedback] = useState(false);

  // Reset key to force re-render on cancel and on server-revalidated preferences
  const [resetKey, setResetKey] = useState(0);

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
  const [discordMainEnabled, setDiscordMainEnabled] = useState(
    preferences.discordEnabled
  );

  // When preferences change from the server (e.g., after a successful save +
  // revalidatePath), remount the form so PreferenceRow Switches — which use
  // defaultChecked and only read it at mount — reflect the new values.
  // Also re-sync the controlled main switches. Skip the first run so the
  // initial mount doesn't trigger an unnecessary remount.
  const isFirstPreferencesSync = useRef(true);
  useEffect(() => {
    if (isFirstPreferencesSync.current) {
      isFirstPreferencesSync.current = false;
      return;
    }
    setResetKey((k) => k + 1);
    setEmailMainEnabled(preferences.emailEnabled);
    setInAppMainEnabled(preferences.inAppEnabled);
    setDiscordMainEnabled(preferences.discordEnabled);
  }, [
    preferences.emailEnabled,
    preferences.inAppEnabled,
    preferences.discordEnabled,
    preferences.suppressOwnActions,
    preferences.emailNotifyOnAssigned,
    preferences.inAppNotifyOnAssigned,
    preferences.discordNotifyOnAssigned,
    preferences.emailNotifyOnStatusChange,
    preferences.inAppNotifyOnStatusChange,
    preferences.discordNotifyOnStatusChange,
    preferences.emailNotifyOnNewComment,
    preferences.inAppNotifyOnNewComment,
    preferences.discordNotifyOnNewComment,
    preferences.emailNotifyOnMentioned,
    preferences.inAppNotifyOnMentioned,
    preferences.discordNotifyOnMentioned,
    preferences.emailNotifyOnNewIssue,
    preferences.inAppNotifyOnNewIssue,
    preferences.discordNotifyOnNewIssue,
    preferences.emailWatchNewIssuesGlobal,
    preferences.inAppWatchNewIssuesGlobal,
    preferences.discordWatchNewIssuesGlobal,
  ]);

  const showDiscord = discordIntegrationEnabled;

  // When a master switch is off, dim only the per-row toggles that are ON.
  const dimWhenChecked = "data-[state=checked]:opacity-50";
  const emailDimClass = !emailMainEnabled ? dimWhenChecked : undefined;
  const inAppDimClass = !inAppMainEnabled ? dimWhenChecked : undefined;
  const discordDimClass = !discordMainEnabled ? dimWhenChecked : undefined;

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

      {/* Preserve email preference values for internal accounts (no email UI rendered) */}
      {isInternalAccount && (
        <>
          <input
            type="hidden"
            name="emailEnabled"
            value={preferences.emailEnabled ? "on" : ""}
          />
          <input
            type="hidden"
            name="emailNotifyOnAssigned"
            value={preferences.emailNotifyOnAssigned ? "on" : ""}
          />
          <input
            type="hidden"
            name="emailNotifyOnStatusChange"
            value={preferences.emailNotifyOnStatusChange ? "on" : ""}
          />
          <input
            type="hidden"
            name="emailNotifyOnNewComment"
            value={preferences.emailNotifyOnNewComment ? "on" : ""}
          />
          <input
            type="hidden"
            name="emailNotifyOnMentioned"
            value={preferences.emailNotifyOnMentioned ? "on" : ""}
          />
          <input
            type="hidden"
            name="emailNotifyOnNewIssue"
            value={preferences.emailNotifyOnNewIssue ? "on" : ""}
          />
          <input
            type="hidden"
            name="emailWatchNewIssuesGlobal"
            value={preferences.emailWatchNewIssuesGlobal ? "on" : ""}
          />
        </>
      )}

      {/* Preserve Discord preference values when the Discord column is hidden
          (integration disabled — `showDiscord` mirrors `discordIntegrationEnabled`,
          not link state). Without these, missing form fields would be coerced
          to false on save and silently wipe the user's saved Discord prefs.
          Mirror of the internal-account email preservation block above. */}
      {!showDiscord && (
        <>
          <input
            type="hidden"
            name="discordEnabled"
            value={preferences.discordEnabled ? "on" : ""}
          />
          <input
            type="hidden"
            name="discordNotifyOnAssigned"
            value={preferences.discordNotifyOnAssigned ? "on" : ""}
          />
          <input
            type="hidden"
            name="discordNotifyOnStatusChange"
            value={preferences.discordNotifyOnStatusChange ? "on" : ""}
          />
          <input
            type="hidden"
            name="discordNotifyOnNewComment"
            value={preferences.discordNotifyOnNewComment ? "on" : ""}
          />
          <input
            type="hidden"
            name="discordNotifyOnMentioned"
            value={preferences.discordNotifyOnMentioned ? "on" : ""}
          />
          <input
            type="hidden"
            name="discordNotifyOnNewIssue"
            value={preferences.discordNotifyOnNewIssue ? "on" : ""}
          />
          <input
            type="hidden"
            name="discordWatchNewIssuesGlobal"
            value={preferences.discordWatchNewIssuesGlobal ? "on" : ""}
          />
        </>
      )}

      {/* Main Switches */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Channels
        </h3>
        {isInternalAccount && (
          <p className="text-sm text-muted-foreground">
            Email notifications are not available for username accounts.
          </p>
        )}
        <div
          className={cn(
            "grid gap-4",
            showDiscord ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2"
          )}
        >
          <MainSwitchItem
            id="inAppEnabled"
            label="In-App Notifications"
            description="Main switch for all in-app notifications"
            checked={inAppMainEnabled}
            onCheckedChange={setInAppMainEnabled}
          />
          {!isInternalAccount && (
            <MainSwitchItem
              id="emailEnabled"
              label="Email Notifications"
              description="Main switch for all email notifications"
              checked={emailMainEnabled}
              onCheckedChange={setEmailMainEnabled}
            />
          )}
          {showDiscord && (
            <MainSwitchItem
              id="discordEnabled"
              label="Discord Notifications"
              description={
                userHasDiscord
                  ? "Main switch for all Discord DM notifications"
                  : "Link Discord in Connected Accounts to enable"
              }
              // Bind to the actual preference, not (preference && userHasDiscord).
              // The switch is already disabled when the user isn't linked, so the
              // visual stays correct. Mixing userHasDiscord into `checked` makes
              // the underlying hidden input submit "off" on save, silently
              // overwriting the user's saved preference whenever they save
              // unrelated changes while unlinked.
              checked={discordMainEnabled}
              onCheckedChange={setDiscordMainEnabled}
              disabled={!userHasDiscord}
              cta={
                userHasDiscord ? null : (
                  <a
                    href="#connected-accounts"
                    className="text-xs text-primary underline"
                  >
                    Link Discord
                  </a>
                )
              }
            />
          )}
        </div>
      </div>

      {/* Suppress Own Actions */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Behavior
        </h3>
        <div className="flex items-center justify-between rounded-lg border border-outline-variant/50 bg-surface/50 p-3 shadow-sm transition-colors duration-150 hover:bg-surface-variant/30">
          <div className="space-y-0.5 pr-4">
            <Label
              htmlFor="suppressOwnActions"
              className="text-sm font-medium cursor-pointer"
            >
              {"Don't notify me about my own actions"}
            </Label>
            <p className="text-xs text-muted-foreground">
              Skip all notifications when you are the one performing the action
            </p>
          </div>
          <Switch
            id="suppressOwnActions"
            name="suppressOwnActions"
            defaultChecked={preferences.suppressOwnActions}
          />
        </div>
      </div>

      {/* New Issue Notifications */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          New Issue Notifications
        </h3>
        <div className="rounded-lg border border-outline-variant/50 bg-surface/50 overflow-hidden">
          <MatrixHeaderRow
            firstLabel="Scope"
            isInternalAccount={isInternalAccount}
            showDiscord={showDiscord}
          />
          <div className="divide-y divide-outline-variant/50">
            <PreferenceRow
              label="Owned Machines"
              description="New issues on machines you own"
              emailId="emailNotifyOnNewIssue"
              inAppId="inAppNotifyOnNewIssue"
              emailDefault={preferences.emailNotifyOnNewIssue}
              inAppDefault={preferences.inAppNotifyOnNewIssue}
              hideEmail={isInternalAccount}
              hideDiscord={!showDiscord}
              emailClassName={emailDimClass}
              inAppClassName={inAppDimClass}
              discordClassName={discordDimClass}
              discordDisabled={!userHasDiscord}
              discordId="discordNotifyOnNewIssue"
              discordDefault={preferences.discordNotifyOnNewIssue}
            />
            <PreferenceRow
              label="All Machines"
              description="Notify for EVERY new issue on the platform"
              emailId="emailWatchNewIssuesGlobal"
              inAppId="inAppWatchNewIssuesGlobal"
              emailDefault={preferences.emailWatchNewIssuesGlobal}
              inAppDefault={preferences.inAppWatchNewIssuesGlobal}
              hideEmail={isInternalAccount}
              hideDiscord={!showDiscord}
              emailClassName={emailDimClass}
              inAppClassName={inAppDimClass}
              discordClassName={discordDimClass}
              discordDisabled={!userHasDiscord}
              discordId="discordWatchNewIssuesGlobal"
              discordDefault={preferences.discordWatchNewIssuesGlobal}
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
          <MatrixHeaderRow
            firstLabel="Event Type"
            isInternalAccount={isInternalAccount}
            showDiscord={showDiscord}
          />

          {/* Rows */}
          <div className="divide-y divide-outline-variant/50">
            <PreferenceRow
              label="Issue Assignment"
              description="When an issue is assigned to you"
              emailId="emailNotifyOnAssigned"
              inAppId="inAppNotifyOnAssigned"
              emailDefault={preferences.emailNotifyOnAssigned}
              inAppDefault={preferences.inAppNotifyOnAssigned}
              hideEmail={isInternalAccount}
              hideDiscord={!showDiscord}
              emailClassName={emailDimClass}
              inAppClassName={inAppDimClass}
              discordClassName={discordDimClass}
              discordDisabled={!userHasDiscord}
              discordId="discordNotifyOnAssigned"
              discordDefault={preferences.discordNotifyOnAssigned}
            />
            <PreferenceRow
              label="Status Changes"
              description="When status changes on watched issues"
              emailId="emailNotifyOnStatusChange"
              inAppId="inAppNotifyOnStatusChange"
              emailDefault={preferences.emailNotifyOnStatusChange}
              inAppDefault={preferences.inAppNotifyOnStatusChange}
              hideEmail={isInternalAccount}
              hideDiscord={!showDiscord}
              emailClassName={emailDimClass}
              inAppClassName={inAppDimClass}
              discordClassName={discordDimClass}
              discordDisabled={!userHasDiscord}
              discordId="discordNotifyOnStatusChange"
              discordDefault={preferences.discordNotifyOnStatusChange}
            />
            <PreferenceRow
              label="New Comments"
              description="When comments are added to watched issues"
              emailId="emailNotifyOnNewComment"
              inAppId="inAppNotifyOnNewComment"
              emailDefault={preferences.emailNotifyOnNewComment}
              inAppDefault={preferences.inAppNotifyOnNewComment}
              hideEmail={isInternalAccount}
              hideDiscord={!showDiscord}
              emailClassName={emailDimClass}
              inAppClassName={inAppDimClass}
              discordClassName={discordDimClass}
              discordDisabled={!userHasDiscord}
              discordId="discordNotifyOnNewComment"
              discordDefault={preferences.discordNotifyOnNewComment}
            />
            <PreferenceRow
              label="Mentions"
              description="When someone @mentions you in a comment"
              emailId="emailNotifyOnMentioned"
              inAppId="inAppNotifyOnMentioned"
              emailDefault={preferences.emailNotifyOnMentioned}
              inAppDefault={preferences.inAppNotifyOnMentioned}
              hideEmail={isInternalAccount}
              hideDiscord={!showDiscord}
              emailClassName={emailDimClass}
              inAppClassName={inAppDimClass}
              discordClassName={discordDimClass}
              discordDisabled={!userHasDiscord}
              discordId="discordNotifyOnMentioned"
              discordDefault={preferences.discordNotifyOnMentioned}
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
            setDiscordMainEnabled(preferences.discordEnabled);
            setShowFeedback(false);
          }}
          saveLabel="Save Preferences"
        />
      </div>
    </form>
  );
}

interface MatrixHeaderRowProps {
  firstLabel: string;
  isInternalAccount?: boolean | undefined;
  showDiscord: boolean;
}

function MatrixHeaderRow({
  firstLabel,
  isInternalAccount,
  showDiscord,
}: MatrixHeaderRowProps): React.JSX.Element {
  const visibleSwitchCount =
    1 + (isInternalAccount ? 0 : 1) + (showDiscord ? 1 : 0);
  const gridCols = `1fr${" auto".repeat(visibleSwitchCount)}`;
  return (
    <div
      className="gap-4 border-b border-outline-variant/50 bg-surface-variant/30 p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider grid"
      style={{ gridTemplateColumns: gridCols }}
    >
      <div>{firstLabel}</div>
      <div className="text-center w-16">In-App</div>
      {!isInternalAccount && <div className="text-center w-16">Email</div>}
      {showDiscord && <div className="text-center w-16">Discord</div>}
    </div>
  );
}

interface MainSwitchItemProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  cta?: React.ReactNode;
}

function MainSwitchItem({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  cta,
}: MainSwitchItemProps): React.JSX.Element {
  return (
    <div className="flex items-center justify-between rounded-lg border border-outline-variant/50 bg-surface/50 p-3 shadow-sm transition-colors duration-150 hover:bg-surface-variant/30">
      <div className="space-y-0.5 pr-4">
        <Label htmlFor={id} className="text-sm font-medium cursor-pointer">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{description}</p>
        {cta}
      </div>
      <Switch
        id={id}
        name={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
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
  emailClassName?: string | undefined;
  inAppClassName?: string | undefined;
  hideEmail?: boolean | undefined;
  hideDiscord?: boolean | undefined;
  discordId?: string | undefined;
  discordDefault?: boolean | undefined;
  discordClassName?: string | undefined;
  discordDisabled?: boolean | undefined;
}

function PreferenceRow({
  label,
  description,
  emailId,
  inAppId,
  emailDefault,
  inAppDefault,
  emailClassName,
  inAppClassName,
  hideEmail,
  hideDiscord,
  discordId,
  discordDefault,
  discordClassName,
  discordDisabled,
}: PreferenceRowProps): React.JSX.Element {
  const visibleSwitchCount = 1 + (hideEmail ? 0 : 1) + (hideDiscord ? 0 : 1);
  const gridCols = `1fr${" auto".repeat(visibleSwitchCount)}`;

  return (
    <div
      className="gap-4 p-3 items-center hover:bg-surface-variant/30 transition-colors duration-150 grid"
      style={{ gridTemplateColumns: gridCols }}
    >
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex justify-center w-16">
        <Switch
          id={inAppId}
          name={inAppId}
          defaultChecked={inAppDefault}
          className={inAppClassName}
        />
      </div>
      {!hideEmail && (
        <div className="flex justify-center w-16">
          <Switch
            id={emailId}
            name={emailId}
            defaultChecked={emailDefault}
            className={emailClassName}
          />
        </div>
      )}
      {!hideDiscord && discordId && (
        <div className="flex justify-center w-16">
          <Switch
            id={discordId}
            name={discordId}
            defaultChecked={discordDefault ?? false}
            disabled={discordDisabled ?? false}
            className={discordClassName}
          />
        </div>
      )}
    </div>
  );
}
