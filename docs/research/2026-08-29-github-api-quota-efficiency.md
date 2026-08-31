# GitHub API quota efficiency for the PinPoint PR lifecycle

**Date:** 2026-08-29  
**Scope:** Exploration only. No workflow changes were made.

All recommendations use structured GitHub events or compact API/CLI payloads. Browser rendering, screen scraping, and DOM inspection are explicitly out of scope: they obscure request accounting and are not a stable machine contract.

## Executive recommendation

PinPoint can cut GitHub API use substantially without weakening its exact-head gates. The best sequence is:

1. Replace the per-workflow CI fan-out with one slow watcher of the required `CI Gate`.
2. When only CI is pending, stop re-fetching reviews, comments, threads, and mergeability on every automerge poll; perform one complete exact-head audit after CI reaches a terminal state.
3. Batch the all-PR dashboard into one repository-level GraphQL query (or one `gh pr list --json` plus one review-thread query) instead of an N+1 loop.
4. Deduplicate watchers by PR and head SHA so every harness attaches to one host-local monitor instead of starting another GitHub poller.
5. Convert review/comment/commit monitoring from polling to events. Pilot ChatGPT's GitHub pull-request event trigger first; use a GitHub App/webhook receiver if PinPoint needs full control or CI/check events.
6. Keep the reaction witness as a fallback, but add an initial quiet period, slow it to 30–60 seconds, and use conditional requests.

The first three are local, relatively low-risk changes. Event-driven monitoring has the largest long-term payoff because it changes the cost from proportional to _elapsed time × open PRs × watching agents_ to proportional to actual state changes.

## What is consuming quota now

### 1. `pr-watch.py` multiplies polling by active workflow count

