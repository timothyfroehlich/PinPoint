"use client";

import * as React from "react";
import { useActionState, useTransition } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Separator } from "~/components/ui/separator";
import { Badge } from "~/components/ui/badge";
import { CheckCircle2, AlertCircle, Loader2, Check } from "lucide-react";
import { cn } from "~/lib/utils";
import {
  saveDiscordConfigAction,
  validateBotToken,
  validateServerId,
  type SaveDiscordConfigResult,
  type ValidateBotTokenResult,
  type ValidateServerIdResult,
} from "./actions";

type ValidationState =
  | { kind: "idle" }
  | { kind: "validating" }
  | { kind: "valid"; message: string }
  | { kind: "invalid"; message: string };

interface DiscordConfigFormProps {
  enabled: boolean;
  guildId: string;
  inviteLink: string;
  hasToken: boolean;
}

export function DiscordConfigForm({
  enabled,
  guildId,
  inviteLink,
  hasToken,
}: DiscordConfigFormProps): React.JSX.Element {
  // Local form state — controlled inputs so we can drive the inline Validate
  // buttons off the *unsaved* values (e.g. validate a freshly-pasted token
  // before it hits Vault).
  const [tokenInput, setTokenInput] = React.useState("");
  const [guildIdInput, setGuildIdInput] = React.useState(guildId);
  const [inviteLinkInput, setInviteLinkInput] = React.useState(inviteLink);
  const [enabledInput, setEnabledInput] = React.useState(enabled);

  // Per-field validation status — transient, cleared on input change ("Stale"
  // state per the design spec D8).
  const [tokenStatus, setTokenStatus] = React.useState<ValidationState>({
    kind: "idle",
  });
  const [serverStatus, setServerStatus] = React.useState<ValidationState>({
    kind: "idle",
  });
  const [validatingToken, startTokenTransition] = useTransition();
  const [validatingServer, startServerTransition] = useTransition();

  // Save action — useActionState wraps the server action so we get pending
  // state and the structured result back. Form-level submission goes through
  // the action prop, preserving progressive enhancement.
  const [saveState, saveFormAction, isPending] = useActionState<
    SaveDiscordConfigResult | undefined,
    FormData
  >(saveDiscordConfigAction, undefined);

  // After a successful save, reconcile local state with the freshly-saved
  // server values. revalidatePath() in the action causes the parent server
  // component to re-fetch and re-render with new props — but useState only
  // initializes from props on the first render, so without this effect the
  // local inputs would stay at the user's typed values (potentially differing
  // from server-trimmed values) and isDirty would stay true even though the
  // config is in sync. Resetting all controlled inputs here closes the gap.
  React.useEffect(() => {
    if (saveState?.ok) {
      setTokenInput("");
      setGuildIdInput(guildId);
      setInviteLinkInput(inviteLink);
      setEnabledInput(enabled);
      setTokenStatus({ kind: "idle" });
      setServerStatus({ kind: "idle" });
    }
  }, [saveState, guildId, inviteLink, enabled]);

  // Activation rule: switch is interactive iff a token exists somewhere —
  // either committed in DB or freshly typed (Save will commit them together).
  // Trim before checking so whitespace-only input doesn't enable Validate /
  // the activation switch — the server schema also `.trim()`s and would
  // otherwise reject the save, leading to confusing UX.
  const tokenAvailable = hasToken || tokenInput.trim().length > 0;
  const canValidateToken = tokenAvailable;
  const canValidateServer = tokenAvailable && guildIdInput.trim().length > 0;

  // Switch gating: turning the integration ON requires fresh validation,
  // OR the saved state was already enabled (so the admin can flip back to
  // a known-good state without re-running probes). Note this is a UI gate
  // only — the server action re-runs `probeServerMembership` on every
  // enabled save and rejects bad config regardless of what the client
  // permitted, so an admin who flips OFF, edits a field to something
  // invalid, and flips back ON will be rejected on submit.
  //
  // Turning OFF is always allowed.
  const validationsPassed =
    tokenStatus.kind === "valid" && serverStatus.kind === "valid";
  const canTurnOn = validationsPassed || enabled;
  const switchDisabled = !tokenAvailable || (!enabledInput && !canTurnOn);
  const switchTitle = !tokenAvailable
    ? "Set a bot token first."
    : !enabledInput && !canTurnOn
      ? "Validate the bot token and Server ID before enabling."
      : undefined;

  // Unsaved-changes guard. Browser-level beforeunload fires on tab close,
  // refresh, and external navigation. (App Router does not expose router
  // events, so internal client-side nav via <Link> will not trigger this —
  // accepted limitation.)
  const isDirty =
    tokenInput.length > 0 ||
    guildIdInput !== guildId ||
    inviteLinkInput !== inviteLink ||
    enabledInput !== enabled;

  React.useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent): void => {
      e.preventDefault();
      // Legacy browsers ignored without setting returnValue.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
    };
  }, [isDirty]);

  // Build a per-field error map from the latest save result.
  const fieldErrors = React.useMemo(() => {
    if (!saveState || saveState.ok) return {};
    const map: Record<string, string> = {};
    for (const e of saveState.errors) map[e.field] = e.message;
    return map;
  }, [saveState]);

  function handleValidateToken(): void {
    setTokenStatus({ kind: "validating" });
    startTokenTransition(async () => {
      const fd = new FormData();
      fd.set("newToken", tokenInput);
      const result = await validateBotToken(fd);
      setTokenStatus(toValidationState(result));
    });
  }

  function handleValidateServer(): void {
    setServerStatus({ kind: "validating" });
    startServerTransition(async () => {
      const fd = new FormData();
      fd.set("guildId", guildIdInput);
      fd.set("newToken", tokenInput);
      const result = await validateServerId(fd);
      setServerStatus(toValidationState(result));
    });
  }

  function handleReset(): void {
    setTokenInput("");
    setGuildIdInput(guildId);
    setInviteLinkInput(inviteLink);
    setEnabledInput(enabled);
    setTokenStatus({ kind: "idle" });
    setServerStatus({ kind: "idle" });
  }

  return (
    <form action={saveFormAction} className="space-y-6">
      <input
        type="hidden"
        name="enabled"
        value={enabledInput ? "true" : "false"}
      />

      {/* Bot token */}
      <section className="space-y-2">
        <FieldLabel
          htmlFor="newToken"
          label="Bot token"
          // Server schema treats newToken as optional ("" = no change when a
          // token is already saved). Only flag the input as required when
          // there's no saved token to fall back on, otherwise screen-reader
          // required-field cues misrepresent the actual validation rule.
          required={!hasToken}
          hint="From Discord Developer Portal → your app → Bot → Reset Token."
          savedBadge={hasToken && tokenInput === ""}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            id="newToken"
            name="newToken"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={
              hasToken ? "Paste new token to replace" : "Paste a token..."
            }
            value={tokenInput}
            onChange={(e) => {
              setTokenInput(e.target.value);
              setTokenStatus({ kind: "idle" });
              // Server status is also stale because the token affects
              // server-membership validation.
              setServerStatus({ kind: "idle" });
            }}
            className="flex-1 max-w-[360px]"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canValidateToken || validatingToken}
            onClick={handleValidateToken}
          >
            {validatingToken ? (
              <>
                <Loader2 className="mr-1.5 size-3 animate-spin" />
                Validating...
              </>
            ) : (
              "Validate"
            )}
          </Button>
        </div>
        <ValidationStatus status={tokenStatus} />
        {fieldErrors["newToken"] && (
          <FieldError message={fieldErrors["newToken"]} />
        )}
      </section>

      <Separator />

      {/* Discord server */}
      <section className="space-y-4">
        <div className="space-y-2">
          <FieldLabel
            htmlFor="guildId"
            label="Server ID"
            required
            hint="Right-click the server in Discord → Copy Server ID. Enable Developer Mode in Settings → Advanced if hidden."
          />
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              id="guildId"
              name="guildId"
              type="text"
              inputMode="numeric"
              pattern="[0-9]+"
              placeholder="123456789012345678"
              maxLength={64}
              value={guildIdInput}
              onChange={(e) => {
                setGuildIdInput(e.target.value);
                setServerStatus({ kind: "idle" });
              }}
              required
              aria-required="true"
              className="flex-1 max-w-[360px]"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canValidateServer || validatingServer}
              onClick={handleValidateServer}
              title={tokenAvailable ? undefined : "Set a bot token first"}
            >
              {validatingServer ? (
                <>
                  <Loader2 className="mr-1.5 size-3 animate-spin" />
                  Validating...
                </>
              ) : (
                "Validate"
              )}
            </Button>
          </div>
          <ValidationStatus status={serverStatus} />
          {fieldErrors["guildId"] && (
            <FieldError message={fieldErrors["guildId"]} />
          )}
        </div>

        <div className="space-y-2">
          <FieldLabel
            htmlFor="inviteLink"
            label="Invite link"
            optional
            hint="Shown to users when DMs fail because they're not in the server. Use a non-expiring invite from your server's Invite People dialog."
          />
          <Input
            id="inviteLink"
            name="inviteLink"
            type="url"
            placeholder="https://discord.gg/..."
            maxLength={512}
            value={inviteLinkInput}
            onChange={(e) => {
              setInviteLinkInput(e.target.value);
            }}
            className="max-w-[360px]"
          />
          {fieldErrors["inviteLink"] && (
            <FieldError message={fieldErrors["inviteLink"]} />
          )}
        </div>
      </section>

      <Separator />

      {/* Activation */}
      <section className="flex items-center gap-3">
        <Switch
          id="enabled"
          checked={enabledInput}
          onCheckedChange={setEnabledInput}
          disabled={switchDisabled}
        />
        <Label
          htmlFor="enabled"
          className="text-sm font-medium"
          title={switchTitle}
        >
          {enabledInput ? "Enabled" : "Disabled"}
        </Label>
      </section>

      <SaveResetFooter
        isPending={isPending}
        isSuccess={!!saveState?.ok}
        onReset={handleReset}
      />
    </form>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────

