"""Tests for the preview Vercel REST helper and token scoping (PP-fmli).

Acceptance criteria:
- Preview env wiring calls the Vercel REST API directly: no Vercel CLI and no
  npm fetch runs in a step that holds VERCEL_TOKEN / SUPABASE_ACCESS_TOKEN.
- Neither the Vercel token nor an env value appears in any child process argv.
- A failed env set fails; removal deletes only the branch's own preview vars.
- The preview workflows hold no Supabase/Vercel secrets at job level.
- Production deployment retains `migrate:production && next build`.
"""

import json
import os
import subprocess
import textwrap
from pathlib import Path

import pytest
import yaml

pytestmark = pytest.mark.integration

REPO_ROOT = Path(__file__).parent.parent.parent
PREVIEW_DIR = REPO_ROOT / "scripts" / "workflow" / "preview"
VERCEL_ENV = PREVIEW_DIR / "vercel-env.sh"
PREVIEW_CREATE = PREVIEW_DIR / "preview-create.sh"
PREVIEW_DESTROY = PREVIEW_DIR / "preview-destroy.sh"
WORKFLOWS = REPO_ROOT / ".github" / "workflows"
PACKAGE_JSON = REPO_ROOT / "package.json"

TOKEN = "tok_TEST_should_never_appear_in_argv"
SECRET_VALUE = "postgresql://postgres.ref:hunter2-SECRET@pooler.example:6543/postgres"

# A fake curl: records its argv and the -K config it was handed, captures the
# request body from stdin, and answers from a JSON table keyed by
# "<METHOD> <path-without-query>" (default 200 {}).
FAKE_CURL = textwrap.dedent(
    """\
    #!/usr/bin/env python3
    import json, os, sys, urllib.parse
    args = sys.argv[1:]
    log_dir = os.environ["FAKE_CURL_LOG"]
    method, url, config, body = "GET", None, "", None
    i = 0
    while i < len(args):
        a = args[i]
        if a == "-X":
            method = args[i + 1]; i += 2; continue
        if a == "-K":
            with open(args[i + 1]) as fh:
                config = fh.read()
            i += 2; continue
        if a == "--data-binary" and args[i + 1] == "@-":
            body = sys.stdin.read(); i += 2; continue
        if a.startswith("http"):
            url = a
        i += 1
    with open(os.path.join(log_dir, "calls.jsonl"), "a") as fh:
        fh.write(json.dumps({"argv": args, "method": method, "url": url,
                             "config": config, "body": body}) + "\\n")
    table = json.loads(os.environ.get("FAKE_CURL_RESPONSES", "{}"))
    path = urllib.parse.urlsplit(url).path
    status, payload = table.get(f"{method} {path}", [200, {}])
    sys.stdout.write(json.dumps(payload) + "\\n" + str(status))
    """
)


def _run(tmp_path: Path, script: str, responses: dict, stdin: str = "") -> tuple:
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir(exist_ok=True)
    fake = bin_dir / "curl"
    fake.write_text(FAKE_CURL, encoding="utf-8")
    fake.chmod(0o755)
    env = os.environ.copy()
    env.update(
        {
            "PATH": f"{bin_dir}:{env.get('PATH', '')}",
            "FAKE_CURL_LOG": str(tmp_path),
            "FAKE_CURL_RESPONSES": json.dumps(responses),
            "VERCEL_TOKEN": TOKEN,
            "VERCEL_ORG_ID": "team_123",
            "VERCEL_PROJECT_ID": "prj_456",
            "GIT_BRANCH": "feat/some-branch",
        }
    )
    result = subprocess.run(
        ["bash", "-c", f'set -euo pipefail; source "{VERCEL_ENV}"; {script}'],
        input=stdin,
        capture_output=True,
        text=True,
        env=env,
        check=False,
    )
    log = tmp_path / "calls.jsonl"
    calls = (
        [json.loads(line) for line in log.read_text(encoding="utf-8").splitlines()]
        if log.exists()
        else []
    )
    return result, calls


def _assert_no_secret_in_argv(calls: list) -> None:
    for call in calls:
        joined = " ".join(call["argv"])
        assert TOKEN not in joined, "Vercel token leaked into curl argv"
        assert SECRET_VALUE not in joined, "env value leaked into curl argv"
        assert f"Bearer {TOKEN}" in call["config"], "auth must come via -K config"


