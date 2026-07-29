"""Extract one auditable audio candidate from SideM RAW without replacing public assets."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path
from typing import Any

from archive_paths import add_sources_config_argument, load_archive_sources


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def inspect_stream(vgmstream: Path, source: Path, selection: int) -> dict[str, Any] | None:
    result = subprocess.run(
        [str(vgmstream), "-m", "-I", "-s", str(selection), str(source)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if result.returncode != 0:
        return None
    for line in result.stdout.splitlines():
        if not line.startswith("{"):
            continue
        try:
            return json.loads(line)
        except json.JSONDecodeError:
            continue
    return None


def stream_aliases(metadata: dict[str, Any]) -> list[str]:
    name = str((metadata.get("streamInfo") or {}).get("name") or "")
    return [part.strip() for part in name.split(";") if part.strip()]


def find_stream(
    vgmstream: Path,
    source: Path,
    cue: str,
    explicit_selection: int | None,
) -> tuple[int, dict[str, Any]]:
    if explicit_selection is not None:
        metadata = inspect_stream(vgmstream, source, explicit_selection)
        if metadata is None:
            raise RuntimeError(f"Cannot inspect stream {explicit_selection} in {source}")
        aliases = stream_aliases(metadata)
        if cue not in aliases:
            raise RuntimeError(
                f"Stream {explicit_selection} aliases {aliases!r} do not contain cue {cue!r}"
            )
        return explicit_selection, metadata

    first = inspect_stream(vgmstream, source, 1)
    if first is None:
        raise RuntimeError(f"Cannot inspect {source}")
    total = int((first.get("streamInfo") or {}).get("total") or 1)
    for selection in range(1, total + 1):
        metadata = first if selection == 1 else inspect_stream(vgmstream, source, selection)
        if metadata and cue in stream_aliases(metadata):
            return selection, metadata
    raise RuntimeError(f"Cue {cue!r} not found in {source.name} ({total} streams)")


def decode_candidate(
    vgmstream: Path,
    ffmpeg: Path,
    source: Path,
    selection: int,
    destination: Path,
) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    vgm = subprocess.Popen(
        [str(vgmstream), "-s", str(selection), "-i", "-p", str(source)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    assert vgm.stdout is not None
    ffmpeg_result = subprocess.run(
        [
            str(ffmpeg),
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "wav",
            "-i",
            "pipe:0",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-movflags",
            "+faststart",
            str(destination),
        ],
        stdin=vgm.stdout,
        capture_output=True,
        check=False,
    )
    vgm.stdout.close()
    vgm_stderr = vgm.stderr.read().decode("utf-8", errors="replace") if vgm.stderr else ""
    vgm_code = vgm.wait()
    if vgm_code != 0 or ffmpeg_result.returncode != 0:
        destination.unlink(missing_ok=True)
        raise RuntimeError(
            "Audio conversion failed\n"
            f"vgmstream ({vgm_code}): {vgm_stderr}\n"
            f"ffmpeg ({ffmpeg_result.returncode}): "
            f"{ffmpeg_result.stderr.decode('utf-8', errors='replace')}"
        )


def probe_output(ffprobe: Path, path: Path) -> dict[str, Any]:
    result = subprocess.run(
        [
            str(ffprobe),
            "-v",
            "error",
            "-show_entries",
            "format=duration,size,bit_rate:stream=codec_name,sample_rate,channels",
            "-of",
            "json",
            str(path),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=True,
    )
    return json.loads(result.stdout)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    add_sources_config_argument(parser)
    parser.add_argument("--raw-root", type=Path)
    parser.add_argument("--kind", choices=("song", "bgm", "ambient", "se"), required=True)
    parser.add_argument("--container", help="ACB or AWB filename below RAW/audio")
    parser.add_argument("--cue", required=True)
    parser.add_argument("--selection", type=int)
    parser.add_argument(
        "--cue-index",
        type=Path,
        help="Aggregated cue_index.json; resolves a unique cue when container is omitted",
    )
    parser.add_argument("--evidence", action="append", default=[])
    parser.add_argument("--output-root", type=Path)
    parser.add_argument("--vgmstream", type=Path)
    parser.add_argument("--ffmpeg", type=Path)
    parser.add_argument("--ffprobe", type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    sources = load_archive_sources(args.sources_config)
    raw_root = (args.raw_root or sources.raw_root).resolve()
    cue_index_path = (
        args.cue_index
        or sources.inventory_path("audio", "cue-index", "cue_index.json")
    ).resolve()
    resolution = None
    container = args.container
    selection_arg = args.selection
    if not container:
        index = json.loads(cue_index_path.read_text(encoding="utf-8"))
        entries = (index.get("cues") or {}).get(args.cue) or []
        if not entries:
            raise RuntimeError(f"Cue {args.cue!r} is absent from {cue_index_path}")
        if len(entries) != 1:
            choices = [
                f"{entry.get('source')}#{entry.get('selection')}"
                for entry in entries
            ]
            raise RuntimeError(
                f"Cue {args.cue!r} is ambiguous in the cue index: {choices!r}; "
                "pass --container and --selection explicitly"
            )
        selected = entries[0]
        container = Path(str(selected["source"])).name
        selection_arg = int(selected["selection"])
        resolution = {
            "cue_index": str(cue_index_path),
            "entry_count": 1,
            "bank": selected.get("bank"),
            "source": selected.get("source"),
        }
    source = raw_root / "audio" / str(container)
    output_root = (
        args.output_root or sources.inventory_path("audio")
    ).resolve()
    vgmstream = (args.vgmstream or sources.tool_file("vgmstream")).resolve()
    ffmpeg = (args.ffmpeg or sources.tool_file("ffmpeg")).resolve()
    ffprobe = (
        args.ffprobe
        or sources.ffprobe_file
        or ffmpeg.with_name("ffprobe.exe")
    ).resolve()
    for required in (source, vgmstream, ffmpeg, ffprobe):
        if not required.is_file():
            raise FileNotFoundError(required)

    selection, metadata = find_stream(
        vgmstream,
        source,
        args.cue,
        selection_arg,
    )
    candidate_dir = output_root / args.kind / args.cue
    destination = candidate_dir / f"{args.cue}.m4a"
    decode_candidate(vgmstream, ffmpeg, source, selection, destination)

    manifest = {
        "schema_version": 1,
        "kind": args.kind,
        "cue": args.cue,
        "source": {
            "path": f"RAW/audio/{source.name}",
            "size": source.stat().st_size,
            "sha256": sha256_file(source),
            "selection": selection,
            "stream_aliases": stream_aliases(metadata),
            "metadata": metadata,
        },
        "evidence": args.evidence,
        "resolution": resolution,
        "output": {
            "path": str(destination),
            "size": destination.stat().st_size,
            "sha256": sha256_file(destination),
            "probe": probe_output(ffprobe, destination),
        },
    }
    candidate_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = candidate_dir / "candidate.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
