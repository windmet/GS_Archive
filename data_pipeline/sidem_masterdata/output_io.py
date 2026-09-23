"""Masterdata JSON output transport with explicit public projection selection."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterable

FULL_PUBLIC_OUTPUTS = (
    'story_master_index.json',
    'story_catalog.json',
    'gasha_announcement_index.json',
    'gasha_index.json',
    'event_index.json',
    'card_index.json',
    'card_detail_index.json',
    'idol_unit_dictionary.json',
    'speaker_dictionary.json',
    'costume_dictionary.json',
    'idol_episode_index.json',
    'mobile_archive_index.json',
    'home_interaction_index.json',
    'short_adv_profile_index.json',
    'seasonal_communication_index.json',
    'seasonal_campaign_index.json',
    'work_story_index.json',
    'background_catalog.json',
    'music_catalog.json',
    'movie_announce_index.json',
    'card_skill_movie_index.json',
    'song_movie_index.json',
    'face_dictionary.json',
    'masterdata_validation_report.json',
)


def write_json_outputs(
    outputs: dict[str, Any],
    out_dir: Path,
    public_out_dir: Path | None = None,
    public_names: Iterable[str] | None = None,
) -> None:
    """Write all analysis outputs and only selected public outputs.

    The caller creates out_dir and owns decoded binary output separately.
    A selected-mode caller omits public_names to publish its whole small output set.
    """
    for filename, data in outputs.items():
        (out_dir / filename).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    if public_out_dir:
        public_out_dir.mkdir(parents=True, exist_ok=True)
        for filename in outputs if public_names is None else public_names:
            (public_out_dir / filename).write_text(
                json.dumps(outputs[filename], ensure_ascii=False, indent=2), encoding="utf-8"
            )
