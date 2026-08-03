#!/usr/bin/env python3
"""Post an automated code review on a PR using the Antigravity CLI (`agy`).

Usage: ./scripts/workflow/agy_review.py [--pro | --model M] [--dry-run]
                                        [--keep-worktree] [--verbose] <PR_NUMBER>

  --pro            Use gemini-3.1-pro-high instead of the flash default.
  --model M        Use an explicit agy model id (overrides --pro).
  --dry-run        Print the exact review payload and exit. Posts nothing,
                   writes no marker.
  --keep-worktree  Leave the ephemeral checkout on disk for debugging.
  --verbose        Echo the prompt and the raw agy envelope.

`agy` is the reviewer; this script is the only thing that talks to GitHub. agy runs
with NO shell access at all (see "agy permissions" below), returns findings as JSON,
and never touches `gh`. That separation is deliberate — see "Why agy cannot attest
its own review".

## Why agy cannot attest its own review

Two measured defects in agy v1.1.7 shape this whole script:

1. **It reads outside its own workspace.** A relative path in a prompt is not resolved
   against `workspaceDirs`; observed reads landed in the root checkout, an unrelated
   worktree, and agy's own scratch dir. So the diff is INLINED into the prompt rather
   than referenced by filename. Never pass agy a path and assume it read that file.

2. **It confabulates on read failure.** When a read failed, agy did not error — it
   emitted a confident, detailed review of a *completely different PR* with an empty
   findings array. A false clean pass is the one failure mode a review gate cannot
   tolerate.

Defect 2 is why every response must carry a `proof` object echoing facts about the
diff that only a run which actually read it can produce. `verify_proof` checks it
against ground truth computed here, and a mismatch is fatal: no review is posted and
no marker is written. The marker is trustworthy precisely because it is downstream of
that check.

A third measured behaviour: **agy exits 0 even when it produced nothing usable.**
Validity is judged from the response envelope, never from the exit code.

## agy permissions

`~/.gemini/antigravity-cli/settings.json` must carry:

    "permissions": { "allow": ["read_file(*)"],
                     "deny":  ["write_file(*)", "command(*)"] }

and `~/.cache/pinpoint/agy-review` in `trustedWorkspaces`.

Denying ALL commands is deliberate rather than a curated allow-list. agy improvises
orientation commands (`pwd && ls -la`, `git branch -a; git worktree list`, `find`,
`python3 -c`), so a curated list dies on a different unlisted command every run. It is
also the stronger guarantee: with no shell there is no `python3 -c` write-around of the
`write_file` denial.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

FLASH_MODEL = "gemini-3.6-flash-high"
PRO_MODEL = "gemini-3.1-pro-high"

# Review comments post under Tim's account (`gh` is authed as timothyfroehlich), not a
# bot identity, so every comment is signed to distinguish an agy finding from one Tim
# wrote by hand.
SIGNATURE = "—Antigravity"

# SHA-pinned marker recognised by `_pr-gates.sh`'s `reviewed` gate, alongside
# `<!-- pinpoint-claude-review: -->`. The SHA pin makes it self-expiring: a later push
# changes head and re-arms the gate.
MARKER_PREFIX = "<!-- pinpoint-agy-review:"

# The review depth lives in its own comment beside the SHA marker (PP-9onv). agy records
# its tier rather than a `/code-review` level, so nothing in the record can be read as a
# depth Tim ran — `depth_phrase` in merge-handoff.sh renders `agy-*` accordingly.
DEPTH_PREFIX = "<!-- pinpoint-review-depth:"
MODEL_DEPTHS = {FLASH_MODEL: "agy-flash", PRO_MODEL: "agy-pro"}

# agy refuses a workspace outside `trustedWorkspaces`, so review checkouts live under a
# single stable parent that is trusted once rather than in a per-run temp dir.
WORKTREE_PARENT = Path.home() / ".cache" / "pinpoint" / "agy-review"

MAX_LINE_RETRIES = 2

RESPONSE_SCHEMA = {
    "type": "object",
    "required": ["summary", "findings", "proof"],
    "properties": {
        "summary": {"type": "string"},
        "findings": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["path", "line", "side", "severity", "rule", "body"],
                "properties": {
                    "path": {"type": "string"},
                    "line": {"type": "integer"},
                    "side": {"type": "string", "enum": ["RIGHT"]},
                    "severity": {"type": "string", "enum": ["high", "medium", "low"]},
                    "rule": {"type": ["string", "null"]},
                    "body": {"type": "string"},
                },
            },
        },
        "proof": {
            "type": "object",
            "required": ["files_changed", "first_diff_line"],
            "properties": {
                "files_changed": {"type": "integer"},
                "first_diff_line": {"type": "string"},
            },
        },
    },
}


class ReviewError(RuntimeError):
    """Fatal: the review did not happen. Nothing is posted, no marker is written."""


# ---------------------------------------------------------------------------
# Pure functions (unit-tested in scripts/tests/test_agy_review.py)
# ---------------------------------------------------------------------------

_DIFF_HEADER = re.compile(r"^diff --git a/(?P<old>.+?) b/(?P<new>.+)$")
_HUNK_HEADER = re.compile(r"^@@ -\d+(?:,\d+)? \+(?P<start>\d+)(?:,(?P<count>\d+))? @@")


def parse_diff_hunks(diff_text):
    """Map each file in a unified diff to the RIGHT-side line numbers it covers.

    GitHub only accepts an inline review comment on a line present in that file's diff
    hunks; a single out-of-range line 422s the entire review POST and nothing lands. So
    every finding is checked against this map before anything is sent.

    Both added (`+`) and context (` `) lines advance the right-side counter and are
    valid anchors. Removed (`-`) lines do not exist on the right side and are skipped.
    """
    hunks = {}
    current = None
    right_line = 0
    # Only lines INSIDE a hunk are payload. Without this flag the `+++ b/path` file
    # header parses as an added line and injects a bogus line 0 into every new file.
    in_hunk = False

    for raw in diff_text.splitlines():
        header = _DIFF_HEADER.match(raw)
        if header:
            current = header.group("new")
            hunks.setdefault(current, set())
            right_line = 0
            in_hunk = False
            continue

        if current is None:
            continue

        hunk = _HUNK_HEADER.match(raw)
        if hunk:
            right_line = int(hunk.group("start"))
            in_hunk = True
            continue

        if not in_hunk:
            continue

        if raw.startswith("+"):
            hunks[current].add(right_line)
            right_line += 1
        elif raw.startswith("-"):
            continue
        elif raw.startswith(" "):
            hunks[current].add(right_line)
            right_line += 1

    return hunks


def diff_proof(diff_text):
    """Ground-truth facts a run must echo back to prove it read the diff.

    Deliberately cheap to verify and impossible to guess: the exact text of the first
    `diff --git` line, and how many files the diff touches.
    """
    lines = diff_text.splitlines()
    first = next((line for line in lines if line.startswith("diff --git ")), "")
    return {
        "files_changed": sum(1 for line in lines if line.startswith("diff --git ")),
        "first_diff_line": first,
    }


def verify_proof(claimed, actual):
    """Return a list of human-readable mismatches; empty means the run read the diff."""
    problems = []
    if not isinstance(claimed, dict):
        return ["proof is missing or not an object"]
    if claimed.get("files_changed") != actual["files_changed"]:
        problems.append(
            f"proof.files_changed={claimed.get('files_changed')!r} "
            f"but the diff touches {actual['files_changed']} file(s)"
        )
    if (claimed.get("first_diff_line") or "").strip() != actual[
        "first_diff_line"
    ].strip():
        problems.append(
            f"proof.first_diff_line={claimed.get('first_diff_line')!r} "
            f"but the diff starts with {actual['first_diff_line']!r}"
        )
    return problems


def _format_ranges(lines):
    """Collapse a set of line numbers into compact `12-34, 58-72` ranges for an error."""
    if not lines:
        return "(none — this file has no right-side lines in the diff)"
    ordered = sorted(lines)
    spans = []
    start = prev = ordered[0]
    for value in ordered[1:]:
        if value == prev + 1:
            prev = value
            continue
        spans.append((start, prev))
        start = prev = value
    spans.append((start, prev))
    return ", ".join(str(a) if a == b else f"{a}-{b}" for a, b in spans)


def validate_findings(findings, hunks):
    """Return per-finding errors precise enough for agy to correct itself.

    A finding is never silently demoted into the summary body: a demoted finding creates
    no review thread, and a finding with no thread cannot block the `threads` gate. So an
    unanchorable finding is an error to be fixed, not a comment to be relocated.
    """
    errors = []
    for index, finding in enumerate(findings):
        path = finding.get("path")
        line = finding.get("line")
        if path not in hunks:
            errors.append(
                f"findings[{index}]: {path!r} is not a file in the diff. "
                f"Files in the diff: {', '.join(sorted(hunks)) or '(none)'}."
            )
            continue
        if line not in hunks[path]:
            errors.append(
                f"findings[{index}]: {path}:{line} is not in the diff. "
                f"Valid RIGHT-side lines for that file: {_format_ranges(hunks[path])}."
            )
    return errors


def build_review_payload(result, head_sha, head_moved_to=None):
    """Assemble the GitHub review POST body.

    `event` is COMMENT because GitHub rejects APPROVE/REQUEST_CHANGES on your own PR and
    `gh` is authed as the same account that opens them.
    """
    body = result["summary"]
    if head_moved_to:
        body = (
            f"> ⚠️ **The branch moved during this review.** These findings cover "
            f"`{head_sha[:7]}`, but head is now `{head_moved_to[:7]}`. The review marker "
            f"pins the reviewed commit, so the `reviewed` gate will report `stale_marker` "
            f"until the new head is reviewed.\n\n" + body
        )

    comments = [
        {
            "path": finding["path"],
            "line": finding["line"],
            "side": finding["side"],
            "body": f"{finding['body']}\n\n{SIGNATURE}",
        }
        for finding in result["findings"]
    ]

    return {
        "commit_id": head_sha,
        "event": "COMMENT",
        "body": f"{body}\n\n{SIGNATURE}",
        "comments": comments,
    }


def build_prompt(diff_text):
    """The review prompt, with the diff inlined rather than referenced by path."""
    return f"""You are reviewing a GitHub pull request for the PinPoint repository. You
