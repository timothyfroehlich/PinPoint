import type React from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { RelativeTime } from "~/components/issues/RelativeTime";
import type { DiscordChannelStatus } from "~/lib/discord/channel-check";

/**
 * The stored status of an admin-configured Discord channel (region alerts
 * §3.2; the activity summary reuses it, discord-activity-summary §2.7).
 * `postNoun` names what the channel posts: "alert" or "summary".
 */
export function DiscordChannelStatusReadout({
  status,
  statusDetail,
  lastPostAtIso,
  postNoun,
}: {
  status: DiscordChannelStatus;
  statusDetail: string | null;
  lastPostAtIso: string | null;
  postNoun: "alert" | "summary";
}): React.JSX.Element {
  switch (status) {
    case "posting": {
      return (
        <p className="text-success flex items-center gap-1.5 text-xs">
          <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
          <span>
            {statusDetail === "Test message delivered" && lastPostAtIso ? (
              <>
                Test message delivered <RelativeTime value={lastPostAtIso} />.
              </>
            ) : lastPostAtIso ? (
              <>
                Posting · Last {postNoun} <RelativeTime value={lastPostAtIso} />
                {statusDetail ? ` (${statusDetail})` : ""}.
              </>
            ) : (
              "Posting · Channel connected."
            )}
          </span>
        </p>
      );
    }
    case "cant_post":
      return (
        <p className="text-destructive-text flex items-center gap-1.5 text-xs">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden />
          <span>
            Can&apos;t post:{" "}
            {statusDetail ?? "Channel not found or bot lacks permissions."}
          </span>
        </p>
      );
    case "couldnt_check":
      return (
        <p className="text-warning flex items-center gap-1.5 text-xs">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden />
          <span>
            Couldn&apos;t check: {statusDetail ?? "Discord was unreachable."}
          </span>
        </p>
      );
    case "needs_discord":
      return (
        <p className="text-warning flex items-center gap-1.5 text-xs">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden />
          <span>
            Needs Discord:{" "}
            {statusDetail ?? "Discord bot token not configured in Vault."}
          </span>
        </p>
      );
    case "not_configured":
      return <p className="text-muted-foreground text-xs">Not configured</p>;
  }
}
