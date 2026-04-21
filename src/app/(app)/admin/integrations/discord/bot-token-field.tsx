"use client";

import * as React from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { rotateBotToken } from "./actions";

export function BotTokenField({
  hasToken,
}: {
  hasToken: boolean;
}): React.JSX.Element {
  const [isEditing, setIsEditing] = React.useState(!hasToken);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="newToken">Bot token</Label>
      {isEditing ? (
        <form
          action={async (formData) => {
            setPending(true);
            setError(null);
            try {
              await rotateBotToken(formData);
              // The masked input view below is the success state — no
              // transient message needed since the view change signals it.
              setIsEditing(false);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Failed to save token");
            } finally {
              setPending(false);
            }
          }}
          className="flex flex-col gap-2"
        >
          <Input
            id="newToken"
            name="newToken"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="MTxxxxxxxxxx..."
            required
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={pending} size="sm">
              {hasToken ? "Replace token" : "Save token"}
            </Button>
            {hasToken && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => {
                  setIsEditing(false);
                  setError(null);
                }}
              >
                Cancel
              </Button>
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            value="••••••••••••"
            readOnly
            aria-label="Bot token set"
            className="max-w-[200px]"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setIsEditing(true);
            }}
          >
            Replace
          </Button>
        </div>
      )}
    </div>
  );
}
