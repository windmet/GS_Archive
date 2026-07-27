#!/usr/bin/env python3
"""Extract CRI ACB live-song streams to browser-readable M4A files."""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_PIPELINE_ROOT = PROJECT_ROOT.parent / "data_pipeline"
sys.path.insert(0, str(DATA_PIPELINE_ROOT))

from archive_paths import add_sources_config_argument, load_archive_sources


DEFAULT_OUTPUT_ROOT = PROJECT_ROOT / "public" / "assets" / "live-chibi" / "music"
DEFAULT_CHOREOGRAPHY_PATH = (
    PROJECT_ROOT / "public" / "assets" / "live-chibi" / "choreography" / "index.json"
)
def run_json(command: list[str]) -> dict:
    result = subprocess.run(command, check=True, capture_output=True, text=True, encoding="utf-8")
    return json.loads(result.stdout)


def inspect_streams(vgmstream: Path, acb_path: Path) -> list[dict]:
    first = run_json([str(vgmstream), "-I", str(acb_path)])
    total = int(first.get("streamInfo", {}).get("total") or 1)
    streams = []
    for selection in range(1, total + 1):
        info = first if selection == 1 else run_json(
            [str(vgmstream), "-s", str(selection), "-I", str(acb_path)]
        )
        sample_rate = int(info.get("sampleRate") or 0)
        samples = int(info.get("numberOfSamples") or 0)
        streams.append(
            {
                "selection": selection,
                "name": str(info.get("streamInfo", {}).get("name") or ""),
                "sampleRate": sample_rate,
                "channels": int(info.get("channels") or 0),
                "samples": samples,
                "duration": samples * 1000 / sample_rate if sample_rate else 0,
                "encoding": info.get("encoding"),
            }
        )
    return streams


def stream_aliases(stream: dict) -> list[str]:
    return [part.strip() for part in stream["name"].split(";") if part.strip()]


def find_root_stream(song_code: str, streams: list[dict]) -> dict:
    expected = f"song3_{song_code}"
    for stream in reversed(streams):
        if expected in stream_aliases(stream):
            return stream
    return streams[-1]


def find_variant_stream(song_code: str, variant: str, streams: list[dict]) -> dict | None:
    if not re.fullmatch(r"\d{2}[a-z0-9]+", variant):
        return None
    expected = f"song3_{song_code}_0{variant}"
    return next(
        (stream for stream in streams if expected in stream_aliases(stream)),
        None,
    )


