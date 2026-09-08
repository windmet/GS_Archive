"""Explicit vgmstream process adapter; importing does not inspect media."""
import subprocess
from pathlib import Path


def inspect_acb_cues(vgmstream: Path | None, acb: Path) -> list[str]:
    if vgmstream is None:
        return []
    cues = []
    for selection in range(1, 201):
        result = subprocess.run(
            [str(vgmstream), "-m", "-s", str(selection), str(acb)],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
        name = None
        for line in result.stdout.splitlines():
            if "stream name:" in line:
                name = line.split("stream name:", 1)[1].strip()
                break
        if not name:
            break
        cues.append(name)
    return cues


