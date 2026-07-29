#!/usr/bin/env python3
"""Transcode the live-stage CRI USM backmonitor loops for browser playback."""

from __future__ import annotations

import argparse
import csv
import importlib.util
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_PIPELINE_ROOT = PROJECT_ROOT.parent / "data_pipeline"
sys.path.insert(0, str(DATA_PIPELINE_ROOT))

from archive_paths import add_sources_config_argument, load_archive_sources
from live_chibi_raw_semantics import load_raw_live_semantics


DEFAULT_OUTPUT_ROOT = PROJECT_ROOT / "public" / "assets" / "live-chibi" / "backmonitor"
DEFAULT_CRI_KEY = "0002B875BC731A85"


def referenced_movies(effect_scripts: dict[str, bytes]) -> tuple[set[str], set[str]]:
    movies: set[str] = set()
    transitions: set[str] = set()
    for payload in effect_scripts.values():
        text = payload.decode("utf-8-sig", errors="surrogateescape")
        for row in csv.reader(io.StringIO(text, newline="")):
            if not row or row[0] != "Backmonitor":
                continue
            if len(row) > 2 and row[2].strip():
                movies.add(row[2].strip())
            if len(row) > 3 and row[3].strip():
                transitions.add(row[3].strip())
    return movies, transitions


def legacy_effect_scripts(root: Path) -> dict[str, bytes]:
    if not root.is_dir():
        raise FileNotFoundError(f"Missing liveeffectscript root: {root}")
    return {
        path.stem: path.read_bytes()
        for path in sorted(root.glob("*.csv"))
    }


