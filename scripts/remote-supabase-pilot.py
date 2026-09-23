#!/usr/bin/env python3
"""Compatibility entry point for the two original remote worktrees."""

import runpy
from pathlib import Path

runpy.run_path(str(Path(__file__).with_name("remote-supabase.py")), run_name="__main__")
