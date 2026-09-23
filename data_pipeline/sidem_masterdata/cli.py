"""Command-line parsing only; generation is delegated to pipeline.run."""
from __future__ import annotations

import argparse
from pathlib import Path
from .pipeline import run


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument(
        "--input-state",
        choices=("xor", "decoded"),
        default="xor",
        help=(
            "State of the positional input. The historical default is 'xor'; "
            "use 'decoded' for client_master_data.xor_DefaultPassPhrase.pb."
        ),
    )
    parser.add_argument("--out-dir", type=Path, default=Path(".analysis/masterdata"))
    parser.add_argument("--public-out-dir", type=Path)
    parser.add_argument("--compiled-dir", type=Path)
    parser.add_argument("--voice-dir", type=Path)
    parser.add_argument("--spines-index", type=Path)
    parser.add_argument("--prefab-meta", type=Path)
    parser.add_argument("--bg-dir", type=Path)
    parser.add_argument(
        "--seasonal-campaign-only",
        action="store_true",
        help="Generate only seasonal_campaign_index.json with its local identity relations.",
    )
    parser.add_argument(
        "--work-story-only",
        action="store_true",
        help="Generate only work_story_index.json with scene lines and short stories.",
    )
    parser.add_argument(
        "--idol-communication-only",
        action="store_true",
        help="Generate only idol_episode_index.json, mobile_archive_index.json and the corrected home interaction index.",
    )
    parser.add_argument(
        "--birthday-semantic-only",
        action="store_true",
        help=(
            "Generate only birthday_story_semantic_index.json from tables "
            "76/77/78/80/86."
        ),
    )
    parser.add_argument(
        "--music-catalog-only",
        action="store_true",
        help="Generate only music_catalog.json, including complete table-133 relations.",
    )
    parser.add_argument(
        "--movie-announce-only",
        action="store_true",
        help="Generate only movie_announce_index.json from table 175.",
    )
    parser.add_argument(
        "--card-skill-movie-only",
        action="store_true",
        help=(
            "Generate only card_skill_movie_index.json from CardData table 1 "
            "records whose HasSkillCutinResource field is true."
        ),
    )
    parser.add_argument(
        "--song-movie-only",
        action="store_true",
        help=(
            "Generate only song_movie_index.json from SongData table 46 "
            "MovieOffset and enabled MvliveOpenAt records."
        ),
    )
    parser.add_argument(
        "--curated-card-voices",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "curated" / "card_voice_transcripts.json",
    )
    parser.add_argument(
        "--curated-gasha-titles",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "curated" / "gasha_titles.json",
    )
    return parser


def main() -> None:
    run(build_parser().parse_args())