def test_env_set_upserts_branch_scoped_preview_var(tmp_path: Path) -> None:
    result, calls = _run(
        tmp_path,
        "vercel_env_set POSTGRES_URL sensitive",
        {"POST /v10/projects/prj_456/env": [201, {"created": {}, "failed": []}]},
        stdin=SECRET_VALUE,
    )
    assert result.returncode == 0, result.stderr
    assert len(calls) == 1
    call = calls[0]
    assert call["method"] == "POST"
    assert "/v10/projects/prj_456/env?upsert=true&teamId=team_123" in call["url"]
    assert json.loads(call["body"]) == {
        "key": "POSTGRES_URL",
        "value": SECRET_VALUE,
        "type": "sensitive",
        "target": ["preview"],
        "gitBranch": "feat/some-branch",
    }
    _assert_no_secret_in_argv(calls)


@pytest.mark.parametrize(
    "response",
    [
        [400, {"error": {"code": "bad_request", "message": "nope"}}],
        [201, {"created": [], "failed": [{"error": {"code": "x", "message": "y"}}]}],
    ],
)
def test_env_set_failure_returns_nonzero(tmp_path: Path, response: list) -> None:
    result, _ = _run(
        tmp_path,
        "vercel_env_set SUPABASE_URL sensitive",
        {"POST /v10/projects/prj_456/env": response},
        stdin=SECRET_VALUE,
    )
    assert result.returncode != 0
    assert "::error::failed to set Vercel env SUPABASE_URL" in result.stderr
    assert SECRET_VALUE not in result.stdout + result.stderr


def test_env_rm_deletes_only_this_branch_preview_vars(tmp_path: Path) -> None:
    envs = {
        "envs": [
            {
                "id": "e1",
                "key": "POSTGRES_URL",
                "gitBranch": "feat/some-branch",
                "target": ["preview"],
            },
            {"id": "e2", "key": "POSTGRES_URL", "target": ["preview", "production"]},
            {
                "id": "e3",
                "key": "POSTGRES_URL",
                "gitBranch": "other",
                "target": ["preview"],
            },
            {
                "id": "e4",
                "key": "SUPABASE_URL",
                "gitBranch": "feat/some-branch",
                "target": ["preview"],
            },
        ]
    }
    result, calls = _run(
        tmp_path,
        "vercel_env_rm POSTGRES_URL SUPABASE_URL NEXT_PUBLIC_SUPABASE_URL",
        {"GET /v10/projects/prj_456/env": [200, envs]},
    )
    assert result.returncode == 0, result.stderr
    assert "gitBranch=feat%2Fsome-branch" in calls[0]["url"]
    deleted = [c["url"] for c in calls if c["method"] == "DELETE"]
    assert len(deleted) == 2
    assert any("/v9/projects/prj_456/env/e1?teamId=team_123" in u for u in deleted)
    assert any("/v9/projects/prj_456/env/e4?teamId=team_123" in u for u in deleted)
    assert "NEXT_PUBLIC_SUPABASE_URL not present" in result.stdout
    _assert_no_secret_in_argv(calls)


def test_env_rm_reports_failed_delete(tmp_path: Path) -> None:
    envs = {
        "envs": [
            {
                "id": "e1",
                "key": "POSTGRES_URL",
                "gitBranch": "feat/some-branch",
                "target": ["preview"],
            }
        ]
    }
    result, _ = _run(
        tmp_path,
        "vercel_env_rm POSTGRES_URL",
        {
            "GET /v10/projects/prj_456/env": [200, envs],
            "DELETE /v9/projects/prj_456/env/e1": [500, {}],
        },
    )
    assert result.returncode != 0


def test_preview_scripts_use_rest_helper_not_cli() -> None:
    for script in (PREVIEW_CREATE, PREVIEW_DESTROY):
        content = script.read_text(encoding="utf-8")
        assert 'source "${HERE}/vercel-env.sh"' in content
        assert "vercel-cli" not in content
        assert "npx" not in content
        assert "--token" not in content
        assert "Authorization: Bearer" not in content, (
            f"{script} sends the token via argv"
        )
    assert not (PREVIEW_DIR / "vercel-cli.sh").exists()


def test_preview_workflows_hold_no_job_level_secrets() -> None:
    for name in ("preview-control.yaml", "preview-reaper.yaml"):
        workflow = yaml.safe_load((WORKFLOWS / name).read_text(encoding="utf-8"))
        for job_name, job in workflow["jobs"].items():
            job_env = job.get("env", {}) or {}
            for key, value in job_env.items():
                assert "secrets." not in str(value) or key == "GH_TOKEN", (
                    f"{name}:{job_name} exposes {key} at job level"
                )


def test_package_json_vercel_build_contract() -> None:
    pkg = json.loads(PACKAGE_JSON.read_text(encoding="utf-8"))
    scripts = pkg.get("scripts", {})
    assert scripts.get("vercel-build") == "pnpm run migrate:production && next build"
    assert "mise" not in scripts.get("vercel-build", "")
    assert scripts.get("migrate:production") == "tsx scripts/migrate-production.ts"
