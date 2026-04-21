"use client";

import * as React from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { updateDiscordConfig } from "./actions";
import { BotTokenField } from "./bot-token-field";

export function DiscordConfigForm({
  enabled,
  guildId,
  inviteLink,
  hasToken,
}: {
  enabled: boolean;
  guildId: string;
  inviteLink: string;
  hasToken: boolean;
}): React.JSX.Element {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [localEnabled, setLocalEnabled] = React.useState(enabled);

  return (
    <div className="flex flex-col gap-6">
      <BotTokenField hasToken={hasToken} />

      <form
        action={async (formData) => {
          formData.set("enabled", localEnabled ? "true" : "false");
          setPending(true);
          setError(null);
          try {
            await updateDiscordConfig(formData);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to save config");
          } finally {
            setPending(false);
          }
        }}
        className="flex flex-col gap-4"
      >
        <div className="flex items-center gap-3">
          <Switch
            id="enabled"
            checked={localEnabled}
            onCheckedChange={setLocalEnabled}
            disabled={!hasToken}
          />
          <Label htmlFor="enabled">Integration enabled</Label>
        </div>
        {!hasToken && (
          <p className="text-xs text-muted-foreground">
            Set a bot token above before enabling.
          </p>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="guildId">Guild ID (APC Discord server)</Label>
          <Input
            id="guildId"
            name="guildId"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            defaultValue={guildId}
            placeholder="123456789012345678"
            maxLength={64}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="inviteLink">Invite link</Label>
          <Input
            id="inviteLink"
            name="inviteLink"
            type="url"
            defaultValue={inviteLink}
            placeholder="https://discord.gg/..."
            maxLength={512}
          />
          <p className="text-xs text-muted-foreground">
            Shown to users when DMs fail because they aren&apos;t in the server.
          </p>
        </div>

        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Saving..." : "Save changes"}
        </Button>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>
    </div>
  );
}
