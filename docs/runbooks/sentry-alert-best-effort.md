# Sentry Alert Rule: Primary-Path vs Best-Effort Failures

## Overview

`reportError()` attaches a `pinpoint.bestEffort` boolean to every Sentry event
(`contexts.pinpoint.bestEffort`). This flag distinguishes failures that are
**expected to be tolerated** (post-commit side-effects: notifications, blob
deletions, Discord webhooks) from **primary-path failures** that require
immediate attention (issue creation, auth, data mutations).

## How the flag is populated

`reportError` in `src/lib/observability/report-error.ts` forwards the full
`ReportContext` object as the `pinpoint` Sentry context:

```ts
Sentry.captureException(error, { contexts: { pinpoint: context } });
```

Call sites pass `bestEffort: true` when the failure is tolerated by design:

```ts
// Best-effort: notification delivery failure — logged, alerted softly
reportError(err, { action: "email-channel.deliver", bestEffort: true });

// Primary path: no bestEffort flag → alert fires immediately
reportError(err, { action: "createIssueAction" });
```

## Sentry alert rule configuration

Create two alert rules in **Alerts → Issue Alerts**:

### Rule 1 — Primary-path error (page immediately)

| Field       | Value                                                                        |
| ----------- | ---------------------------------------------------------------------------- |
| Name        | `Primary-path error`                                                         |
| Environment | `production`                                                                 |
| Condition   | An event is seen with tag `contexts.pinpoint.bestEffort` not equal to `true` |
| Action      | PagerDuty / Slack `#alerts-critical`                                         |
| Frequency   | 1 min (deduplicated per issue)                                               |

> Sentry surfaces `contexts.*` entries as searchable tags in Issue Alerts using
> the `contexts.pinpoint.bestEffort` key. In the UI, use the
> **"The event's tags match"** condition and enter
> `contexts.pinpoint.bestEffort` `does not equal` `true`.

### Rule 2 — Best-effort error (notify without paging)

| Field       | Value                                                                    |
| ----------- | ------------------------------------------------------------------------ |
| Name        | `Best-effort error`                                                      |
| Environment | `production`                                                             |
| Condition   | An event is seen with tag `contexts.pinpoint.bestEffort` equal to `true` |
| Action      | Slack `#alerts-warnings` (no PagerDuty)                                  |
| Frequency   | 15 min                                                                   |

## Verifying the flag in Sentry

1. Trigger a notification delivery failure locally (e.g. misconfigure Resend
   API key).
2. In Sentry → Issues, open the event.
3. Under **Contexts → pinpoint**, confirm `bestEffort: true` appears.
4. In the Issue Alert conditions preview, the rule should match.

## Call sites that set `bestEffort: true`

| File                                              | Action tag                      | Reason                                              |
| ------------------------------------------------- | ------------------------------- | --------------------------------------------------- |
| `src/lib/notifications/channels/email-channel.ts` | `email-channel.deliver`         | Pre/during-send failure on post-commit notification |
| `src/lib/notifications/dispatch.ts`               | `notifications.dispatch.fanout` | Per-channel delivery failure in fan-out loop        |

Primary-path call sites (no `bestEffort`) fire the page-immediately rule and
are not listed here — any `reportError` without `bestEffort: true` qualifies.
