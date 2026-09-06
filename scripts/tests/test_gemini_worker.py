"""Tests for scripts/lib/gemini_worker.py."""

from __future__ import annotations

import io
import json
import sys
import urllib.error
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "lib"))

from gemini_worker import (  # noqa: E402
    invoke_gemini,
    resolve_api_key,
)


def test_resolve_api_key_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "test-env-key-12345")
    assert resolve_api_key() == "test-env-key-12345"


def test_resolve_api_key_from_env_local(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    # Point home away so ~/.config doesn't hit user key
    monkeypatch.setenv("HOME", str(tmp_path / "fakehome"))

    env_local = tmp_path / ".env.local"
    env_local.write_text('GEMINI_API_KEY="test-local-key-abc"\n', encoding="utf-8")

    assert resolve_api_key(project_dir=tmp_path) == "test-local-key-abc"


def test_resolve_api_key_returns_none_when_empty(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("HOME", str(tmp_path / "fakehome"))

    assert resolve_api_key(project_dir=tmp_path) is None


def test_invoke_gemini_raises_without_api_key(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("HOME", str(tmp_path / "fakehome"))

    with pytest.raises(ValueError, match="GEMINI_API_KEY is not set"):
        invoke_gemini("hello", api_key=None)


def test_invoke_gemini_success() -> None:
    mock_response_data = {
        "candidates": [
            {
                "content": {
                    "parts": [{"text": "- First point\n- Second point"}],
                    "role": "model",
                },
                "finishReason": "STOP",
            }
        ],
        "usageMetadata": {
            "promptTokenCount": 42,
            "candidatesTokenCount": 15,
            "totalTokenCount": 57,
        },
    }

    mock_resp = MagicMock()
    mock_resp.read.return_value = json.dumps(mock_response_data).encode("utf-8")
    mock_resp.__enter__.return_value = mock_resp

    with patch("urllib.request.urlopen", return_value=mock_resp) as mock_urlopen:
        text, usage = invoke_gemini(
            "Summarize this",
            system_instruction="Be concise",
            model="gemini-3.6-flash",
            temperature=0.3,
            api_key="mock-key",
        )

        assert text == "- First point\n- Second point"
        assert usage["promptTokenCount"] == 42
        assert usage["candidatesTokenCount"] == 15
        assert usage["totalTokenCount"] == 57

        mock_urlopen.assert_called_once()
        req = mock_urlopen.call_args[0][0]
        assert req.get_header("X-goog-api-key") == "mock-key"
        sent_body = json.loads(req.data.decode("utf-8"))
        assert sent_body["contents"][0]["parts"][0]["text"] == "Summarize this"
        assert sent_body["systemInstruction"]["parts"][0]["text"] == "Be concise"
        assert sent_body["generationConfig"]["temperature"] == 0.3


@pytest.mark.parametrize(
    "status_code,msg",
    [
        (400, "Bad Request"),
        (403, "Permission Denied"),
        (429, "Resource exhausted"),
        (500, "Internal Server Error"),
    ],
)
def test_invoke_gemini_http_error(status_code: int, msg: str) -> None:
    error_payload = json.dumps(
        {
            "error": {
                "code": status_code,
                "message": msg,
                "status": "FAILED",
            }
        }
    ).encode("utf-8")

    http_err = urllib.error.HTTPError(
        url="http://example.com",
        code=status_code,
        msg="Error",
        hdrs={},
        fp=io.BytesIO(error_payload),
    )

    with patch("urllib.request.urlopen", side_effect=http_err):
        with pytest.raises(
            RuntimeError, match=f"Gemini API error \\(HTTP {status_code}\\): {msg}"
        ):
            invoke_gemini("test", api_key="mock-key")


def test_main_with_inline_prompt(capsys: pytest.CaptureFixture[str]) -> None:
    from gemini_worker import main

    mock_usage = {
        "promptTokenCount": 100,
        "candidatesTokenCount": 25,
        "totalTokenCount": 125,
    }
    with patch("sys.argv", ["gemini_worker.py", "--prompt", "Hello Gemini"]):
        with patch(
            "gemini_worker.invoke_gemini", return_value=("Model answer", mock_usage)
        ):
            with patch("gemini_worker.resolve_api_key", return_value="mock-key"):
                main()

    captured = capsys.readouterr()
    assert captured.out == "Model answer\n"
    assert (
        "[subway: 100 input tokens, 25 output tokens | delegated to gemini-3.5-flash-lite]"
        in captured.err
    )
