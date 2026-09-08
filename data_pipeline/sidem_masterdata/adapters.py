"""Compatibility compositions over explicit domain and resource APIs."""
from __future__ import annotations

from pathlib import Path
from typing import Any
from .events import extract_event_tables, build_event_index as project_event_index
from .work import work_story_files, build_work_story_index as project_work_story_index
from .backgrounds import build_background_catalog as project_background_catalog
from .compiled_inputs import load_scenario_payloads
from .resource_inputs import collect_background_stems
from .card_details import extract_card_details_in_place


def build_event_index(
    records: list[tuple[int, int, int, int, Any]],
    story_tables: dict[str, list[dict[str, Any]]],
    card_index: dict[str, Any],
) -> dict[str, Any]:
    """Compatibility wrapper for callers supplying wire records."""
    return project_event_index(extract_event_tables(records), story_tables, card_index)


def build_work_story_index(
    tables: dict[int, list[dict[str, Any]]],
    compiled_dir: Path | None,
    compiled_stems: set[str],
    compiled_summaries: dict[str, dict[str, Any]],
    idol_unit_dictionary: dict[str, Any],
    background_catalog: dict[str, Any],
) -> dict[str, Any]:
    """Compatibility orchestration; the work domain consumes supplied payloads."""
    payloads = load_scenario_payloads(compiled_dir, work_story_files(tables, compiled_stems))
    return project_work_story_index(
        tables, compiled_stems, compiled_summaries, idol_unit_dictionary, background_catalog, payloads
    )


def build_background_catalog(tables: dict[int, list[dict[str, Any]]], bg_dir: Path | None = None) -> dict[str, Any]:
    """Compatibility adapter for callers supplying a background directory."""
    return project_background_catalog(tables, collect_background_stems(bg_dir))


def build_card_detail_index(card_index: dict[str, Any]) -> dict[str, Any]:
    """Compatibility only: consumes detail fields from card_index in place."""
    return extract_card_details_in_place(card_index)
