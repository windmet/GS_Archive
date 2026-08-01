#!/usr/bin/env python3
"""Prepare a small, explicitly experimental song player audio sample.

This script decodes only the requested idol vocal ACB and its backing ACB to
browser-readable M4A files.  It does not modify RAW and never publishes the
whole song corpus.  The generated media is intentionally ignored by the
repository's binary-asset boundary; the tracked manifest records the source
and metadata contract used by the UI experiment.
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


def main() -> None:
    parser = argparse.ArgumentParser()
    add_sources_config_argument(parser)
    parser.add_argument("--song-code", default="drvalv")
    parser.add_argument("--idol-code", default="001tom")
    parser.add_argument("--ffmpeg")
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    if not re.fullmatch(r"[a-z0-9]{6}", args.song_code):
        raise ValueError("song code must be six lowercase alphanumeric characters")
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
    vocal_source = raw_audio / f"song3_{args.song_code}_{args.idol_code}.acb"
    backing_source = raw_audio / f"song3_{args.song_code}_bgm.acb"
    if not vocal_source.is_file() or not backing_source.is_file():
        raise FileNotFoundError(f"Missing solo/backing pair for {args.song_code}/{args.idol_code}")

    vocal_destination = output_root / f"{args.song_code}_{args.idol_code}.m4a"
    backing_destination = output_root / f"{args.song_code}_bgm.m4a"
    vocal_meta = ensure_asset(vgmstream, ffmpeg, vocal_source, vocal_destination, args.force)
    backing_meta = ensure_asset(vgmstream, ffmpeg, backing_source, backing_destination, args.force)

    catalog = json.loads(MUSIC_CATALOG.read_text(encoding="utf-8"))
    song = catalog["songs"].get(args.song_code)
    if not song:
        raise KeyError(args.song_code)
    units = json.loads(UNIT_DICTIONARY.read_text(encoding="utf-8"))
    live_music_root = PROJECT_ROOT / "public" / "assets" / "live-chibi" / "music"
    single_tracks = {}
    full_mix = live_music_root / f"{args.song_code}.m4a"
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

    manifest = {
        "schema_version": 1,
        "status": "experimental",
        "scope": "song_detail_only",
        "notes": [
            "Single-track modes use existing browser-readable live-chibi M4A candidates.",
            "Solo mode mixes one idol vocal M4A with one backing M4A in the browser.",
            "Metadata confirms sample alignment within one sample; no full listening calibration is claimed.",
        ],
        "songs": {
            args.song_code: {
                "song_code": args.song_code,
                "single_tracks": single_tracks,
                "special_tracks": special_tracks,
                "unit_tracks": find_unit_assets(output_root, args.song_code, units),
                "backing": {
                    "label": "伴奏",
                    "url": public_asset_url(PROJECT_ROOT / "public", backing_destination),
                    "source": f"RAW/audio/song3_{args.song_code}_bgm.acb",
                    "kind": "single-track",
                    "metadata": backing_meta,
                },
                "solo_tracks": {
                    args.idol_code: {
                        "idol_code": args.idol_code,
                        "vocal": {
                            "url": public_asset_url(PROJECT_ROOT / "public", vocal_destination),
                            "source": f"RAW/audio/song3_{args.song_code}_{args.idol_code}.acb",
                            "kind": "solo-vocal",
                            "metadata": vocal_meta,
                        },
                        "backing": {
                            "url": public_asset_url(PROJECT_ROOT / "public", backing_destination),
                            "source": f"RAW/audio/song3_{args.song_code}_bgm.acb",
                            "kind": "backing",
                            "metadata": backing_meta,
                        },
                        "sync": {
                            "sample_rate": vocal_meta["sample_rate"],
                            "sample_delta": backing_meta["samples"] - vocal_meta["samples"],
                            "status": "metadata-aligned-experimental",
                        },
                    }
                },
            }
        },
    }
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {manifest_path}")


if __name__ == "__main__":
    main()