are already inside a checkout of the PR's head commit. Do not search the filesystem for
the repository and do not change directories.

## Your inputs

- `REVIEW.md` at the repository root is the canonical review rubric. Read it first. It
  tells you what to prioritise and, just as importantly, what not to comment on.
- `AGENTS.md` at the repository root summarises the non-negotiable rules, each citing a
  `CORE-*` id.
- The unified diff under review is embedded at the END of this prompt, after the line
  BEGIN_DIFF. That embedded copy is authoritative — review it and nothing else.
- Every other file in the tree is the code as it will look after merge. Read whatever
  surrounding context you need to judge a change.

## Rules for `line` — this is the most common failure

`line` must be a line number that appears as an ADDED or CONTEXT line on the RIGHT (new)
side of the embedded diff, for that exact file. Derive it from the hunk headers:
`@@ -old,n +new,m @@` means the right side of that hunk covers lines `new` through
`new + m - 1`.

- Never cite a line that appears only as a removed (`-`) line.
- Never cite a file that is not in the diff.
- If a problem is real but you cannot anchor it to a valid right-side line, leave it out
  of `findings` and describe it in `summary`.

## Scope

Follow `REVIEW.md`. Prioritise the highest-priority rule violations and genuine
correctness defects. Do not comment on formatting or style that Prettier, ESLint or
oxlint already owns. Cite the `CORE-*` id in `body` whenever a rule applies.

