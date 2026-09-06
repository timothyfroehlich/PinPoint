#!/usr/bin/env python3
"""Gemini worker client for bulk reading and code generation delegation.

Relies strictly on the Python standard library per PinPoint scripting policy.
Resolves GEMINI_API_KEY from environment, ~/.config/pinpoint/gemini_api_key,
~/.claude/settings.json, or .env.local.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

DEFAULT_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash-lite")
API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"


def resolve_api_key(project_dir: Path | None = None) -> str | None:
    """Resolve GEMINI_API_KEY from env, ~/.config, ~/.claude, or .env.local."""
    # 1. Environment variable
    env_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if env_key:
        return env_key

    # 2. Dedicated config file (~/.config/pinpoint/gemini_api_key)
    config_file = Path("~/.config/pinpoint/gemini_api_key").expanduser()
    if config_file.is_file():
        try:
            content = config_file.read_text(encoding="utf-8").strip()
            if content:
                # Handle possible KEY=VALUE format or raw token
                match = re.search(
                    r"GEMINI_API_KEY\s*=\s*['\"]?([^'\"]+)['\"]?", content
                )
                return match.group(1).strip() if match else content
        except OSError:
            pass

    # 3. Global Claude settings (~/.claude/settings.json)
    claude_settings = Path("~/.claude/settings.json").expanduser()
    if claude_settings.is_file():
        try:
            data = json.loads(claude_settings.read_text(encoding="utf-8"))
            claude_key = data.get("env", {}).get("GEMINI_API_KEY", "").strip()
            if claude_key:
                return claude_key
        except (OSError, json.JSONDecodeError):
            pass

    # 4. Project-level .env.local
    root = project_dir or Path(__file__).resolve().parent.parent.parent
    env_local = root / ".env.local"
    if env_local.is_file():
        try:
            content = env_local.read_text(encoding="utf-8")
            match = re.search(
                r"^\s*GEMINI_API_KEY\s*=\s*['\"]?([^'\"\n]+)['\"]?",
                content,
                re.MULTILINE,
            )
            if match:
                return match.group(1).strip()
        except OSError:
            pass

    return None


def invoke_gemini(
    prompt: str,
    *,
    system_instruction: str | None = None,
    model: str = DEFAULT_MODEL,
    temperature: float = 0.2,
    api_key: str | None = None,
    timeout_seconds: int = 120,
) -> tuple[str, dict[str, int]]:
    """Invokes Gemini generateContent API and returns response text and token usage."""
    key = api_key or resolve_api_key()
    if not key:
        raise ValueError(
            "GEMINI_API_KEY is not set. Place it in ~/.config/pinpoint/gemini_api_key, "
            "~/.zshenv, or .env.local."
        )

    url = f"{API_BASE_URL}/{model}:generateContent"

    payload: dict[str, object] = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": temperature},
    }

    if system_instruction:
        payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}

    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": key,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout_seconds) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        error_body = ""
        try:
            error_body = err.read().decode("utf-8")
            error_json = json.loads(error_body)
            msg = error_json.get("error", {}).get("message", error_body)
        except Exception:
            msg = error_body or str(err)
        raise RuntimeError(f"Gemini API error (HTTP {err.code}): {msg}") from err
    except urllib.error.URLError as err:
        raise RuntimeError(
            f"Network error contacting Gemini API: {err.reason}"
        ) from err

    candidates = data.get("candidates", [])
    if not candidates:
        raise RuntimeError(f"No candidates returned by Gemini: {data}")

    parts = candidates[0].get("content", {}).get("parts", [])
    text = "".join(part.get("text", "") for part in parts)

    usage = data.get("usageMetadata", {})
    token_usage = {
        "promptTokenCount": usage.get("promptTokenCount", 0),
        "candidatesTokenCount": usage.get("candidatesTokenCount", 0),
        "totalTokenCount": usage.get("totalTokenCount", 0),
    }

    return text, token_usage


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Invoke Gemini Flash model for Subway operations."
    )
    parser.add_argument(
        "--prompt",
        type=str,
        default=None,
        help="Inline prompt text",
    )
    parser.add_argument(
        "--prompt-file",
        type=Path,
        help="Path to file containing prompt text (stdin if omitted)",
    )
    parser.add_argument(
        "--system-instruction",
        type=str,
        default=None,
        help="System instruction / prompt for the worker",
    )
    parser.add_argument(
        "--model",
        type=str,
        default=DEFAULT_MODEL,
        help=f"Gemini model to invoke (default: {DEFAULT_MODEL})",
    )
    parser.add_argument(
        "--temperature",
        type=float,
        default=0.2,
        help="Generation temperature (default: 0.2)",
    )

    args = parser.parse_args()

    if args.prompt:
        prompt_text = args.prompt
    elif args.prompt_file:
        if not args.prompt_file.is_file():
            sys.stderr.write(f"Error: prompt file not found: {args.prompt_file}\n")
            sys.exit(1)
        prompt_text = args.prompt_file.read_text(encoding="utf-8")
    else:
        prompt_text = sys.stdin.read()

    if not prompt_text.strip():
        sys.stderr.write("Error: empty prompt provided\n")
        sys.exit(1)

    try:
        text, usage = invoke_gemini(
            prompt_text,
            system_instruction=args.system_instruction,
            model=args.model,
            temperature=args.temperature,
        )
    except Exception as err:
        sys.stderr.write(f"Error: {err}\n")
        sys.exit(1)

    sys.stdout.write(text)
    if not text.endswith("\n"):
        sys.stdout.write("\n")

    in_tokens = usage.get("promptTokenCount", 0)
    out_tokens = usage.get("candidatesTokenCount", 0)
    sys.stderr.write(
        f"[subway: {in_tokens} input tokens, {out_tokens} output tokens | delegated to {args.model}]\n"
    )


if __name__ == "__main__":
    main()
