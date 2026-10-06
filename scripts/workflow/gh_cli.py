#!/usr/bin/env python3
"""The one `gh` CLI wrapper shared by the Python workflow scripts.

pr-dashboard.py and pr-watch.py each need "run gh, return stdout, raise on a
non-zero exit". They differ only in the exception type, so the caller passes its
own and keeps its error contract at the call boundary.

Import it from a sibling script with the directory on `sys.path` (a script run as
`python3 scripts/workflow/<name>.py` has it there already; a test loading the
script by path does not, so the importer inserts its own directory first).
"""

from __future__ import annotations

import subprocess


def run_gh(*args: str, error: type[Exception] = RuntimeError) -> str:
    """Run a gh CLI command, returning stripped stdout; raise `error` on failure."""
    result = subprocess.run(["gh", *args], capture_output=True, text=True)
    if result.returncode != 0:
        raise error(result.stderr.strip() or f"gh {args[0]} failed")
    return result.stdout.strip()
