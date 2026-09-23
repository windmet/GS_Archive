"""Inputs for one generation job, with job-local lazy resource snapshots."""
from __future__ import annotations

from dataclasses import dataclass
from functools import cached_property
from pathlib import Path
from typing import Any
from .resource_inputs import collect_compiled_stems, collect_compiled_summaries


@dataclass(frozen=True)
class GenerationInputs:
    records: list[tuple[int, int, int, int, Any]]
    compiled_dir: Path | None = None
    voice_dir: Path | None = None
    spines_index: Path | None = None
    prefab_meta: Path | None = None
    bg_dir: Path | None = None
    curated_card_voices: Path | None = None
    curated_gasha_titles: Path | None = None

    @cached_property
    def compiled_stems(self) -> set[str]:
        return collect_compiled_stems(self.compiled_dir)

    @cached_property
    def compiled_summaries(self) -> dict[str, dict[str, Any]]:
        return collect_compiled_summaries(self.compiled_dir)
