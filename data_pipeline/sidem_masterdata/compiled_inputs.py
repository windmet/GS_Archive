"""Read selected compiled scenario evidence; no domain projection or publication."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterable


def load_scenario_payloads(compiled_dir: Path | None, filenames: Iterable[str]) -> dict[str, Any]:
    """Preserve unreadable/malformed input as absent; retain successfully decoded values."""
    if compiled_dir is None:
        return {}
    payloads = {}
    for filename in dict.fromkeys(filenames):
        try:
            payloads[filename] = json.loads((compiled_dir / filename).read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError, UnicodeDecodeError):
            continue
    return payloads