An empty `findings` array is a valid and expected result. Do not manufacture nits to
justify having reviewed — a clean review is a real outcome.

## Proof of reading

Populate `proof` from the embedded diff: `files_changed` is the number of
`diff --git` lines in it, and `first_diff_line` is the exact text of the first such
line. If you cannot read the embedded diff, say so in `summary` and return no findings —
never describe a pull request from memory.

`proof` is machine-checked and is NOT shown to anyone. Put it only in the `proof` object.
`summary` is posted verbatim to the pull request, so it must not mention proof, file
counts, diff headers, or these instructions — write it as a reviewer addressing the
author.

BEGIN_DIFF
{diff_text}"""


def build_retry_prompt(errors):
    joined = "\n".join(f"- {error}" for error in errors)
    return (
        "Your previous response anchored findings to lines that GitHub will reject.\n\n"
        f"{joined}\n\n"
        "Re-emit the COMPLETE JSON object with those findings corrected. Keep every "
        "finding whose line was already valid, unchanged. If a finding genuinely cannot "
        "be anchored to a valid right-side line, drop it from `findings` and describe it "
        "in `summary` instead. Repeat the same `proof` values."
    )


# ---------------------------------------------------------------------------
# Shell / API helpers
# ---------------------------------------------------------------------------


def run(cmd, **kwargs):
    kwargs.setdefault("capture_output", True)
    kwargs.setdefault("text", True)
    kwargs.setdefault("check", True)
    return subprocess.run(cmd, **kwargs)  # noqa: S603


def gh_json(args):
    return json.loads(run(["gh", *args]).stdout)


def repo_slug():
    return run(
        ["gh", "repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]
    ).stdout.strip()


def head_sha_of(pr):
    return run(
        ["gh", "pr", "view", str(pr), "--json", "headRefOid", "--jq", ".headRefOid"]
    ).stdout.strip()


def render_findings_comment(result, head_sha, head_moved_to):
    """The whole review as one plain comment, for when inline anchoring is impossible.

    GitHub resolves `comments[].line` against the pull request's CURRENT diff, not against
    `commit_id`. So when head moves mid-review and the new head touched the same files,
    every anchor can fall outside the diff and the inline POST 422s as a batch — losing a
    review that is still worth reading. This renders it as prose instead: no threads, but
    nothing thrown away. The marker still pins the reviewed SHA, so the gate reports
    `stale_marker` either way.
    """
    lines = [
        f"⚠️ **Review of `{head_sha[:7]}`, which is no longer head** "
        f"(now `{head_moved_to[:7]}`). GitHub would not accept inline comments against "
        "the moved diff, so the findings are inlined below. Re-run the review on the new "
        "head to get resolvable threads.",
        "",
        result["summary"],
    ]
    if result["findings"]:
        lines += ["", "---", ""]
        for finding in result["findings"]:
            rule = finding.get("rule")
            tag = f" · `{rule}`" if rule else ""
            lines.append(
                f"**`{finding['path']}:{finding['line']}`** · "
                f"{finding.get('severity', '?')}{tag}\n\n{finding['body']}\n"
            )
    lines += ["", SIGNATURE]
    return "\n".join(lines)


def _require_shape(result):
    """Fail with a legible error rather than a KeyError on a malformed response.

    `--json-schema` constrains the first response, but the retry continuation is a plain
    follow-up prompt with no schema attached, so nothing guarantees its shape. A bare
    `result["findings"]` there raises KeyError, which neither handler in `main` catches —
    the caller gets a traceback instead of the script's own FAILED line.
    """
    if not isinstance(result, dict):
        raise ReviewError(f"agy returned {type(result).__name__}, expected an object")
    if not isinstance(result.get("findings"), list):
        raise ReviewError("agy response has no `findings` array")
    if not isinstance(result.get("summary"), str):
        raise ReviewError("agy response has no `summary` string")
    for index, finding in enumerate(result["findings"]):
        missing = [k for k in ("path", "line", "side", "body") if k not in finding]
        if missing:
            raise ReviewError(f"findings[{index}] is missing {', '.join(missing)}")
    return result


def invoke_agy(
    pr, workspace, prompt, model, schema_path, conversation_id=None, verbose=False
):
    """Run agy and return (parsed_result, conversation_id).

    Validity is judged from the envelope's `status` and the parseability of `response`.
    agy's exit code is ignored: it exits 0 even on runs that produced nothing usable.
    """
    cmd = [
        "agy",
        "-p",
        prompt,
        "--model",
        model,
        "--output-format",
        "json",
        "--json-schema",
        str(schema_path),
        "--print-timeout",
        "15m",
    ]
    if conversation_id:
        cmd += ["--conversation", conversation_id]

    completed = subprocess.run(  # noqa: S603
        cmd, cwd=workspace, capture_output=True, text=True, check=False
    )
    raw = completed.stdout.strip()
    # The envelope echoes the whole review back and can run to tens of KB. It goes to a
    # file so a failure is debuggable without re-running, but never to stdout unless
    # asked — this script is usually driven by an agent whose context it would flood.
    # Keyed by PR: two concurrent reviews are a plausible use, and a shared filename means
    # the envelope you inspect after a failure may belong to the other run.
    WORKTREE_PARENT.mkdir(parents=True, exist_ok=True)
    (WORKTREE_PARENT / f"pr-{pr}-agy-envelope.json").write_text(raw)
    if verbose:
        print(f"--- agy envelope ---\n{raw[:2000]}\n--- end ---", file=sys.stderr)

    if not raw:
        raise ReviewError(
            f"agy produced no output. stderr: {completed.stderr.strip()[:500]}"
        )

    try:
        envelope = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ReviewError(f"agy output was not JSON: {raw[:500]}") from exc

    if envelope.get("status") != "SUCCESS":
        raise ReviewError(f"agy status was {envelope.get('status')!r}: {raw[:500]}")

    try:
        result = json.loads(envelope["response"])
    except (KeyError, json.JSONDecodeError) as exc:
        raise ReviewError(
            f"agy response was not the expected JSON: {raw[:500]}"
        ) from exc

    return _require_shape(result), envelope.get("conversation_id")


def post_review(slug, pr, payload):
    proc = subprocess.run(  # noqa: S603
        [
            "gh",
            "api",
            "--method",
            "POST",
            f"repos/{slug}/pulls/{pr}/reviews",
            "--input",
            "-",
        ],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise ReviewError(f"posting the review failed: {proc.stderr.strip()[:800]}")
    return json.loads(proc.stdout)


def write_marker(slug, pr, head_sha, depth, summary):
    """Post or update the sticky SHA-pinned marker.

    Mirrors mark-claude-review.sh: one sticky comment, rewritten in place, laid out as
    `<sha marker>\\n<depth marker>\\n<visible line>`. `_marker_record` compares everything
    between the SHA prefix and `-->` to the head SHA by string equality, so the depth goes
    in its OWN comment — putting it inside the SHA marker would fail every `reviewed` gate.
    It reads the depth from the same body, so the two must stay in one comment.

    `depth` is `agy-flash` / `agy-pro`, never a `/code-review` level: `depth_phrase` in
    merge-handoff.sh renders `agy-*` as "no /code-review run", so the record cannot be
    misread as a review Tim performed.

    `jq -rs` (slurp) rather than gh's per-page `--jq`, so a marker sitting on page 2+ of a
    busy PR is still found and a duplicate is not posted.
    """
    body = (
        f"{MARKER_PREFIX} {head_sha} -->\n"
        f"{DEPTH_PREFIX} {depth} -->\n"
        f"agy review of head {head_sha[:7]} — {depth} — {summary}"
    )

    listing = run(
        ["gh", "api", "--paginate", f"repos/{slug}/issues/{pr}/comments"]
    ).stdout
    existing = subprocess.run(  # noqa: S603
        [
            "jq",
            "-rs",
            "--arg",
            "prefix",
            MARKER_PREFIX,
            # `// ""` guards a null body: jq exits 5 on `startswith(null)`, and because
            # this runs AFTER post_review that would leave the review posted, the marker
            # unwritten, and a retry posting a duplicate review.
            '[.[] | flatten | .[] | select((.body // "") | startswith($prefix))] | last.id // empty',
        ],
        input=listing,
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()

    if existing:
        run(
            [
                "gh",
                "api",
                "--method",
                "PATCH",
                f"repos/{slug}/issues/comments/{existing}",
                "-f",
                f"body={body}",
                "--jq",
                ".html_url",
            ]
        )
    else:
        run(
            [
                "gh",
                "api",
                "--method",
                "POST",
                f"repos/{slug}/issues/{pr}/comments",
                "-f",
                f"body={body}",
                "--jq",
                ".html_url",
            ]
        )


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------


def review(pr, model, dry_run, keep_worktree, verbose):
    slug = repo_slug()
    meta = gh_json(["pr", "view", str(pr), "--json", "headRefOid,baseRefName"])
    head_sha = meta["headRefOid"]
    base_ref = meta["baseRefName"]
    print(f"PR #{pr} — head {head_sha[:7]}, base {base_ref}, model {model}")

    run(["git", "fetch", "origin", f"pull/{pr}/head"])

    # Fetch the base branch too, and diff against what was JUST fetched rather than the
    # local remote-tracking ref. A stale `origin/main` gives an older merge-base, so the
    # diff contains already-merged code that is not in GitHub's diff for this PR — agy
    # then reviews it, anchors a finding to one of those lines, and the whole review POST
    # 422s (one out-of-diff comment rejects the batch). `--refmap=` keeps this read-only:
    # a plain fetch would fast-forward origin/<base> under other agents holding worktrees
    # of this same repo.
    run(["git", "fetch", "--refmap=", "origin", base_ref])
    base_sha = run(["git", "rev-parse", "FETCH_HEAD"]).stdout.strip()

    WORKTREE_PARENT.mkdir(parents=True, exist_ok=True)
    worktree = WORKTREE_PARENT / f"pr-{pr}"
    subprocess.run(  # noqa: S603
        ["git", "worktree", "remove", "--force", str(worktree)],
        capture_output=True,
        text=True,
        check=False,
        env={**os.environ, "HUSKY": "0"},
    )
    shutil.rmtree(worktree, ignore_errors=True)
    # Unconditional, and after the remove: `~/.cache` is a legitimately wipeable location,
    # so the directory can vanish while git still has it registered — and then `add` fails
    # with "missing but already registered worktree" on every subsequent run for this PR.
    subprocess.run(  # noqa: S603
        ["git", "worktree", "prune"], capture_output=True, text=True, check=False
    )

    # HUSKY=0 skips .husky/post-checkout → worktree_setup.py, which would otherwise
    # allocate a Supabase slot, ports and an .env.local that a read-only review has no
    # use for and that leak if this exits uncleanly.
    run(
        ["git", "worktree", "add", "--detach", str(worktree), head_sha],
        env={**os.environ, "HUSKY": "0"},
    )

    try:
        diff_text = run(["git", "diff", "--merge-base", base_sha, head_sha]).stdout
        if not diff_text.strip():
            raise ReviewError(
                f"the diff against {base_ref} is empty — nothing to review"
            )

        hunks = parse_diff_hunks(diff_text)
        actual_proof = diff_proof(diff_text)
        print(
            f"diff: {actual_proof['files_changed']} file(s), "
            f"{sum(len(v) for v in hunks.values())} anchorable line(s)"
        )

        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as handle:
            json.dump(RESPONSE_SCHEMA, handle)
            schema_path = Path(handle.name)

        try:
            prompt = build_prompt(diff_text)
            if verbose:
                print(f"--- prompt ---\n{prompt[:1500]}\n--- end ---", file=sys.stderr)

            result, conversation_id = invoke_agy(
                pr, worktree, prompt, model, schema_path, verbose=verbose
            )

            # Proof first: a confabulated run must never reach line validation, where its
            # invented findings would look merely malformed rather than fabricated.
            problems = verify_proof(result.get("proof"), actual_proof)
            if problems:
                raise ReviewError(
                    "agy did not read the diff it was given — it appears to have "
                    "answered from memory. Nothing posted.\n  " + "\n  ".join(problems)
                )

            for attempt in range(MAX_LINE_RETRIES + 1):
                errors = validate_findings(result["findings"], hunks)
                if not errors:
                    break
                if attempt == MAX_LINE_RETRIES:
                    raise ReviewError(
                        f"agy could not anchor its findings after {MAX_LINE_RETRIES} "
                        "retries. Nothing posted.\n  " + "\n  ".join(errors)
                    )
                print(
                    f"retry {attempt + 1}: {len(errors)} finding(s) cite invalid lines"
                )
                result, conversation_id = invoke_agy(
                    pr,
                    worktree,
                    build_retry_prompt(errors),
                    model,
                    schema_path,
                    conversation_id=conversation_id,
                    verbose=verbose,
                )
        finally:
            schema_path.unlink(missing_ok=True)

        current_head = head_sha_of(pr)
        moved = current_head if current_head != head_sha else None
        if moved:
            print(f"WARNING: head moved {head_sha[:7]} → {moved[:7]} during the review")

        payload = build_review_payload(result, head_sha, moved)
        count = len(payload["comments"])
        print(f"findings: {count}")

        # The full payload is written to disk rather than printed. It embeds every
        # finding body and the summary, and this script is normally run by an agent whose
        # context the dump would otherwise fill for no benefit. `--verbose` opts in.
        log_path = WORKTREE_PARENT / f"pr-{pr}-payload.json"
        log_path.write_text(json.dumps(payload, indent=2))

        for finding in result["findings"]:
            rule = finding.get("rule") or "—"
            print(
                f"  {finding['severity']:<6} {rule:<16} {finding['path']}:{finding['line']}"
            )
        print(f"full payload: {log_path}")

        if dry_run:
            print("--- dry run, nothing posted ---")
            if verbose:
                print(json.dumps(payload, indent=2))
            return 0

        try:
            url = post_review(slug, pr, payload).get("html_url", "(no url)")
            print(f"posted: {url}")
        except ReviewError:
            if not moved:
                raise
            # Only reachable on the moved-head path, where anchors legitimately no longer
            # resolve. Any other rejection is a real bug and must stay fatal.
            print("inline anchors rejected against the moved diff — posting as prose")
            body = render_findings_comment(result, head_sha, moved)
            out = run(
                [
                    "gh",
                    "api",
                    "--method",
                    "POST",
                    f"repos/{slug}/issues/{pr}/comments",
                    "-f",
                    f"body={body}",
                    "--jq",
                    ".html_url",
                ]
            ).stdout.strip()
            print(f"posted (no threads): {out}")

        summary = (
            f"{count} finding(s) via {model}" if count else f"no findings via {model}"
        )
        write_marker(slug, pr, head_sha, MODEL_DEPTHS.get(model, "agy-other"), summary)
        print(f"marker written for {head_sha[:7]}")

        if count:
            print(
                "\nEvery inline thread must now be resolved — fix the code, or reply "
                "with a one-sentence decline signed —Claude, then resolve the thread. "
                "The `threads` gate blocks the merge until the count reaches zero."
            )
        return 0

    finally:
        if keep_worktree:
            print(f"worktree kept at {worktree}")
        else:
            subprocess.run(  # noqa: S603
                ["git", "worktree", "remove", "--force", str(worktree)],
                capture_output=True,
                text=True,
                check=False,
                env={**os.environ, "HUSKY": "0"},
            )


def main(argv=None):
    parser = argparse.ArgumentParser(description="Post an agy code review on a PR.")
    parser.add_argument("pr", type=int)
    parser.add_argument("--pro", action="store_true")
    parser.add_argument("--model")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--keep-worktree", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args(argv)

    model = args.model or (PRO_MODEL if args.pro else FLASH_MODEL)

    try:
        return review(args.pr, model, args.dry_run, args.keep_worktree, args.verbose)
    except ReviewError as exc:
        print(f"FAILED: {exc}", file=sys.stderr)
        return 1
    except subprocess.CalledProcessError as exc:
        print(f"FAILED: {' '.join(exc.cmd)} → {exc.stderr}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
