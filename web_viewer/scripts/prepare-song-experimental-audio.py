#!/usr/bin/env python3
"""Prepare an explicitly experimental song player audio sample.

This script decodes the requested idol vocal ACB (or all available idol vocal
ACBs) and its backing ACB to browser-readable M4A files. It does not modify
RAW and never publishes the whole song corpus. The generated media is
intentionally ignored by the repository's binary-asset boundary; the tracked
manifest records the source and metadata contract used by the UI experiment.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_PIPELINE_ROOT = PROJECT_ROOT.parent / "data_pipeline"
import sys
sys.path.insert(0, str(DATA_PIPELINE_ROOT))
from archive_paths import add_sources_config_argument, load_archive_sources

DEFAULT_OUTPUT_ROOT = PROJECT_ROOT / "public" / "assets" / "song-experiment"
DEFAULT_MANIFEST = PROJECT_ROOT / "public" / "data" / "song_experimental_audio.json"
MUSIC_CATALOG = PROJECT_ROOT / "public" / "data" / "song_catalog.json"
UNIT_DICTIONARY = PROJECT_ROOT / "public" / "data" / "masterdata" / "idol_unit_dictionary.json"


def run_meta(vgmstream: Path, acb_path: Path) -> dict:
    result = subprocess.run(
        [str(vgmstream), "-m", "-I", str(acb_path)],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return json.loads(result.stdout)


def extract_m4a(vgmstream: Path, ffmpeg: str, acb_path: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    decoder = subprocess.Popen(
        [str(vgmstream), "-i", "-p", str(acb_path)],
        stdout=subprocess.PIPE,
    )
    assert decoder.stdout is not None
    encoder = subprocess.run(
        [
            ffmpeg,
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "wav",
            "-i",
            "pipe:0",
            "-vn",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-movflags",
            "+faststart",
            str(destination),
        ],
        stdin=decoder.stdout,
    )
    decoder.stdout.close()
    decoder_return = decoder.wait()
    if decoder_return != 0 or encoder.returncode != 0:
        destination.unlink(missing_ok=True)
        raise subprocess.CalledProcessError(decoder_return or encoder.returncode, acb_path)


def audio_metadata(vgmstream: Path, acb_path: Path) -> dict:
    info = run_meta(vgmstream, acb_path)
    sample_rate = int(info.get("sampleRate") or 0)
    samples = int(info.get("numberOfSamples") or 0)
    return {
        "sample_rate": sample_rate,
        "channels": int(info.get("channels") or 0),
        "samples": samples,
        "duration_seconds": round(samples / sample_rate, 6) if sample_rate else 0,
        "encoding": info.get("encoding"),
        "source_name": info.get("streamInfo", {}).get("name", ""),
    }


def public_asset_url(root: Path, file: Path) -> str:
    return "/" + file.relative_to(root).as_posix()


def ensure_asset(
    vgmstream: Path,
    ffmpeg: str,
    source: Path,
    destination: Path,
    force: bool,
) -> dict:
    if force or not destination.is_file():
        print(f"Extracting {source.name} -> {destination.name}", flush=True)
        extract_m4a(vgmstream, ffmpeg, source, destination)
    metadata = audio_metadata(vgmstream, source)
    return metadata


def find_unit_assets(output_root: Path, song_code: str, unit_dictionary: dict) -> list[dict]:
    units = {str(entry.get("unit_code")): entry for entry in unit_dictionary.get("units", [])}
    entries = []
    for path in sorted(output_root.parent.joinpath("live-chibi", "music").glob(f"{song_code}_*.m4a")):
        suffix = path.stem.removeprefix(f"{song_code}_")
        if not re.fullmatch(r"\d{3}[a-z0-9]{3}", suffix):
            continue
        normalized = suffix[1:]
        unit = units.get(normalized) or units.get(suffix)
        entries.append(
            {
                "unit_code": normalized,
                "label": unit.get("unit_name") if unit else normalized,
                "url": f"/assets/live-chibi/music/{path.name}",
                "source": f"public/assets/live-chibi/music/{path.name}",
                "kind": "single-track",
            }
        )
    return entries


def find_idol_sources(raw_audio: Path, song_code: str) -> list[tuple[str, Path]]:
    """Return the per-idol ACB files in numeric order.

    The filename suffix is the stable 49-idol code used by table 46 and the
    CRI cue names. This deliberately excludes the unit cues in the base ACB
    and the separate backing ACB.
    """
    entries = []
    prefix = f"song3_{song_code}_"
    for path in sorted(raw_audio.glob(f"{prefix}*.acb")):
        idol_code = path.stem.removeprefix(prefix)
        if re.fullmatch(r"\d{3}[a-z0-9]{3}", idol_code):
            entries.append((idol_code, path))
    return entries


def build_song_entry(
    song_code: str,
    idol_code: str,
    all_idols: bool,
    *,
    raw_audio: Path,
    vgmstream: Path,
    ffmpeg: str,
    output_root: Path,
    force: bool,
    catalog: dict,
    units: dict,
) -> dict:
    backing_source = raw_audio / f"song3_{song_code}_bgm.acb"
    idol_sources = find_idol_sources(raw_audio, song_code) if all_idols else [
        (idol_code, raw_audio / f"song3_{song_code}_{idol_code}.acb")
    ]
    if not idol_sources or any(not source.is_file() for _, source in idol_sources):
        raise FileNotFoundError(f"Missing solo vocal source(s) for {song_code}")
    if not backing_source.is_file():
        raise FileNotFoundError(f"Missing backing source for {song_code}")

    song = catalog["songs"].get(song_code)
    if not song:
        raise KeyError(song_code)

    backing_destination = output_root / f"{song_code}_bgm.m4a"
    backing_meta = ensure_asset(
        vgmstream, ffmpeg, backing_source, backing_destination, force
    )
    solo_tracks = {}
    for current_idol_code, vocal_source in idol_sources:
        vocal_destination = output_root / f"{song_code}_{current_idol_code}.m4a"
        vocal_meta = ensure_asset(
            vgmstream, ffmpeg, vocal_source, vocal_destination, force
        )
        sample_delta = backing_meta["samples"] - vocal_meta["samples"]
        if abs(sample_delta) <= 1:
            sync_status = "sample-aligned-experimental"
        elif sample_delta < 0 and abs(sample_delta) <= vocal_meta["sample_rate"]:
            sync_status = "extra-vocal-tail-experimental"
        else:
            sync_status = "duration-mismatch-unresolved"
        solo_tracks[current_idol_code] = {
            "idol_code": current_idol_code,
            "vocal": {
                "url": public_asset_url(PROJECT_ROOT / "public", vocal_destination),
                "source": f"RAW/audio/song3_{song_code}_{current_idol_code}.acb",
                "kind": "solo-vocal",
                "metadata": vocal_meta,
            },
            "backing": {
                "url": public_asset_url(PROJECT_ROOT / "public", backing_destination),
                "source": f"RAW/audio/song3_{song_code}_bgm.acb",
                "kind": "backing",
                "metadata": backing_meta,
            },
            "sync": {
                "sample_rate": vocal_meta["sample_rate"],
                "sample_delta": sample_delta,
                "status": sync_status,
            },
        }

    live_music_root = PROJECT_ROOT / "public" / "assets" / "live-chibi" / "music"
    single_tracks = {}
    full_mix = live_music_root / f"{song_code}.m4a"
    if full_mix.is_file():
        single_tracks["full_mix"] = {
            "label": "原版",
            "url": public_asset_url(PROJECT_ROOT / "public", full_mix),
            "source": "public/assets/live-chibi/music/" + full_mix.name,
            "kind": "single-track",
        }
    special_tracks = []
    for variant in song.get("variants", []):
        variant_file = live_music_root / f"{variant['song_code']}.m4a"
        if variant_file.is_file():
            special_tracks.append(
                {
                    "song_code": variant["song_code"],
                    "label": variant.get("title") or variant["song_code"],
                    "url": public_asset_url(PROJECT_ROOT / "public", variant_file),
                    "source": "public/assets/live-chibi/music/" + variant_file.name,
                    "kind": "single-track",
                }
            )

    song_data = song.get("song_data") or {}
    unit_tracks = find_unit_assets(output_root, song_code, units)
    stage_vocal = None
    if song_data.get("has_switch_singer") and song_data.get("on_stage_count"):
        stage_vocal = {
            "mode": "parallel-performer-slots",
            "slot_count": song_data["on_stage_count"],
            "switch_source": f"RAW/asset/song_{song_code}.unity3d:{song_code}_live_effect/SwitchSinger",
            "mix_policy": {
                "status": "browser-approximation",
                "active_slot_gain": "equal-power-normalized",
                "pan": "center",
                "backing_gain": 1.0,
            },
        }

    has_center_setting = bool(song_data.get("has_solo_singing"))
    has_unit_setting = len(unit_tracks) == 16
    vocal_settings = {
        "status": (
            "game-help-and-raw-convergent"
            if has_center_setting and has_unit_setting and stage_vocal
            else "raw-derived-experimental"
        ),
        "modes": [
            {
                "id": "formation",
                "label": "编成偶像",
                "audio": "selected-idol-vocals-plus-backing",
                "choreography_variant": "base",
            },
        ],
    }
    if has_center_setting and has_unit_setting:
        vocal_settings["modes"].extend(
            [
                {
                    "id": "all_stars",
                    "label": "315 ALL STARS",
                    "audio": "full-mix-candidate",
                    "choreography_variant": "base",
                },
            {
                "id": "unit",
                "label": "ユニット / Unit",
                "audio": "unit-single-track",
                "choreography_variant": "unit-code",
                "variant_count": len(unit_tracks),
                },
                {
                    "id": "center",
                    "label": "センター / Center",
                    "audio": "selected-idol-vocal-plus-backing",
                    "choreography_variant": "solo-candidate",
                },
            ]
        )

    return {
        "song_code": song_code,
        "single_tracks": single_tracks,
        "special_tracks": special_tracks,
        "unit_tracks": unit_tracks,
        "backing": {
            "label": "伴奏",
            "url": public_asset_url(PROJECT_ROOT / "public", backing_destination),
            "source": f"RAW/audio/song3_{song_code}_bgm.acb",
            "kind": "single-track",
            "metadata": backing_meta,
        },
        "solo_tracks": solo_tracks,
        "stage_vocal": stage_vocal,
        "vocal_settings": vocal_settings,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    add_sources_config_argument(parser)
    parser.add_argument(
        "--song-code",
        action="append",
        dest="song_codes",
        help="Song code to include; repeat for a multi-song manifest",
    )
    parser.add_argument("--idol-code", default="001tom")
    parser.add_argument(
        "--all-idols",
        action="store_true",
        help="Decode every per-idol vocal ACB found for the song",
    )
    parser.add_argument("--ffmpeg")
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    song_codes = args.song_codes or ["drvalv"]
    if any(not re.fullmatch(r"[a-z0-9]{6}", code) for code in song_codes):
        raise ValueError("song codes must be six lowercase alphanumeric characters")
    if len(song_codes) != len(set(song_codes)):
        raise ValueError("song codes must be unique")
    if not re.fullmatch(r"\d{3}[a-z0-9]{3}", args.idol_code):
        raise ValueError("idol code must match 000xxx")

    sources = load_archive_sources(args.sources_config)
    raw_audio = (sources.raw_root / "audio").resolve()
    vgmstream = sources.vgmstream_file
    ffmpeg = args.ffmpeg or os.environ.get("FFMPEG")
    if not ffmpeg:
        ffmpeg = str(sources.ffmpeg_file) if sources.ffmpeg_file else "ffmpeg"
    if not raw_audio.is_dir():
        raise FileNotFoundError(raw_audio)
    if not vgmstream.is_file():
        raise FileNotFoundError(vgmstream)
    if not shutil.which(ffmpeg):
        raise FileNotFoundError(ffmpeg)

    output_root = args.output_root.resolve()
    manifest_path = args.manifest.resolve()
    catalog = json.loads(MUSIC_CATALOG.read_text(encoding="utf-8"))
    units = json.loads(UNIT_DICTIONARY.read_text(encoding="utf-8"))
    songs = {
        song_code: build_song_entry(
            song_code,
            args.idol_code,
            args.all_idols,
            raw_audio=raw_audio,
            vgmstream=vgmstream,
            ffmpeg=ffmpeg,
            output_root=output_root,
            force=args.force,
            catalog=catalog,
            units=units,
        )
        for song_code in song_codes
    }

    manifest = {
        "schema_version": 2,
        "status": "experimental",
        "scope": ["song_detail", "chibi_stage"],
        "notes": [
            "Single-track modes use existing browser-readable live-chibi M4A candidates.",
            "Solo mode mixes one selected idol vocal M4A with one backing M4A in the browser.",
            "When --all-idols is used, every available per-idol vocal ACB is listed with the same backing candidate.",
            "Per-track sync status distinguishes sample-aligned files, a bounded extra vocal tail, and unresolved duration mismatches.",
            "Chibi stage mode binds selected idols to performer slots and follows SwitchSinger events.",
            "Equal-power active-slot normalization and centered pan are browser approximations, not recovered game constants.",
            "Game help names Formation Idols, Unit, 315 ALL STARS, and Center as song-dependent vocal settings.",
            "The manifest maps those labels only where table 46 flags, unit tracks, per-idol vocals, backing, and choreography variants converge.",
        ],
        "songs": songs,
    }
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {manifest_path}")


if __name__ == "__main__":
    main()