`pr-watch.py` starts one `gh run watch` subprocess for every active run (`scripts/workflow/pr-watch.py`, lines 721–750 and 956–978). It does not pass an interval. GitHub CLI documents a **3-second default refresh interval** for `gh run watch`, while `gh pr checks --watch` supports a configurable interval and can restrict itself to required checks ([GitHub CLI: `gh run watch`](https://cli.github.com/manual/gh_run_watch), [GitHub CLI: `gh pr checks`](https://cli.github.com/manual/gh_pr_checks)).

Illustrative load: five active runs lasting 15 minutes create 1,500 refresh opportunities at the documented default (five runs × 300 refreshes). Actual HTTP request count is an implementation detail of `gh`, so this is a cadence estimate, not a claim that every refresh is exactly one request. The script then verifies each finished run and may enter a separate 10-second `CI Gate` polling loop (`scripts/workflow/pr-watch.py`, lines 755–758 and 480–524).

### 2. The reaction witness has a high worst-case read count

`codex-reaction-witness.sh` allows 120 attempts at 10-second intervals. Each attempt reads the PR head, the full review list, and either the `eyes` or `+1` reactions list (`scripts/workflow/codex-reaction-witness.sh`, lines 30–33 and 93–127). That is roughly **360 reads over 20 minutes**, before pagination and the final comment lookup/write. A single worst-case witness can therefore consume more than one-third of the `GITHUB_TOKEN` repository bucket: GitHub documents **1,000 requests/hour/repository** for that token ([GitHub REST rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)). Concurrent witnesses are the obvious collision case.

### 3. Automerge re-reads stable gates

`merge-pr.sh --automerge` polls every 30 seconds for up to an hour (`scripts/workflow/merge-pr.sh`, lines 71–75 and 245–287). Every cycle re-runs all four gates, including:

- head SHA and CI rollup;
- review threads;
- head SHA again, reviews, and often issue comments;
- mergeability.

These reads live across `scripts/workflow/merge-pr.sh` lines 206–220 and `scripts/workflow/_pr-gates.sh` lines 49–84, 209–245, 270–327, and 413–434. When CI is the only `WAIT`, the review and thread data are normally unchanged but are fetched again anyway.

### 4. The all-PR dashboard is N+1

`pr-dashboard.sh` first lists open PR numbers, then for each PR fetches metadata, checks, review threads, head SHA, reviews, and often comments (`scripts/workflow/pr-dashboard.sh`, lines 15–119, plus `_pr-gates.sh`). That is roughly five to six reads per open PR before pagination. `orchestration-status.sh` invokes this dashboard as its PR section, so routine orchestration refreshes inherit the same cost.

GitHub CLI exposes `statusCheckRollup`, `reviews`, `comments`, `headRefOid`, labels, mergeability, and other fields on both `gh pr list --json` and `gh pr view --json` ([GitHub CLI: `gh pr list`](https://cli.github.com/manual/gh_pr_list), [GitHub CLI: `gh pr view`](https://cli.github.com/manual/gh_pr_view)). The current loop therefore pays repeatedly for data GitHub can return in a repository-level query.

A controlled run against one current PinPoint PR consumed six GraphQL points with no nested pagination. Static tracing matches that result: one repository lookup, then five GraphQL queries per PR, plus REST reads for reviews and issue comments. At ten open PRs, a single dashboard refresh is therefore about 51 GraphQL points plus the REST reads.

### 5. Small repeated lookups compound across every lifecycle command

Several narrower seams are individually cheap but appear in high-frequency paths:

- `_repo_slug` claims to memoize `gh repo view`, but callers invoke it through command substitution. Bash runs the function in a subshell, so `_REPO_SLUG_CACHE` does not survive for the next call. `pr-dashboard.sh`, `merge-handoff.sh`, and every automerge poll therefore repeat repository lookups that can be derived once from the local remote or initialized once in the parent shell.
- `merge-handoff.sh` fetches issue comments once for review evidence and again for screenshot metadata. A single comments response can feed both consumers.
- The CLI path in `huddle-pr-announce.sh` spends one `gh pr view` call to recover the title after `gh pr create`. Typed PR-create tools already return number and title. Extending the thin huddle adapter to recognize Codex's `mcp__codex_apps__github_create_pull_request` response avoids that follow-up call and keeps the hook output compact.
- `worktree_reap.py` performs one `gh pr list --head` lookup for every worktree branch before it computes local git state. Clean branches already proven to have zero commits ahead of `origin/main` can be classified locally first; GitHub should be the fallback only for branches whose landed/open state remains ambiguous.

These are not the dominant pollers, but they are good early patches because they remove calls without changing any gate semantics.

## Ranked opportunities

### A. Replace per-run CI watchers with one required-check watcher

**Proposal:** Watch only the required `CI Gate` with one process, at a 30–60 second interval. A candidate shape is `gh pr checks <PR> --required --watch --fail-fast --interval 30`, followed by one exact-head verification. Let the owning harness wait on that single process.

**Expected impact:** Very high and immediate. For the five-run, 15-minute example, one 30-second watcher has about 30 refresh opportunities instead of 1,500—a **50× cadence reduction**. Even if the precise request ratio differs, eliminating N parallel watchers and moving from three to 30 seconds removes the dominant multiplier.

**Tradeoffs:**

- It watches required checks rather than every optional workflow. This is appropriate only if `CI Gate` really aggregates every failure PinPoint intends to gate. Keep targeted failure-log retrieval after a red result.
- The watcher still polls; the harness waiting on the process reduces duplicate agent activity, not the watcher's own API use.
- Preserve the current superseded-head handling and final exact-head check.

**Harness fit:** Claude's Monitor and Codex's long-running command wait can hold one process without repeated model turns. Assign exactly one PR owner; other agents consume its terminal update rather than starting their own watcher.

The owner should publish a compact state summary—head SHA, required-check result, review witness, unresolved-thread count, and mergeability—instead of forwarding raw watch output. That reduces model context use as well as GitHub traffic.

### B. Poll only the gate that is still pending

**Proposal:** Change `merge-pr.sh --automerge` into two phases:

1. Run a full gate snapshot once. If review, thread, or conflict gates fail, stop as today.
2. If only CI is `WAIT`, poll only expected head SHA + `CI Gate`. When CI terminates, run all gates once more and merge only with the final pinned head.

An alternative is a single GraphQL query per full snapshot containing head OID, labels, mergeability, check rollup, reviews/comments, and review threads. Keep the existing head-race defense by comparing the expected head before the eventual merge.

**Expected impact:** High for automerge waits. The steady-state poll falls from roughly six or more reads to one query (or two narrow reads); stable review/comment/thread data are fetched twice per run rather than every 30 seconds.

**Tradeoffs:** A push, new finding, thread change, or conflict can occur while CI runs. That is why the complete final audit remains mandatory. Do not cache a passing review across a changed head.

### C. Batch the dashboard

**Proposal:** Replace the shell N+1 loop with either:

- one `gh pr list --limit 100 --json ...` for all fields that command exposes, plus one batched GraphQL query for review threads; or
- one GraphQL `repository { pullRequests(first: 100) { nodes { ... } } }` query containing all dashboard fields and bounded nested connections.

GitHub calculates GraphQL cost from the connections requested, with a minimum cost of one point, and limits connection page sizes to 100 ([GitHub GraphQL rate and query limits](https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api)). Add `rateLimit { cost }` during development, then rely on response headers in production rather than making a separate rate-limit query.

**Expected impact:** High when many PRs are open: approximately two or three calls/query points per dashboard refresh instead of about `5 × open PRs`, subject to GraphQL connection cost and pagination.

**Tradeoffs:** The query is more complex, and nested pagination must fail closed rather than silently truncating after 100 items. Request only fields the dashboard renders.

### D. Move monitoring from polling to events

GitHub explicitly recommends webhooks instead of API polling to stay within rate limits. It also recommends authenticated conditional requests when polling is unavoidable ([GitHub REST API best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api)). Relevant webhook families include `workflow_run`, `check_run`/`check_suite`, `pull_request`, `pull_request_review`, `issue_comment`, and `pull_request_review_thread`; GitHub documents that `workflow_run: completed` fires whether the run passed or failed ([GitHub webhook events and payloads](https://docs.github.com/en/webhooks/webhook-events-and-payloads)).

There are two viable shapes:

1. **Harness-first pilot:** ChatGPT scheduled tasks on eligible plans can trigger on GitHub pull-request activity, filter by repository/PR/author/title/label, and select reviews, comments, commit updates, or merges. Nearby matching events may be combined into one run ([OpenAI Docs: scheduled tasks](https://learn.chatgpt.com/docs/automations)). Use this to wake a single coordinator only when review state or head state changes.
2. **Repository-owned event cache:** A small GitHub App/webhook receiver consumes the relevant events and maintains one machine-readable PR lifecycle snapshot. Agents fetch that snapshot once at decision points. A `workflow_run` or check event can cover CI, which the documented ChatGPT PR trigger does not explicitly promise.

**Expected impact:** Highest long-term impact. Idle waiting consumes no PinPoint polling requests; work scales with actual events. It also prevents every harness from independently rediscovering the same state.

**Tradeoffs:**

- ChatGPT GitHub event triggers are documented for web/mobile, not the desktop app, Codex CLI, or IDE, and require a connected GitHub app with repository access. OpenAI does not document which GitHub quota bucket its connector uses, so measure the pilot rather than assuming zero upstream quota.
- GitHub does not automatically redeliver failed webhook deliveries. A receiver needs signature verification, delivery-ID idempotency, durable state, and a low-frequency reconciliation sweep ([GitHub: handling failed webhook deliveries](https://docs.github.com/en/webhooks/using-webhooks/handling-failed-webhook-deliveries), [GitHub: validating webhook deliveries](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)).
- Reactions do not have a documented webhook event, so the current reaction-only fallback still needs bounded polling unless the review contract changes.

**Harness fit:** A single long-running Codex goal can own the lifecycle outcome and surface completion/attention through desktop notifications. OpenAI documents `/goal` as durable multi-turn work and Activity/desktop notifications as the way to follow running or waiting chats ([OpenAI Docs: long-running work](https://learn.chatgpt.com/docs/long-running-work), [OpenAI Docs: notifications](https://learn.chatgpt.com/docs/notifications)). This centralizes ownership; it does not itself make GitHub polling cheaper.

### E. Deduplicate host-local watchers across harnesses

**Proposal:** Key the monitor by `repository + PR number + head SHA`. The first caller becomes the polling owner and writes a tiny machine-readable state file (for example, `pending`, `failed`, or `passed`, plus head SHA and one artifact path). Later Claude, Codex, or Antigravity callers attach to that local process/state instead of starting their own GitHub watcher. A stale PID/head invalidates the cache; a new push creates a new key.

The huddle already supplies the complementary social contract: the session that opens or adopts a PR owns its lifecycle. A host-local lock makes that ownership mechanically useful without putting raw logs into Beads or the model context.

**Expected impact:** High whenever multiple sessions inspect the same PR. It changes duplicate monitoring from `watchers × elapsed time` API traffic to one watcher per head. It also gives every harness the same compact terminal result.

**Tradeoffs:** This deduplicates only on one host. Cross-machine coordination still needs event delivery or a shared compact lifecycle record. Never reuse a result across head SHAs, and do not treat a dead watcher as a passing result.

**Harness fit:** Claude Monitor and Codex's terminal/session wait can both wait on the same local leader process without repeated model turns. Codex's GitHub plugin also exposes normalized PR, review, and thread tools; those are useful thin adapters for compact context, but OpenAI does not document whether connector-side reads are cached or which GitHub quota bucket they consume. Use them to reduce context size, not as an assumed request-reduction mechanism.

### F. Make the reaction witness a delayed, conditional fallback

**Proposal:**

- Spend the first two to five minutes waiting without API reads; most native reviews/comments should arrive in that window.
- Poll every 30–60 seconds afterward.
- Persist `ETag`/`Last-Modified` for the head, review, and reaction endpoints and send authenticated conditional requests.
- Stop immediately on an exact-head native review, a head change, or the witnessed `+1`.

GitHub says an authorized conditional GET that returns `304 Not Modified` does **not** count against the primary rate limit ([GitHub REST API best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api)). `gh api` supports custom headers and response caching, though explicit ETag handling gives the witness clearer correctness semantics ([GitHub CLI: `gh api`](https://cli.github.com/manual/gh_api)).

**Expected impact:** Medium to high. Moving from 10 to 30 seconds cuts refreshes by two-thirds; 60 seconds cuts them by five-sixths. Conditional `304`s can make unchanged polls free against the primary bucket. The quiet window removes early reads altogether.

**Tradeoffs:** Detection is slower by tens of seconds. Conditional pagination is more work because every page has its own validator. Keep an absolute deadline and fail without a witness as today.

### G. Make one event-driven lifecycle check authoritative

**Longer-term option:** Have GitHub Actions or a GitHub App publish a required `PinPoint PR lifecycle` check only when the exact head has passing CI, valid Codex evidence, resolved threads, and no conflict. Tim could explicitly authorize a PR once, then let GitHub native auto-merge wait for the required check. GitHub documents that auto-merge completes only after required reviews and status checks pass ([GitHub: automatically merging a pull request](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/automatically-merging-a-pull-request)).

**Expected impact:** Eliminates the local automerge polling loop and turns the merge wait into GitHub-maintained state.

**Tradeoffs:** This is a policy architecture change, not a quick optimization. The required check must be fail-closed, exact-head, protected from PR-controlled code, and equivalent to the current guarded script. It also needs Tim to decide whether enabling auto-merge in the GitHub UI preserves the intended human merge boundary.

## Quota isolation is useful, but is not request reduction

Personal access token and user-access-token traffic shares the authenticated user's 5,000-request/hour REST limit. GitHub App **installation** tokens have a separate installation bucket, normally at least 5,000 requests/hour, while Actions `GITHUB_TOKEN` has 1,000 requests/hour per repository ([GitHub REST rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)).

A minimal read-only PinPoint monitoring GitHub App would protect Tim's personal CLI quota and give automation a scoped identity. It does **not** reduce calls, so treat it as blast-radius containment after the polling reductions, not as the primary fix. It also adds private-key storage and hourly token minting.

## Measurement plan

Before changing behavior, record a short baseline for each script:

1. Capture `core`, `graphql`, and reset times with `GET /rate_limit` before and after a controlled run. GitHub says this endpoint does not count against the primary REST limit, though it can count toward secondary limits ([GitHub rate-limit endpoint](https://docs.github.com/en/rest/rate-limit/rate-limit)).
2. Record PR count, active workflow count, elapsed time, and whether pagination occurred.
3. Repeat after each optimization and compare bucket deltas, not just wall-clock time.
4. Add a low-quota guard: on `403`/`429`, honor `retry-after` or `x-ratelimit-reset` and stop rather than retrying aggressively. GitHub warns that continued requests while rate-limited may lead to an integration ban ([GitHub REST rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)).

For GraphQL, prefer the response rate-limit headers; GitHub explicitly recommends them over a separate `rateLimit` query when possible ([GitHub GraphQL rate and query limits](https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api)).

## What not to mistake for an optimization

- **Switching REST calls to GraphQL without reducing polling:** this may move pressure to a separate bucket, but it does not eliminate unnecessary work.
- **Giving every PR a scheduled heartbeat:** a coarse reconciliation task is a useful safety net, but a frequent scheduled task is still polling. Use event triggers for the primary path.
- **Having several agents call the same watcher:** harness waiting is valuable only when one owner publishes the result. Multiple quiet watchers still multiply GitHub traffic.
- **Opening or scraping the GitHub page in a browser:** it moves requests into an opaque client and gives no stable, auditable quota contract. Keep the monitoring path on structured events and documented API/CLI fields.
- **Fetching every failure log preemptively:** GitHub CLI notes that missing-log fallback can fetch job logs individually and become resource-intensive. Fetch detailed logs only after a confirmed failure ([GitHub CLI: `gh run view`](https://cli.github.com/manual/gh_run_view)).

## Suggested implementation order

1. Baseline `pr-watch.py`, the reaction witness, `merge-pr.sh --automerge`, and `pr-dashboard.sh` with bucket deltas.
2. Collapse CI watching to one required-check watcher at 30 seconds.
3. Make automerge poll only head + CI, followed by one full final audit.
4. Batch the dashboard and full gate snapshot.
5. Remove repeated repository/comment lookups and short-circuit locally provable worktree states.
6. Add one per-head host-local watcher lock/cache, then teach every harness adapter to attach to it.
7. Add the reaction witness quiet window, slower cadence, and conditional GETs.
8. Pilot one ChatGPT GitHub event-triggered coordinator for review/comment/commit activity, with a coarse scheduled reconciliation fallback.
9. If the pilot proves reliable, decide between a small GitHub App/webhook state cache and the larger authoritative-lifecycle-check/auto-merge design.
