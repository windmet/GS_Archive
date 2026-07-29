"""Build a reproducible manifest for an extracted SideM RAW archive.

The source directory is treated as read-only. Outputs are written elsewhere so
the extracted archive remains byte-for-byte comparable with RAW.7z.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from archive_paths import ArchiveSources, load_archive_sources


EXPECTED_SECTIONS = {"asset", "audio", "movie"}
EXPECTED_EXTENSIONS = {
    "asset": {".unity3d"},
    "audio": {".acb", ".awb"},
    "movie": {".usm"},
    "root": {".txt"},
}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--sources-config",
        type=Path,
        help=(
            "Archive source JSON. Defaults to the ignored local config when "
            "present, then to repository-relative paths."
        ),
    )
    parser.add_argument(
        "--raw-root",
        type=Path,
        help="Override the configured RAW root.",
    )
    parser.add_argument("--output", type=Path)
    parser.add_argument("--summary", type=Path)
    parser.add_argument(
        "--archive-volume",
        type=Path,
        action="append",
        default=[],
        help="Optional RAW.7z volume to hash; repeat for every volume.",
    )
    parser.add_argument("--source-id", default="sidem-growing-stars-raw")
    return parser.parse_args()


def _is_within(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
    except ValueError:
        return False
    return True


def _masterdata_evidence(sources: ArchiveSources) -> dict[str, Any]:
    evidence: dict[str, Any] = {}
    for state, path, configured_hash in (
        (
            "xor",
            sources.masterdata_source_file,
            sources.masterdata_source_sha256,
        ),
        (
            "decoded",
            sources.masterdata_decoded_file,
            sources.masterdata_decoded_sha256,
        ),
    ):
        record: dict[str, Any] = {
            "state": state,
            "configured": path is not None,
            "exists": bool(path and path.is_file()),
        }
        if path is not None:
            record["path"] = str(path)
        if configured_hash is not None:
            record["configured_sha256"] = configured_hash
        if path is not None and path.is_file():
            actual_hash = sha256_file(path)
            record["bytes"] = path.stat().st_size
            record["sha256"] = actual_hash
            record["hash_matches_config"] = (
                configured_hash is None or actual_hash == configured_hash
            )
            if record["hash_matches_config"] is False:
                raise ValueError(
                    f"masterdata {state} SHA-256 mismatch: "
                    f"expected {configured_hash}, got {actual_hash}"
                )
        evidence[state] = record
    return evidence


def build_manifest(
    *,
    raw_root: Path,
    output: Path,
    summary_path: Path,
    archive_volumes: list[Path],
    source_id: str,
    sources: ArchiveSources,
) -> dict[str, Any]:
    raw_root = raw_root.resolve()
    if not raw_root.is_dir():
        raise FileNotFoundError(raw_root)
    output = output.resolve()
    summary_path = summary_path.resolve()
    if _is_within(output, raw_root) or _is_within(summary_path, raw_root):
        raise ValueError("manifest outputs must remain outside the read-only RAW root")

    files = sorted(
        (path for path in raw_root.rglob("*") if path.is_file()),
        key=lambda path: path.relative_to(raw_root).as_posix(),
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    masterdata_evidence = _masterdata_evidence(sources)
    suffix = uuid4().hex
    temporary_output = output.with_name(f".{output.name}.{suffix}.tmp")
    temporary_summary = summary_path.with_name(f".{summary_path.name}.{suffix}.tmp")

    section_counts: Counter[str] = Counter()
    section_bytes: Counter[str] = Counter()
    extension_counts: Counter[str] = Counter()
    total_size = 0
    unexpected_files: list[dict[str, str]] = []
    casefold_paths: defaultdict[str, list[str]] = defaultdict(list)
    content_identity = hashlib.sha256()

    try:
        with temporary_output.open("w", encoding="utf-8", newline="\n") as target:
            for path in files:
                relative = path.relative_to(raw_root).as_posix()
                parts = Path(relative).parts
                section = (
                    parts[0]
                    if len(parts) > 1 and parts[0] in EXPECTED_SECTIONS
                    else "root"
                )
                stat = path.stat()
                extension = path.suffix.lower()
                digest = sha256_file(path)
                source_status = (
                    "archive-metadata" if section == "root" else "raw-authoritative"
                )
                record = {
                    "schema_version": 1,
                    "source_id": source_id,
                    "source_status": source_status,
                    "relative_path": relative,
                    "section": section,
                    "extension": extension,
                    "size": stat.st_size,
                    "mtime_utc": datetime.fromtimestamp(
                        stat.st_mtime, tz=timezone.utc
                    ).isoformat(),
                    "sha256": digest,
                }
                target.write(
                    json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n"
                )
                section_counts[section] += 1
                section_bytes[section] += stat.st_size
                extension_counts[extension or "<none>"] += 1
                total_size += stat.st_size
                casefold_paths[relative.casefold()].append(relative)
                if extension not in EXPECTED_EXTENSIONS.get(section, set()):
                    unexpected_files.append(
                        {
                            "relative_path": relative,
                            "reason": (
                                "derived-or-unsupported-file-inside-raw-location"
                            ),
                        }
                    )
                identity_record = {
                    "relative_path": relative,
                    "section": section,
                    "extension": extension,
                    "size": stat.st_size,
                    "sha256": digest,
                    "source_status": source_status,
                }
                content_identity.update(
                    json.dumps(
                        identity_record,
                        ensure_ascii=False,
                        sort_keys=True,
                        separators=(",", ":"),
                    ).encode("utf-8")
                )
                content_identity.update(b"\n")

        volume_records = []
        for volume in archive_volumes:
            resolved = volume.resolve()
            if not resolved.is_file():
                raise FileNotFoundError(resolved)
            volume_records.append(
                {
                    "path": str(resolved),
                    "size": resolved.stat().st_size,
                    "sha256": sha256_file(resolved),
                }
            )

        duplicate_paths = [
            paths for paths in casefold_paths.values() if len(paths) > 1
        ]
        summary = {
            "schema_version": 2,
            "manifest_record_schema_version": 1,
            "source_id": source_id,
            "raw_root": str(raw_root),
            "file_count": len(files),
            "total_size": total_size,
            "section_counts": dict(sorted(section_counts.items())),
            "section_bytes": dict(sorted(section_bytes.items())),
            "extension_counts": dict(sorted(extension_counts.items())),
            "archive_volumes": volume_records,
            "manifest": str(output),
            "manifest_sha256": sha256_file(temporary_output),
            "content_identity_sha256": content_identity.hexdigest(),
            "case_insensitive_duplicate_paths": duplicate_paths,
            "unexpected_files": unexpected_files,
            "masterdata": masterdata_evidence,
        }
        temporary_summary.write_text(
            json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        temporary_output.replace(output)
        temporary_summary.replace(summary_path)
        return summary
    finally:
        temporary_output.unlink(missing_ok=True)
        temporary_summary.unlink(missing_ok=True)


def main() -> None:
    args = parse_args()
    sources = load_archive_sources(args.sources_config)
    raw_root = (args.raw_root or sources.raw_root).resolve()
    output = (
        args.output
        or sources.inventory_root / "source" / "files.jsonl"
    ).resolve()
    summary_path = (
        args.summary
        or sources.inventory_root / "source" / "summary.json"
    ).resolve()
    summary = build_manifest(
        raw_root=raw_root,
        output=output,
        summary_path=summary_path,
        archive_volumes=args.archive_volume,
        source_id=args.source_id,
        sources=sources,
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
