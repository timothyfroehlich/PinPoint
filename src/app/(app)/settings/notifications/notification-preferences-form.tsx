"use client";

import {
  useActionState,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useRouter } from "next/navigation";
import { SaveCancelButtons } from "~/components/save-cancel-buttons";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
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
  emailNotifyOnPinballMapComment: boolean;
  inAppNotifyOnPinballMapComment: boolean;
  discordNotifyOnPinballMapComment: boolean;
}

const ALL_PREFERENCE_KEYS = [
  "emailEnabled",
  "inAppEnabled",
  "discordEnabled",
  "suppressOwnActions",
  "emailNotifyOnAssigned",
  "inAppNotifyOnAssigned",
  "discordNotifyOnAssigned",
  "emailNotifyOnStatusChange",
  "inAppNotifyOnStatusChange",
  "discordNotifyOnStatusChange",
  "emailNotifyOnNewComment",
  "inAppNotifyOnNewComment",
  "discordNotifyOnNewComment",
  "emailNotifyOnMentioned",
  "inAppNotifyOnMentioned",
  "discordNotifyOnMentioned",
  "emailNotifyOnNewIssue",
  "inAppNotifyOnNewIssue",
  "discordNotifyOnNewIssue",
  "emailWatchNewIssuesGlobal",
  "inAppWatchNewIssuesGlobal",
  "discordWatchNewIssuesGlobal",
  "emailNotifyOnPinballMapComment",
  "inAppNotifyOnPinballMapComment",
  "discordNotifyOnPinballMapComment",
] as const satisfies readonly (keyof NotificationPreferencesData)[];

function isPreferencesDirty(
  current: NotificationPreferencesData,
  baseline: NotificationPreferencesData,
  options: {
    isInternalAccount?: boolean | undefined;
    showDiscord: boolean;
    userHasDiscord: boolean;
  }
): boolean {
  for (const key of ALL_PREFERENCE_KEYS) {
    if (options.isInternalAccount && key.startsWith("email")) {
      continue;
    }
    if (
      (!options.showDiscord || !options.userHasDiscord) &&
      key.startsWith("discord")
    ) {
      continue;
    }
    if (current[key] !== baseline[key]) {
      return true;
    }
  }
  return false;
}

