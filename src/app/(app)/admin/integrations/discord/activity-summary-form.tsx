"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { DiscordChannelStatusReadout } from "~/components/integrations/DiscordChannelStatusReadout";
import {
  FeedbackMessage,
  type Feedback,
} from "~/components/integrations/FeedbackMessage";
import {
  ACTIVITY_SUMMARY_EVENT_GROUPS,
  ACTIVITY_SUMMARY_EVENT_KEYS,
  ACTIVITY_SUMMARY_INTERVAL_OPTIONS,
  describeSchedule,
  formatCentralHour,
} from "~/lib/discord/activity-summary/events";
import { useIntegrationDirtyState } from "../integrations-dirty-state";
import {
  saveActivitySummaryConfigAction,
  sendActivitySummaryNowAction,
  sendActivitySummaryTestAction,
} from "./activity-summary-actions";
import type { ActivitySummaryViewState } from "./types";

const DISABLED = "disabled";
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

function intervalValue(hours: number | null): string {
  return hours === null ? DISABLED : String(hours);
}

function intervalHours(value: string): number | null {
  return value === DISABLED ? null : Number(value);
}

/** Event keys in catalog order, so selection order never reads as dirty. */
function orderedEvents(keys: Iterable<string>): string[] {
  const chosen = new Set(keys);
  return ACTIVITY_SUMMARY_EVENT_KEYS.filter((key) => chosen.has(key));
}

function baselineSignature(state: ActivitySummaryViewState): string {
  return JSON.stringify([
    state.channelId ?? "",
    state.intervalHours,
    state.startHour,
    orderedEvents(state.events),
  ]);
}

/**
 * The activity summary settings in the Discord section
 * (discord-activity-summary §2). Saves and resets on its own (§2.5,
 * admin-integrations §2.3).
 *
 * Never submits natively: the Radix Selects would replay their mount-time
 * values on React's post-action form reset (pinpoint-ui, PP-1ajq).
 */