def extract_m4a(
    vgmstream: Path,
    ffmpeg: str,
    acb_path: Path,
    stream: dict,
    destination: Path,
) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    decoder = subprocess.Popen(
        [
            str(vgmstream),
            "-s",
            str(stream["selection"]),
            "-i",
            "-p",
            str(acb_path),
        ],
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


def output_name(song_code: str, stream: dict, root_stream: dict) -> str:
    if stream["selection"] == root_stream["selection"]:
        return f"{song_code}.m4a"
    suffix = stream_aliases(stream)[0].removeprefix(f"song3_{song_code}_")
    return f"{song_code}_{suffix}.m4a"


def main() -> None:
    parser = argparse.ArgumentParser()
    add_sources_config_argument(parser)
    parser.add_argument("--audio-root", type=Path)
    parser.add_argument("--vgmstream", type=Path)
    parser.add_argument("--ffmpeg")
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument(
        "--choreography-path",
        type=Path,
        default=DEFAULT_CHOREOGRAPHY_PATH,
    )
    parser.add_argument("--song-code", action="append", default=[])
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    sources = load_archive_sources(args.sources_config)
    output_root = args.output_root.resolve()
    choreography_path = args.choreography_path.resolve()
    audio_root = (
        args.audio_root or sources.raw_root / "audio"
    ).resolve()
    vgmstream = (
        args.vgmstream
        or (
            Path(os.environ["VGMSTREAM_CLI"])
            if os.environ.get("VGMSTREAM_CLI")
            else sources.tool_file("vgmstream")
        )
    ).resolve()
    ffmpeg = (
        args.ffmpeg
        or os.environ.get("FFMPEG")
        or (
            str(sources.ffmpeg_file)
            if sources.ffmpeg_file
            else "ffmpeg"
        )
    )

    if not audio_root.is_dir():
        raise FileNotFoundError(f"RAW audio root not found: {audio_root}")
    if not vgmstream.is_file():
        raise FileNotFoundError(f"vgmstream CLI not found: {vgmstream}")
    if not shutil.which(ffmpeg):
        raise FileNotFoundError(f"FFmpeg not found: {ffmpeg}")
    choreography = json.loads(choreography_path.read_text(encoding="utf-8"))
    requested = set(args.song_code)
    songs = [
        song for song in choreography["songs"]
        if not requested or song["songCode"] in requested
    ]
    if not songs:
        raise ValueError(f"No choreography songs matched: {sorted(requested)}")

    streams_by_code: dict[str, list[dict]] = {}
    root_by_code: dict[str, dict] = {}
    outputs: dict[tuple[str, int], dict] = {}
    mappings = {}
    for song_code in sorted({song["songCode"] for song in songs}):
        acb_path = audio_root / f"song3_{song_code}.acb"
        if not acb_path.is_file():
            raise FileNotFoundError(acb_path)
        streams = inspect_streams(vgmstream, acb_path)
        streams_by_code[song_code] = streams
        root_by_code[song_code] = find_root_stream(song_code, streams)

    for song in songs:
        song_code = song["songCode"]
        streams = streams_by_code[song_code]
        root_stream = root_by_code[song_code]
        variant_stream = find_variant_stream(song_code, song.get("variant") or "", streams)
        stream = variant_stream or root_stream
        key = (song_code, stream["selection"])
        file_name = output_name(song_code, stream, root_stream)
        relative_file = f"music/{file_name}"
        destination = output_root / file_name
        if key not in outputs:
            if args.force or not destination.is_file():
                print(
                    f"Extracting {song_code} stream {stream['selection']}/{len(streams)} "
                    f"({stream['name']}) -> {file_name}",
                    flush=True,
                )
                extract_m4a(
                    vgmstream,
                    ffmpeg,
                    audio_root / f"song3_{song_code}.acb",
                    stream,
                    destination,
                )
            outputs[key] = {
                "file": relative_file,
                "songCode": song_code,
                "streamIndex": stream["selection"],
                "streamName": stream["name"],
                "sampleRate": stream["sampleRate"],
                "channels": stream["channels"],
                "duration": stream["duration"],
                "encoding": "AAC in M4A",
                "sourceEncoding": stream["encoding"],
                "source": f"song3_{song_code}.acb",
            }
        mappings[song["id"]] = {
            **outputs[key],
            "variantFallback": bool(song.get("variant") and not variant_stream),
        }

    index_path = output_root / "index.json"
    if requested and index_path.is_file():
        existing = json.loads(index_path.read_text(encoding="utf-8"))
        merged_mappings = existing.get("songs", {})
        merged_mappings.update(mappings)
        mappings = merged_mappings
    indexed_files = {entry["file"] for entry in mappings.values()}
    indexed_packages = {entry["source"] for entry in mappings.values()}
    index_path.parent.mkdir(parents=True, exist_ok=True)
    index_path.write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "stats": {
                    "songs": len(mappings),
                    "files": len(indexed_files),
                    "sourcePackages": len(indexed_packages),
                },
                "songs": mappings,
            },
            ensure_ascii=False,
            separators=(",", ":"),
        )
        + "\n",
        encoding="utf-8",
    )
    print(
        f"Prepared {len(outputs)} selected M4A files; index now covers "
        f"{len(indexed_files)} files for {len(mappings)} choreography scripts"
    )


if __name__ == "__main__":
    main()