type PendingNavigation = { type: "discord" } | { type: "href"; href: string };

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
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState<
    UpdatePreferencesResult | undefined,
    FormData
  >(updateNotificationPreferencesAction, undefined);

  // Control visibility of feedback (flash message and button state)
  const [showFeedback, setShowFeedback] = useState(false);

  // Controlled form state for all preferences
  const [formValues, setFormValues] =
    useState<NotificationPreferencesData>(preferences);
  const [baselinePreferences, setBaselinePreferences] =
    useState<NotificationPreferencesData>(preferences);
  const formValuesRef = useRef(formValues);
  formValuesRef.current = formValues;

  const [pendingNavigation, setPendingNavigation] =
    useState<PendingNavigation | null>(null);

  const showDiscord = discordIntegrationEnabled;

  const isDirty = useMemo(() => {
    return isPreferencesDirty(formValues, baselinePreferences, {
      isInternalAccount,
      showDiscord,
      userHasDiscord,
    });
  }, [
    formValues,
    baselinePreferences,
    isInternalAccount,
    showDiscord,
    userHasDiscord,
  ]);

  // Sync state if server revalidates preferences or prop updates (PP-az4)
  const prevPreferencesRef = useRef(preferences);
  useEffect(() => {
    if (prevPreferencesRef.current !== preferences) {
      prevPreferencesRef.current = preferences;
      setBaselinePreferences(preferences);
      setFormValues(preferences);
    }
  }, [preferences]);

  // Show feedback when state updates
  useEffect(() => {
    if (state) {
      setShowFeedback(true);
      if (state.ok) {
        setBaselinePreferences(formValuesRef.current);
      }
    }
  }, [state]);

  // Prevent React 19 form action auto-reset from triggering Radix Switch reset (which reverts to initial mount state)
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const handleReset = (event: Event): void => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    form.addEventListener("reset", handleReset, true);
    return () => {
      form.removeEventListener("reset", handleReset, true);
    };
  }, []);

  // Prevent React 19 form action auto-reset from triggering Radix Switch reset
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const handleReset = (event: Event): void => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    form.addEventListener("reset", handleReset, true);
    return () => {
      form.removeEventListener("reset", handleReset, true);
    };
  }, []);

  // beforeunload guard: disallows silent data loss on tab close, reload, or full navigation
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  // In-app navigation guard: intercepts links leaving /settings while dirty
  useEffect(() => {
    if (!isDirty) return;
    const handleClick = (event: MouseEvent): void => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target !== "" && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setPendingNavigation({
        type: "href",
        href: `${destination.pathname}${destination.search}${destination.hash}`,
      });
    };

    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, [isDirty]);

  const updatePreference = useCallback(
    (key: keyof NotificationPreferencesData, value: boolean): void => {
      setFormValues((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const navigateToConnectedAccounts = (): void => {
    const el = document.getElementById("connected-accounts");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
    window.location.hash = "connected-accounts";
  };

  const handleDiscordCtaClick = (
    event: React.MouseEvent<HTMLAnchorElement>
  ): void => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    if (!isDirty) {
      return;
    }

    event.preventDefault();
    setPendingNavigation({ type: "discord" });
  };

  const handleDiscardAndNavigateToDiscord = (): void => {
    setPendingNavigation(null);
    setFormValues(baselinePreferences);
    setShowFeedback(false);
    navigateToConnectedAccounts();
  };

  const handleSaveAndNavigateToDiscord = (): void => {
    setPendingNavigation(null);
    formRef.current?.requestSubmit();
    navigateToConnectedAccounts();
  };

  const handleDiscardAndLeave = (): void => {
    const href =
      pendingNavigation?.type === "href" ? pendingNavigation.href : null;
    setPendingNavigation(null);
    setFormValues(baselinePreferences);
    setShowFeedback(false);
    if (href) {
      router.push(href);
    }
  };

  const handleCancel = (): void => {
    setFormValues(baselinePreferences);
    setShowFeedback(false);
  };

  // When a master switch is off, dim only the per-row toggles that are ON.
  const dimWhenChecked = "data-[state=checked]:opacity-50";
  const emailDimClass = !formValues.emailEnabled ? dimWhenChecked : undefined;
  const inAppDimClass = !formValues.inAppEnabled ? dimWhenChecked : undefined;
  const discordDimClass = !formValues.discordEnabled
    ? dimWhenChecked
    : undefined;

  const NEW_ISSUE_ROWS = [
    {
      label: "Owned or Watched Machines",
      description: "New issues on machines you own or watch",
      ids: {
        email: "emailNotifyOnNewIssue",
        inApp: "inAppNotifyOnNewIssue",
        discord: "discordNotifyOnNewIssue",
      },
    },
    {
      label: "All Machines",
      description: "Notify for EVERY new issue on the platform",
      ids: {
        email: "emailWatchNewIssuesGlobal",
        inApp: "inAppWatchNewIssuesGlobal",
        discord: "discordWatchNewIssuesGlobal",
      },
    },
  ] as const;

  const EVENT_ROWS = [
    {
      label: "Issue Assignment",
      description: "When an issue is assigned to you",
      ids: {
        email: "emailNotifyOnAssigned",
        inApp: "inAppNotifyOnAssigned",
        discord: "discordNotifyOnAssigned",
      },
    },
    {
      label: "Status Changes",
      description: "When status changes on watched issues",
      ids: {
        email: "emailNotifyOnStatusChange",
        inApp: "inAppNotifyOnStatusChange",
        discord: "discordNotifyOnStatusChange",
      },
    },
    {
      label: "New Comments",
      description: "When comments are added to watched issues",
      ids: {
        email: "emailNotifyOnNewComment",
        inApp: "inAppNotifyOnNewComment",
        discord: "discordNotifyOnNewComment",
      },
    },
    {
      label: "Mentions",
      description: "When someone @mentions you in a comment",
      ids: {
        email: "emailNotifyOnMentioned",
        inApp: "inAppNotifyOnMentioned",
        discord: "discordNotifyOnMentioned",
      },
    },
    {
      label: "Pinball Map Comments",
      description:
        "When Pinball Map comments appear on machines you own or watch",
      ids: {
        email: "emailNotifyOnPinballMapComment",
        inApp: "inAppNotifyOnPinballMapComment",
        discord: "discordNotifyOnPinballMapComment",
      },
    },
  ] as const;

  return (
    <>
      <form
        ref={formRef}
        action={formAction}
        onReset={(e) => {
          e.preventDefault();
        }}
        className="space-y-8"
        data-testid="notification-preferences-form"
      >
        {state && !state.ok && showFeedback && (
          <div
            className={cn(
              "rounded-md border p-4 border-destructive/20 bg-destructive/10 text-destructive-text"
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
          {isInternalAccount && (
            <p className="text-sm text-muted-foreground">
              Email notifications are not available for username accounts.
            </p>
          )}
          <div className="@container">
            <div
              className={cn(
                "grid gap-4",
                showDiscord
                  ? "@sm:grid-cols-2 @lg:grid-cols-3"
                  : "@sm:grid-cols-2"
              )}
            >
              <MainSwitchItem
                id="inAppEnabled"
                label="In-App Notifications"
                description="Main switch for all in-app notifications"
                checked={formValues.inAppEnabled}
                onCheckedChange={(checked) =>
                  updatePreference("inAppEnabled", checked)
                }
              />
              {!isInternalAccount && (
                <MainSwitchItem
                  id="emailEnabled"
                  label="Email Notifications"
                  description="Main switch for all email notifications"
                  checked={formValues.emailEnabled}
                  onCheckedChange={(checked) =>
                    updatePreference("emailEnabled", checked)
                  }
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
                  checked={formValues.discordEnabled}
                  onCheckedChange={(checked) =>
                    updatePreference("discordEnabled", checked)
                  }
                  disabled={!userHasDiscord}
                  cta={
                    userHasDiscord ? null : (
                      <a
                        href="#connected-accounts"
                        className="text-xs text-primary underline"
                        onClick={handleDiscordCtaClick}
                      >
                        Link Discord
                      </a>
                    )
                  }
                />
              )}
            </div>
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
                Skip all notifications when you are the one performing the
                action
              </p>
            </div>
            <Switch
              id="suppressOwnActions"
              name="suppressOwnActions"
              checked={formValues.suppressOwnActions}
              onCheckedChange={(checked) =>
                updatePreference("suppressOwnActions", checked)
              }
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
              {NEW_ISSUE_ROWS.map((row) => (
                <PreferenceRow
                  key={row.ids.inApp}
                  label={row.label}
                  description={row.description}
                  emailId={row.ids.email}
                  inAppId={row.ids.inApp}
                  emailChecked={formValues[row.ids.email]}
                  inAppChecked={formValues[row.ids.inApp]}
                  onEmailChange={(checked) =>
                    updatePreference(row.ids.email, checked)
                  }
                  onInAppChange={(checked) =>
                    updatePreference(row.ids.inApp, checked)
                  }
                  hideEmail={isInternalAccount}
                  hideDiscord={!showDiscord}
                  emailClassName={emailDimClass}
                  inAppClassName={inAppDimClass}
                  discordClassName={discordDimClass}
                  discordDisabled={!userHasDiscord}
                  discordId={row.ids.discord}
                  discordChecked={formValues[row.ids.discord]}
                  onDiscordChange={(checked) =>
                    updatePreference(row.ids.discord, checked)
                  }
                />
              ))}
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
              {EVENT_ROWS.map((row) => (
                <PreferenceRow
                  key={row.ids.inApp}
                  label={row.label}
                  description={row.description}
                  emailId={row.ids.email}
                  inAppId={row.ids.inApp}
                  emailChecked={formValues[row.ids.email]}
                  inAppChecked={formValues[row.ids.inApp]}
                  onEmailChange={(checked) =>
                    updatePreference(row.ids.email, checked)
                  }
                  onInAppChange={(checked) =>
                    updatePreference(row.ids.inApp, checked)
                  }
                  hideEmail={isInternalAccount}
                  hideDiscord={!showDiscord}
                  emailClassName={emailDimClass}
                  inAppClassName={inAppDimClass}
                  discordClassName={discordDimClass}
                  discordDisabled={!userHasDiscord}
                  discordId={row.ids.discord}
                  discordChecked={formValues[row.ids.discord]}
                  onDiscordChange={(checked) =>
                    updatePreference(row.ids.discord, checked)
                  }
                />
              ))}
            </div>
          </div>
        </div>

        <div className="pt-2">
          <SaveCancelButtons
            isPending={isPending}
            isSuccess={!!state?.ok && showFeedback}
            onCancel={handleCancel}
            saveLabel="Save Preferences"
          />
        </div>
      </form>

      <AlertDialog
        open={pendingNavigation !== null}
        onOpenChange={(open) => {
          if (!open) setPendingNavigation(null);
        }}
      >
        <AlertDialogContent>
          {pendingNavigation?.type === "discord" ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Unsaved preferences</AlertDialogTitle>
                <AlertDialogDescription>
                  You have unsaved changes in your notification preferences. If
                  you navigate to link Discord, your changes will be lost unless
                  you save them first.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Stay on page</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={handleDiscardAndNavigateToDiscord}
                >
                  Discard and continue
                </AlertDialogAction>
                <Button type="button" onClick={handleSaveAndNavigateToDiscord}>
                  Save and continue
                </Button>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
                <AlertDialogDescription>
                  You have unsaved changes on this page. If you leave now, those
                  changes will be lost.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Stay on page</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={handleDiscardAndLeave}
                >
                  Discard and leave
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
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
  emailId: keyof NotificationPreferencesData;
  inAppId: keyof NotificationPreferencesData;
  emailChecked: boolean;
  inAppChecked: boolean;
  onEmailChange: (checked: boolean) => void;
  onInAppChange: (checked: boolean) => void;
  emailClassName?: string | undefined;
  inAppClassName?: string | undefined;
  hideEmail?: boolean | undefined;
  hideDiscord?: boolean | undefined;
  discordId?: keyof NotificationPreferencesData | undefined;
  discordChecked?: boolean | undefined;
  onDiscordChange?: ((checked: boolean) => void) | undefined;
  discordClassName?: string | undefined;
  discordDisabled?: boolean | undefined;
}

function PreferenceRow({
  label,
  description,
  emailId,
  inAppId,
  emailChecked,
  inAppChecked,
  onEmailChange,
  onInAppChange,
  emailClassName,
  inAppClassName,
  hideEmail,
  hideDiscord,
  discordId,
  discordChecked,
  onDiscordChange,
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
          aria-label={`${label} — in-app`}
          checked={inAppChecked}
          onCheckedChange={onInAppChange}
          className={inAppClassName}
        />
      </div>
      {!hideEmail && (
        <div className="flex justify-center w-16">
          <Switch
            id={emailId}
            name={emailId}
            aria-label={`${label} — email`}
            checked={emailChecked}
            onCheckedChange={onEmailChange}
            className={emailClassName}
          />
        </div>
      )}
      {!hideDiscord && discordId && (
        <div className="flex justify-center w-16">
          <Switch
            id={discordId}
            name={discordId}
            aria-label={`${label} — Discord`}
            checked={discordChecked ?? false}
            {...(onDiscordChange ? { onCheckedChange: onDiscordChange } : {})}
            disabled={discordDisabled ?? false}
            className={discordClassName}
          />
        </div>
      )}
    </div>
  );
}