function toValidationState(
  result: ValidateBotTokenResult | ValidateServerIdResult
): ValidationState {
  if (result.ok) {
    if ("botUsername" in result) {
      return {
        kind: "valid",
        message: `Token valid. Bot logs in as @${result.botUsername}.`,
      };
    }
    const where = result.guildName ? `“${result.guildName}”` : "this server";
    return { kind: "valid", message: `Bot has access to ${where}.` };
  }
  let message: string;
  switch (result.reason) {
    case "invalid_token":
      message = "Discord rejected this token.";
      break;
    case "not_member":
      message = "Bot isn't a member of this server.";
      break;
    case "not_configured":
      message = "Set a bot token first.";
      break;
    case "invalid_input":
      message =
        "message" in result && result.message
          ? result.message
          : "Input is invalid.";
      break;
    case "transient":
      message = `Discord didn't respond${"status" in result && result.status ? ` (HTTP ${result.status})` : ""}. Try again.`;
      break;
  }
  return { kind: "invalid", message };
}

function FieldLabel({
  htmlFor,
  label,
  required,
  optional,
  hint,
  savedBadge,
}: {
  htmlFor: string;
  label: string;
  required?: boolean;
  optional?: boolean;
  hint: string;
  savedBadge?: boolean;
}): React.JSX.Element {
  return (
    <div className="flex items-baseline gap-2 flex-wrap">
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required && (
          <span className="ml-1 text-destructive" aria-hidden>
            *
          </span>
        )}
        {optional && (
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            (optional)
          </span>
        )}
      </Label>
      {savedBadge && (
        <Badge className="bg-success/15 text-success border-success/40 text-[10px] px-1.5 py-0">
          Saved
        </Badge>
      )}
      <span className="text-xs text-muted-foreground text-pretty">
        · {hint}
      </span>
    </div>
  );
}