export function ActivitySummaryForm({
  initialState,
}: {
  initialState: ActivitySummaryViewState;
}): React.JSX.Element {
  const router = useRouter();
  const baselineChannel = initialState.channelId ?? "";
  const baselineInterval = intervalValue(initialState.intervalHours);
  const baselineStartHour = String(initialState.startHour);
  const baselineEvents = React.useMemo(
    () => orderedEvents(initialState.events),
    [initialState.events]
  );

  const [channelValue, setChannelValue] = React.useState(baselineChannel);
  const [intervalChoice, setIntervalChoice] = React.useState(baselineInterval);
  const [startHour, setStartHour] = React.useState(baselineStartHour);
  const [events, setEvents] = React.useState<string[]>(baselineEvents);
  const [channelFeedback, setChannelFeedback] = React.useState<Feedback | null>(
    null
  );
  const [announcement, setAnnouncement] = React.useState<Feedback | null>(null);
  const [isSaving, startSaveTransition] = React.useTransition();
  const [isTesting, startTestTransition] = React.useTransition();
  const [isSending, startSendTransition] = React.useTransition();
  const anyPending = isSaving || isTesting || isSending;

  // A refreshed baseline (after a save here) becomes the form's values.
  const signature = baselineSignature(initialState);
  const signatureRef = React.useRef(signature);
  React.useEffect(() => {
    if (signatureRef.current === signature) return;
    signatureRef.current = signature;
    setChannelValue(baselineChannel);
    setIntervalChoice(baselineInterval);
    setStartHour(baselineStartHour);
    setEvents(baselineEvents);
  }, [
    signature,
    baselineChannel,
    baselineInterval,
    baselineStartHour,
    baselineEvents,
  ]);

  const normalizedChannel = channelValue.trim();
  const isDirty =
    normalizedChannel !== baselineChannel ||
    intervalChoice !== baselineInterval ||
    startHour !== baselineStartHour ||
    events.join(",") !== baselineEvents.join(",");
  useIntegrationDirtyState("discord-activity-summary", isDirty);

  const isDisabled = intervalChoice === DISABLED;
  const schedule = describeSchedule(
    intervalHours(intervalChoice),
    Number(startHour)
  );

  // Send summary now uses the SAVED settings, and works while the interval is
  // Disabled (spec §3.8).
  const sendNowBlocker =
    baselineChannel.length === 0
      ? "Set a summary channel first."
      : isDirty
        ? "Save changes first."
        : null;

  function toggleEvent(key: string, checked: boolean): void {
    setEvents((current) =>
      orderedEvents(
        checked ? [...current, key] : current.filter((k) => k !== key)
      )
    );
    setAnnouncement(null);
  }

  function handleSave(): void {
    if (!isDirty || anyPending) return;
    setAnnouncement(null);
    startSaveTransition(async () => {
      const res = await saveActivitySummaryConfigAction({
        channelId: normalizedChannel,
        interval: intervalChoice,
        startHour: Number(startHour),
        events,
      });
      if (res.ok) {
        setAnnouncement({
          tone: "success",
          message: "Activity summary settings saved.",
        });
        setChannelFeedback(null);
        router.refresh();
      } else {
        setAnnouncement({ tone: "error", message: res.message });
      }
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    handleSave();
  }

  function handleReset(): void {
    setChannelValue(baselineChannel);
    setIntervalChoice(baselineInterval);
    setStartHour(baselineStartHour);
    setEvents(baselineEvents);
    setChannelFeedback(null);
    setAnnouncement(null);
  }

  function handleSendTest(): void {
    if (normalizedChannel.length === 0 || anyPending) return;
    setChannelFeedback(null);
    startTestTransition(async () => {
      const res = await sendActivitySummaryTestAction(normalizedChannel);
      if (res.ok) {
        setChannelFeedback({
          tone: "success",
          message: res.channelName
            ? `Test message sent to #${res.channelName}.`
            : "Test message sent to Discord.",
        });
        router.refresh();
      } else {
        setChannelFeedback({ tone: "error", message: res.message });
      }
    });
  }

  function handleSendNow(): void {
    if (sendNowBlocker !== null || anyPending) return;
    setAnnouncement(null);
    startSendTransition(async () => {
      const res = await sendActivitySummaryNowAction();
      if (res.ok) {
        setAnnouncement({ tone: "success", message: "Summary sent." });
      } else {
        setAnnouncement({ tone: "error", message: res.message });
      }
      // A post, or a failed one, moves the channel status (spec §3.10).
      router.refresh();
    });
  }

  const resetAvailable =
    isDirty || channelFeedback !== null || announcement !== null;

  return (
    <form onSubmit={handleSubmit} className="@container space-y-6" noValidate>
      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <Label
            id="activity-summary-channel-label"
            htmlFor="activity-summary-channel-id"
          >
            Summary channel{" "}
            <span className="text-muted-foreground font-normal">
              (optional)
            </span>
          </Label>
          <span
            id="activity-summary-channel-hint"
            className="text-muted-foreground text-xs text-pretty"
          >
            · Pick a text channel the bot can post to.
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="activity-summary-channel-id"
            name="summaryChannelId"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            enterKeyHint="done"
            placeholder="Channel ID (e.g. 123456789012345678)"
            value={channelValue}
            onChange={(e) => {
              setChannelValue(e.target.value);
              setChannelFeedback(null);
              setAnnouncement(null);
            }}
            disabled={anyPending}
            aria-describedby="activity-summary-channel-hint activity-summary-channel-status"
            className="min-w-0 max-w-[360px] flex-1 basis-56"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={isTesting}
            disabled={normalizedChannel.length === 0 || anyPending}
            onClick={handleSendTest}
          >
            Send test message
          </Button>
        </div>

        <div
          id="activity-summary-channel-status"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="min-h-5 space-y-1"
        >
          {channelFeedback ? (
            <FeedbackMessage feedback={channelFeedback} />
          ) : (
            <DiscordChannelStatusReadout
              status={initialState.status}
              statusDetail={initialState.statusDetail}
              lastPostAtIso={initialState.lastPostAtIso}
              postNoun="summary"
            />
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="grid gap-4 @md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="activity-summary-interval">Interval</Label>
            <Select
              value={intervalChoice}
              onValueChange={(value) => {
                setIntervalChoice(value);
                setAnnouncement(null);
              }}
              disabled={anyPending}
            >
              <SelectTrigger
                id="activity-summary-interval"
                aria-describedby="activity-summary-schedule"
                className="w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_SUMMARY_INTERVAL_OPTIONS.map((option) => (
                  <SelectItem
                    key={intervalValue(option.value)}
                    value={intervalValue(option.value)}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="activity-summary-start-hour">Start time</Label>
            <Select
              value={startHour}
              onValueChange={(value) => {
                setStartHour(value);
                setAnnouncement(null);
              }}
              disabled={anyPending || isDisabled}
            >
              <SelectTrigger
                id="activity-summary-start-hour"
                aria-describedby="activity-summary-schedule"
                className="w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((hour) => (
                  <SelectItem key={hour} value={String(hour)}>
                    {formatCentralHour(hour)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p
          id="activity-summary-schedule"
          aria-live="polite"
          className="text-muted-foreground text-xs"
        >
          {schedule}
        </p>
      </div>

      <fieldset className="space-y-3" disabled={anyPending}>
        <legend className="text-sm font-medium">Events</legend>
        <div className="grid gap-x-6 gap-y-4 @md:grid-cols-2 @3xl:grid-cols-4">
          {ACTIVITY_SUMMARY_EVENT_GROUPS.map((group) => (
            <div
              key={group.id}
              role="group"
              aria-labelledby={`activity-summary-group-${group.id}`}
              className="space-y-2"
            >
              <p
                id={`activity-summary-group-${group.id}`}
                className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
              >
                {group.label}
              </p>
              {group.events.map((event) => {
                const id = `activity-summary-event-${event.key}`;
                return (
                  <div key={event.key} className="flex items-center gap-2">
                    <Checkbox
                      id={id}
                      checked={events.includes(event.key)}
                      onCheckedChange={(checked) =>
                        toggleEvent(event.key, checked === true)
                      }
                      disabled={anyPending}
                    />
                    <Label
                      htmlFor={id}
                      className="cursor-pointer text-sm font-normal"
                    >
                      {event.label}
                    </Label>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </fieldset>

      <div className="border-t border-outline-variant/50 pt-4">
        {announcement && (
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="mb-3"
          >
            <FeedbackMessage feedback={announcement} />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            loading={isSaving}
            disabled={!isDirty || anyPending}
            onClick={handleSave}
          >
            Save changes
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={!resetAvailable || anyPending}
            onClick={handleReset}
          >
            Reset
          </Button>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
            {sendNowBlocker && (
              <span
                id="activity-summary-send-now-hint"
                className="text-muted-foreground text-xs"
              >
                {sendNowBlocker}
              </span>
            )}
            <Button
              type="button"
              variant="outline"
              loading={isSending}
              disabled={sendNowBlocker !== null || anyPending}
              aria-describedby={
                sendNowBlocker ? "activity-summary-send-now-hint" : undefined
              }
              onClick={handleSendNow}
            >
              Send summary now
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
