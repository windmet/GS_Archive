#!/usr/bin/env python3
"""Read-only audit of the SideM IPA/XAPK CRI audio runtime boundary.

The script deliberately does not extract or modify the supplied archives. It
reads the IPA's ``glowing.acf`` CRI UTF tables and IL2CPP metadata directly
from the ZIP, then inventories the corresponding Android split APKs. Numeric
CRI values are kept as raw row bytes until a field-aware decoder is verified;
this prevents a guessed UTF storage type from being presented as an official
mixer preset.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import plistlib
import re
import struct
import zipfile
from pathlib import Path
from typing import Any, Iterable


UTF_MAGIC = b"@UTF"
ASCII_STRING_RE = re.compile(rb"[ -~]{3,160}")
MIXER_STRING_RE = re.compile(
    r"(?:song|vocal|voice|bgm|se_|submix|option|bus|master|stage|snapshot|"
    r"dsp|aisac|category|fade|pan|volume|track|singer|parallel|reverb)",
    re.IGNORECASE,
)
METADATA_TERMS = (
    "SwitchSingerUtil",
    "SetCategoryVolumeForParallelSong",
    "singerCountPanDict",
    "SingerNumVolumeList",
    "Song3BGM",
    "Song3Vocal",
    "Song3RootPath",
    "song3CueSheetName",
    "song3Regex",
    "ReserveTrack",
    "ReserveTracks",
    "PlaySong",
    "StopSongChannel",
    "PauseSongChannel",
    "SetMuteSong",
    "SetPan3dAngleSong",
    "SetEnvelopeTime",
    "SetSubAudioTrack",
    "SetExtraAudioTrack",
    "SetSubAudioVolume",
    "SetExtraAudioVolume",
)


def read_u16(data: bytes, offset: int) -> int:
    return struct.unpack_from(">H", data, offset)[0]


def read_u32(data: bytes, offset: int) -> int:
    return struct.unpack_from(">I", data, offset)[0]


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def c_string(data: bytes, offset: int) -> str:
    if offset < 0 or offset >= len(data):
        return ""
    value = data[offset :].split(b"\0", 1)[0]
    if not value:
        return ""
    try:
        return value.decode("utf-8")
    except UnicodeDecodeError:
        return value.decode("latin-1", "replace")


def iter_ascii_strings(data: bytes) -> Iterable[tuple[int, str]]:
    for match in ASCII_STRING_RE.finditer(data):
        try:
            yield match.start(), match.group().decode("ascii")
        except UnicodeDecodeError:
            continue


def parse_utf_table(data: bytes, base: int) -> dict[str, Any] | None:
    """Parse a CRI ``@UTF`` header and column descriptors.

    CRI offsets are relative to the table's eight-byte prefix (the magic and
    table-size fields). The row bytes are intentionally retained as a digest
    rather than decoded: storage flags 0x50/0x5a/0x5b in this ACF mix scalar,
    string-offset, and reference columns, and interpreting them without a
    field-aware decoder would create false gain/pan claims.
    """

    if base < 0 or base + 0x20 > len(data) or data[base : base + 4] != UTF_MAGIC:
        return None
    table_size = read_u32(data, base + 4)
    version = read_u16(data, base + 8)
    rows_offset = read_u16(data, base + 10)
    strings_offset = read_u32(data, base + 12)
    data_offset = read_u32(data, base + 16)
    name_offset = read_u32(data, base + 20)
    column_count = read_u16(data, base + 24)
    row_length = read_u16(data, base + 26)
    row_count = read_u32(data, base + 28)

    if not 0 < table_size <= len(data) or column_count > 4096 or row_count > 1_000_000:
        return None
    prefix = base + 8
    string_base = prefix + strings_offset
    row_base = prefix + rows_offset
    column_base = base + 0x20
    column_end = column_base + column_count * 5
    row_end = row_base + row_length * row_count
    if string_base >= len(data) or column_end > len(data) or row_end > len(data):
        return None
    if column_end > row_base:
        return None

    columns: list[dict[str, Any]] = []
    for index in range(column_count):
        offset = column_base + index * 5
        storage = data[offset]
        column_name_offset = read_u32(data, offset + 1)
        columns.append(
            {
                "index": index,
                "storage": f"0x{storage:02x}",
                "name_offset": column_name_offset,
                "name": c_string(data, string_base + column_name_offset),
            }
        )

    row_bytes = data[row_base:row_end]
    return {
        "offset": base,
        "table_size": table_size,
        "version": version,
        "rows_offset": rows_offset,
        "strings_offset": strings_offset,
        "data_offset": data_offset,
        "name_offset": name_offset,
        "name": c_string(data, string_base + name_offset),
        "column_count": column_count,
        "row_length": row_length,
        "row_count": row_count,
        "columns": columns,
        "row_bytes_sha256": sha256(row_bytes),
        "row_bytes_sample": row_bytes[:96].hex(),
    }


def parse_all_utf_tables(data: bytes) -> list[dict[str, Any]]:
    tables: list[dict[str, Any]] = []
    for base in range(0, len(data) - 4):
        if data[base : base + 4] != UTF_MAGIC:
            continue
        table = parse_utf_table(data, base)
        if table is not None:
            tables.append(table)
    return tables


def relevant_strings(data: bytes) -> list[str]:
    values = {
        text
        for _offset, text in iter_ascii_strings(data)
        if MIXER_STRING_RE.search(text)
    }
    return sorted(values, key=lambda value: (value.lower(), value))


def metadata_term_hits(data: bytes) -> list[dict[str, Any]]:
    hits: list[dict[str, Any]] = []
    for offset, text in iter_ascii_strings(data):
        matched = [term for term in METADATA_TERMS if term in text]
        for term in matched:
            hits.append({"term": term, "offset": offset, "text": text})
    return hits


def find_entry(names: Iterable[str], suffix: str) -> str:
    matches = sorted(name for name in names if name.lower().endswith(suffix.lower()))
    if not matches:
        raise FileNotFoundError(f"ZIP entry ending with {suffix!r} was not found")
    return matches[0]


def zip_entry_record(archive: zipfile.ZipFile, name: str) -> dict[str, Any]:
    data = archive.read(name)
    return {"name": name, "size": len(data), "sha256": sha256(data)}


def audit_ipa(path: Path) -> dict[str, Any]:
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        app_info_names = sorted(
            name
            for name in names
            if re.fullmatch(r"Payload/[^/]+\.app/Info\.plist", name)
        )
        if not app_info_names:
            raise FileNotFoundError("The IPA application Info.plist was not found")
        info_name = app_info_names[0]
        info = plistlib.loads(archive.read(info_name))
        acf_name = find_entry(names, "/Data/Raw/ADX2/glowing.acf")
        metadata_name = find_entry(names, "/Data/Managed/Metadata/global-metadata.dat")
        acf = archive.read(acf_name)
        metadata = archive.read(metadata_name)
        tables = parse_all_utf_tables(acf)
        song_entries = sorted(
            [
            zip_entry_record(archive, name)
            for name in names
            if name.lower().endswith(".acb")
            and ("song3_drvalv_" in name.lower() or name.lower().endswith("song3_grwsml.acb"))
            ],
            key=lambda entry: entry["name"],
        )
        unity_name = find_entry(names, "/Frameworks/UnityFramework.framework/UnityFramework")
        return {
            "archive": {
                "name": path.name,
                "size": path.stat().st_size,
                "sha256": sha256(path.read_bytes()),
                "entry_count": len(names),
            },
            "bundle": {
                key: info.get(key)
                for key in (
                    "CFBundleIdentifier",
                    "CFBundleShortVersionString",
                    "CFBundleVersion",
                    "CFBundleExecutable",
                    "MinimumOSVersion",
                )
            },
            "entries": {
                "acf": zip_entry_record(archive, acf_name),
                "metadata": zip_entry_record(archive, metadata_name),
                "unity_framework": zip_entry_record(archive, unity_name),
                "song3": song_entries,
            },
            "acf_utf": {
                "table_count": len(tables),
                "tables": tables,
                "table_names": sorted({table["name"] for table in tables if table["name"]}),
                "relevant_strings": relevant_strings(acf),
                "numeric_values": {
                    "status": "not_decoded",
                    "reason": "CRI storage flags are retained with raw row bytes until field-aware decoding is verified",
                },
            },
            "il2cpp_metadata": {
                "size": len(metadata),
                "sha256": sha256(metadata),
                "magic": metadata[:4].hex(),
                "metadata_terms": metadata_term_hits(metadata),
            },
        }


def audit_xapk(path: Path) -> dict[str, Any]:
    with zipfile.ZipFile(path) as xapk:
        manifest = json.loads(xapk.read("manifest.json"))
        split_records: list[dict[str, Any]] = []
        for apk_name in sorted(name for name in xapk.namelist() if name.lower().endswith(".apk")):
            apk_bytes = xapk.read(apk_name)
            with zipfile.ZipFile(io.BytesIO(apk_bytes)) as apk:
                names = apk.namelist()
                metadata = [name for name in names if "global-metadata.dat" in name.lower()]
                native = [
                    name
                    for name in names
                    if name.lower().endswith(".so")
                    and any(key in name.lower() for key in ("libil2cpp", "libcri_ware", "libunity"))
                ]
                audio = [
                    name
                    for name in names
                    if name.lower().endswith((".acb", ".awb", ".hca"))
                ]
                metadata_records = [zip_entry_record(apk, name) for name in metadata]
                if metadata:
                    metadata_records[0]["magic"] = apk.read(metadata[0])[:4].hex()
                split_records.append(
                    {
                        "name": apk_name,
                        "size": len(apk_bytes),
                        "sha256": sha256(apk_bytes),
                        "entry_count": len(names),
                        "metadata": metadata_records,
                        "native": [zip_entry_record(apk, name) for name in native],
                        "audio_entry_count": len(audio),
                        "audio_entries": audio,
                    }
                )
        return {
            "archive": {
                "name": path.name,
                "size": path.stat().st_size,
                "sha256": sha256(path.read_bytes()),
                "entry_count": len(xapk.namelist()),
            },
            "manifest": {
                key: manifest.get(key)
                for key in (
                    "package_name",
                    "version_code",
                    "version_name",
                    "min_sdk_version",
                    "target_sdk_version",
                    "split_configs",
                    "split_apks",
                )
            },
            "splits": split_records,
        }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ipa", type=Path, required=True)
    parser.add_argument("--xapk", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result: dict[str, Any] = {"schema_version": 1, "ipa": audit_ipa(args.ipa)}
    if args.xapk:
        result["xapk"] = audit_xapk(args.xapk)
    encoded = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(encoded, encoding="utf-8")
    else:
        print(encoded, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
