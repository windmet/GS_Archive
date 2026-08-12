"""Compatibility entry for the expanded Story timing semantics matrix."""

from pathlib import Path
from runpy import run_path


run_path(str(Path(__file__).with_name("verify-story-timing-semantics.py")), run_name="__main__")