function ValidationStatus({
  status,
}: {
  status: ValidationState;
}): React.JSX.Element | null {
  if (status.kind === "idle") return null;
  if (status.kind === "validating") {
    return (
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Loader2 className="size-3 animate-spin" aria-hidden /> Checking with
        Discord…
      </p>
    );
  }
  if (status.kind === "valid") {
    return (
      <p className="text-xs text-success flex items-center gap-1">
        <CheckCircle2 className="size-3" aria-hidden /> {status.message}
      </p>
    );
  }
  return (
    <p className="text-xs text-destructive flex items-center gap-1">
      <AlertCircle className="size-3" aria-hidden /> {status.message}
    </p>
  );
}

function FieldError({ message }: { message: string }): React.JSX.Element {
  return (
    <p className="text-xs text-destructive flex items-center gap-1">
      <AlertCircle className="size-3" aria-hidden /> {message}
    </p>
  );
}

function SaveResetFooter({
  isPending,
  isSuccess,
  onReset,
}: {
  isPending: boolean;
  isSuccess: boolean;
  onReset: () => void;
}): React.JSX.Element {
  const [showSaved, setShowSaved] = React.useState(false);

  React.useEffect(() => {
    if (isSuccess && !isPending) {
      setShowSaved(true);
      const timer = window.setTimeout(() => setShowSaved(false), 3000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [isSuccess, isPending]);

  return (
    <div className="flex items-center gap-3 pt-4 border-t border-outline-variant/50">
      <Button
        type="submit"
        disabled={isPending || showSaved}
        className={cn(
          "min-w-[140px] transition-[color,background-color,border-color,box-shadow] duration-300",
          showSaved && "bg-success hover:bg-success/90 text-success-foreground"
        )}
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Saving...
          </>
        ) : showSaved ? (
          <>
            <Check className="mr-2 size-4" />
            Saved!
          </>
        ) : (
          "Save changes"
        )}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={onReset}
        disabled={isPending}
      >
        Reset
      </Button>
    </div>
  );
}
