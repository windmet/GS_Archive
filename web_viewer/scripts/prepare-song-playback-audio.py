#!/usr/bin/env python3
"""Prepare one browser-readable full-mix track for every catalog song.

The output reuses the existing ignored live-chibi music directory so the song
portal and Chibi stage do not duplicate roughly 300 MB of derived media.  RAW
ACB files remain immutable; the tracked manifest records the exact cue,
selection, hashes, and browser URL for each local derivative.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_PIPELINE_ROOT = PROJECT_ROOT.parent / "data_pipeline"
sys.path.insert(0, str(DATA_PIPELINE_ROOT))

from archive_paths import add_sources_config_argument, load_archive_sources


MUSIC_CATALOG = PROJECT_ROOT / "public" / "data" / "masterdata" / "music_catalog.json"
DEFAULT_OUTPUT_ROOT = PROJECT_ROOT / "public" / "assets" / "live-chibi" / "music"
DEFAULT_MANIFEST = PROJECT_ROOT / "public" / "data" / "song_playback_audio.json"
PUBLIC_URL_ROOT = "/assets/live-chibi/music"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def inspect_stream(vgmstream: Path, acb_path: Path, selection: int = 1) -> dict:
    command = [str(vgmstream), "-m", "-I", str(acb_path)]
    if selection != 1:
        command[1:1] = ["-s", str(selection)]
    result = subprocess.run(
        command,
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    info = json.loads(result.stdout)
    sample_rate = int(info.get("sampleRate") or 0)
    samples = int(info.get("numberOfSamples") or 0)
    return {
        "selection": selection,
        "total": int(info.get("streamInfo", {}).get("total") or 1),
        "cue_name": str(info.get("streamInfo", {}).get("name") or ""),
        "sample_rate": sample_rate,
        "channels": int(info.get("channels") or 0),
        "samples": samples,
        "duration_seconds": round(samples / sample_rate, 6) if sample_rate else 0,
        "source_encoding": info.get("encoding"),
    }


def aliases(stream: dict) -> list[str]:
    return [part.strip() for part in stream["cue_name"].split(";") if part.strip()]


def find_full_mix(vgmstream: Path, acb_path: Path, song_code: str) -> dict:
    first = inspect_stream(vgmstream, acb_path)
    expected = f"song3_{song_code}"
    candidates = [first]
    for selection in range(2, first["total"] + 1):
        candidates.append(inspect_stream(vgmstream, acb_path, selection))
    matches = [stream for stream in candidates if expected in aliases(stream)]
    if len(matches) != 1:
        raise ValueError(
            f"{acb_path.name}: expected exactly one {expected!r} full-mix cue, found {len(matches)}"
        )
    return matches[0]


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


def main() -> None:
    parser = argparse.ArgumentParser()
    add_sources_config_argument(parser)
    parser.add_argument("--audio-root", type=Path)
    parser.add_argument("--vgmstream", type=Path)
    parser.add_argument("--ffmpeg")
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    sources = load_archive_sources(args.sources_config)
    audio_root = (args.audio_root or sources.raw_root / "audio").resolve()
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
        or (str(sources.ffmpeg_file) if sources.ffmpeg_file else "ffmpeg")
    )
    output_root = args.output_root.resolve()
    manifest_path = args.manifest.resolve()

    if not audio_root.is_dir():
        raise FileNotFoundError(f"RAW audio root not found: {audio_root}")
    if not vgmstream.is_file():
        raise FileNotFoundError(f"vgmstream CLI not found: {vgmstream}")
    if not shutil.which(ffmpeg):
        raise FileNotFoundError(f"FFmpeg not found: {ffmpeg}")

    catalog = json.loads(MUSIC_CATALOG.read_text(encoding="utf-8"))
    songs = catalog.get("songs") or {}
    if len(songs) != 61:
        raise ValueError(f"expected 61 music catalog songs, found {len(songs)}")

    entries = {}
    extracted = 0
    for song_code, song in sorted(songs.items()):
        acb_path = audio_root / f"song3_{song_code}.acb"
        if not acb_path.is_file():
            raise FileNotFoundError(acb_path)
        stream = find_full_mix(vgmstream, acb_path, song_code)
        destination = output_root / f"{song_code}.m4a"
        if args.force or not destination.is_file():
            print(
                f"Extracting {song_code} selection {stream['selection']}/{stream['total']} "
                f"({stream['cue_name']})",
                flush=True,
            )
            extract_m4a(vgmstream, ffmpeg, acb_path, stream, destination)
            extracted += 1
        entries[song_code] = {
            "song_code": song_code,
            "title": song.get("title") or song_code,
            "kind": "full-mix",
            "label": "完整混音",
            "url": f"{PUBLIC_URL_ROOT}/{song_code}.m4a",
            "source": {
                "path": f"RAW/audio/{acb_path.name}",
                "sha256": sha256(acb_path),
                **stream,
            },
            "derived": {
                "encoding": "AAC in M4A",
                "bytes": destination.stat().st_size,
                "sha256": sha256(destination),
            },
        }

    manifest = {
        "schema_version": 1,
        "status": "local-derived",
        "scope": ["song_detail"],
        "summary": {
            "catalog_songs": len(songs),
            "full_mix_tracks": len(entries),
        },
        "evidence": (
            "Each URL is the exact song3_<code> cue selected from the matching immutable "
            "RAW ACB. Browser media is ignored/local-derived and is not a publication artifact."
        ),
        "songs": entries,
    }
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Prepared {len(entries)} full-mix tracks ({extracted} newly extracted)")


if __name__ == "__main__":
    main()