def probe_video(ffprobe: str, path: Path) -> dict:
    result = subprocess.run(
        [
            ffprobe,
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,r_frame_rate,duration",
            "-show_entries",
            "format=duration,size",
            "-of",
            "json",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    data = json.loads(result.stdout)
    stream = data.get("streams", [{}])[0]
    format_data = data.get("format", {})
    return {
        "width": int(stream.get("width") or 0),
        "height": int(stream.get("height") or 0),
        "frameRate": stream.get("r_frame_rate") or "0/1",
        "duration": round(float(stream.get("duration") or format_data.get("duration") or 0) * 1000),
        "bytes": int(format_data.get("size") or path.stat().st_size),
    }


def locate_wannacri(
    explicit_root: Path | None,
    configured_root: Path | None,
) -> Path | None:
    declared = (
        ("--wannacri-root", explicit_root),
        (
            "SIDEM_WANNACRI_ROOT",
            Path(os.environ["SIDEM_WANNACRI_ROOT"])
            if os.environ.get("SIDEM_WANNACRI_ROOT")
            else None,
        ),
        ("archive source configuration", configured_root),
    )
    for source, candidate in declared:
        if candidate is None:
            continue
        resolved = candidate.resolve()
        if not (resolved / "wannacri" / "__init__.py").is_file():
            raise FileNotFoundError(
                f"WannaCRI package root from {source} is invalid: {resolved}"
            )
        return resolved

    temporary_candidate = Path(tempfile.gettempdir()) / "sidem-wannacri"
    if (temporary_candidate / "wannacri" / "__init__.py").is_file():
        return temporary_candidate
    return None if importlib.util.find_spec("wannacri") else Path()


def demux_usm(source: Path, output: Path, key: str, wannacri_root: Path | None) -> None:
    environment = os.environ.copy()
    if wannacri_root:
        existing = environment.get("PYTHONPATH")
        environment["PYTHONPATH"] = str(wannacri_root) + (os.pathsep + existing if existing else "")
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "from wannacri import main; main()",
            "extractusm",
            str(source),
            "-k",
            key,
            "-o",
            str(output),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=environment,
    )
    if result.returncode != 0:
        raise RuntimeError(f"WannaCRI failed for {source.name}: {result.stderr[-2000:]}")


def transcode(ffmpeg: str, ffprobe: str, source: Path, target: Path, force: bool) -> dict:
    if (
        not force
        and target.exists()
        and target.stat().st_size > 0
        and target.stat().st_mtime >= source.stat().st_mtime
    ):
        return probe_video(ffprobe, target)
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(f"{target.stem}.tmp{target.suffix}")
    temporary.unlink(missing_ok=True)
    result = subprocess.run(
        [
            ffmpeg,
            "-y",
            "-v",
            "error",
            "-i",
            str(source),
            "-map",
            "0:v:0",
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(temporary),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode != 0 or not temporary.exists() or temporary.stat().st_size == 0:
        temporary.unlink(missing_ok=True)
        raise RuntimeError(f"FFmpeg failed for {source.name}: {result.stderr[-2000:]}")
    metadata = probe_video(ffprobe, temporary)
    if metadata["width"] <= 0 or metadata["height"] <= 0 or metadata["duration"] <= 0:
        temporary.unlink(missing_ok=True)
        raise RuntimeError(f"FFmpeg produced an invalid video for {source.name}")
    temporary.replace(target)
    return metadata


def cached_video(ffprobe: str, target: Path, source: Path, force: bool) -> dict | None:
    if force or not target.exists() or target.stat().st_size <= 0:
        return None
    if target.stat().st_mtime < source.stat().st_mtime:
        return None
    try:
        metadata = probe_video(ffprobe, target)
    except (IndexError, json.JSONDecodeError, subprocess.SubprocessError):
        return None
    return metadata if metadata["width"] > 0 and metadata["height"] > 0 and metadata["duration"] > 0 else None


def demuxed_stream(root: Path, stream_type: str) -> Path:
    matches = [path for path in root.rglob("*") if path.is_file() and path.parent.name == stream_type]
    if not matches:
        raise FileNotFoundError(f"WannaCRI did not extract a {stream_type} stream in {root}")
    return max(matches, key=lambda path: path.stat().st_size)


def main() -> None:
    parser = argparse.ArgumentParser()
    add_sources_config_argument(parser)
    parser.add_argument(
        "--script-root",
        type=Path,
        help="Explicit legacy regression override; default reads RAW song bundles.",
    )
    parser.add_argument("--movie-root", type=Path)
    parser.add_argument("--ffmpeg")
    parser.add_argument("--ffprobe")
    parser.add_argument("--wannacri-root", type=Path)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument(
        "--asset",
        action="append",
        default=[],
        help=(
            "Only prepare this referenced movie or transition ID. "
            "Repeat for multiple assets."
        ),
    )
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--cri-key", default=DEFAULT_CRI_KEY)
    args = parser.parse_args()

    sources = load_archive_sources(args.sources_config)
    if args.script_root:
        effect_scripts = legacy_effect_scripts(args.script_root.resolve())
    else:
        raw_asset_root = (sources.raw_root / "asset").resolve()
        effect_scripts = {
            name: record["payload"]
            for name, record in load_raw_live_semantics(raw_asset_root)[
                "choreography"
            ].items()
        }
    movie_root = (args.movie_root or sources.raw_root / "movie").resolve()
    output_root = args.output_root.resolve()

    ffmpeg = shutil.which(
        args.ffmpeg
        or os.environ.get("FFMPEG")
        or (str(sources.ffmpeg_file) if sources.ffmpeg_file else "ffmpeg")
    )
    ffprobe = shutil.which(
        args.ffprobe
        or os.environ.get("FFPROBE")
        or (str(sources.ffprobe_file) if sources.ffprobe_file else "ffprobe")
    )
    if not ffmpeg or not ffprobe:
        raise FileNotFoundError("FFmpeg and FFprobe must be available on PATH")
    if not movie_root.is_dir():
        raise FileNotFoundError(f"Missing SideM movie root: {movie_root}")
    wannacri_root = locate_wannacri(args.wannacri_root, sources.wannacri_root)
    if wannacri_root == Path():
        raise ModuleNotFoundError(
            "WannaCRI is required. Install WannaCRI==0.3.1 into an ignored "
            "directory and configure wannacri_root or pass --wannacri-root."
        )

    movies, transitions = referenced_movies(effect_scripts)
    selected = set(args.asset)
    unknown = sorted(selected - movies - transitions)
    if unknown:
        raise ValueError(f"Unknown backmonitor asset IDs: {unknown}")
    if selected:
        movies &= selected
        transitions &= selected
    requested = sorted(movies | transitions)
    source_by_name = {path.stem.lower(): path for path in movie_root.glob("*.usm")}
    missing = [name for name in requested if name.lower() not in source_by_name]
    if missing:
        raise FileNotFoundError(f"Missing backmonitor USM files: {missing}")

    entries = {}
    for index, name in enumerate(sorted(movies), start=1):
        source = source_by_name[name.lower()]
        target = output_root / f"{name}.mp4"
        metadata = cached_video(ffprobe, target, source, args.force)
        if metadata is None:
            with tempfile.TemporaryDirectory(prefix="sidem-usm-") as temporary:
                demux_root = Path(temporary)
                demux_usm(source, demux_root, args.cri_key, wannacri_root)
                metadata = transcode(
                    ffmpeg,
                    ffprobe,
                    demuxed_stream(demux_root, "videos"),
                    target,
                    True,
                )
        entries[name] = {
            "id": name,
            "kind": "movie",
            "file": f"backmonitor/{target.name}",
            **metadata,
        }
        print(f"[{index:02d}/{len(movies):02d}] {name}")

    transition_entries = {}
    for index, name in enumerate(sorted(transitions), start=1):
        source = source_by_name[name.lower()]
        color_target = output_root / f"{name}.color.mp4"
        alpha_target = output_root / f"{name}.alpha.mp4"
        color_metadata = cached_video(ffprobe, color_target, source, args.force)
        alpha_metadata = cached_video(ffprobe, alpha_target, source, args.force)
        if color_metadata is None or alpha_metadata is None:
            with tempfile.TemporaryDirectory(prefix="sidem-usm-transition-") as temporary:
                demux_root = Path(temporary)
                demux_usm(source, demux_root, args.cri_key, wannacri_root)
                color_metadata = transcode(
                    ffmpeg,
                    ffprobe,
                    demuxed_stream(demux_root, "videos"),
                    color_target,
                    True,
                )
                alpha_metadata = transcode(
                    ffmpeg,
                    ffprobe,
                    demuxed_stream(demux_root, "alphas"),
                    alpha_target,
                    True,
                )
        transition_entries[name] = {
            "id": name,
            "kind": "transition",
            "source": source_by_name[name.lower()].name,
            "status": "ready",
            "colorFile": f"backmonitor/{color_target.name}",
            "alphaFile": f"backmonitor/{alpha_target.name}",
            "color": color_metadata,
            "alpha": alpha_metadata,
        }
        print(f"[transition {index:02d}/{len(transitions):02d}] {name}")

    index_path = output_root / "index.json"
    if selected and index_path.is_file():
        existing = json.loads(index_path.read_text(encoding="utf-8"))
        merged_entries = existing.get("assets", {})
        merged_transitions = existing.get("transitions", {})
        merged_entries.update(entries)
        merged_transitions.update(transition_entries)
        entries = merged_entries
        transition_entries = merged_transitions

    index_data = {
        "schemaVersion": 1,
        "stats": {
            "movies": len(entries),
            "transitions": len(transition_entries),
            "files": len(entries),
            "transitionFiles": len(transition_entries) * 2,
            "bytes": sum(entry["bytes"] for entry in entries.values())
            + sum(
                entry[stream]["bytes"]
                for entry in transition_entries.values()
                for stream in ("color", "alpha")
            ),
        },
        "assets": entries,
        "transitions": transition_entries,
    }
    output_root.mkdir(parents=True, exist_ok=True)
    index_path.write_text(
        json.dumps(index_data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"Prepared {len(movies)} backmonitor movies and {len(transitions)} transitions "
        f"in {output_root}"
    )


if __name__ == "__main__":
    main()
