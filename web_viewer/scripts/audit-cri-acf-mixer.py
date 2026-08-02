#!/usr/bin/env python3
"""Read-only audit of the SideM IPA/XAPK CRI audio runtime boundary.

The script deliberately does not extract or modify the supplied archives. It
reads the IPA's ``glowing.acf`` CRI UTF tables and IL2CPP metadata directly
from the ZIP, then inventories the corresponding Android split APKs. Standard
CRI scalar fields are decoded, while opaque data references retain their raw
offset/size so they cannot be mistaken for an official singer preset.
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
IL2CPP_HEADER_KEYS = (
    "sanity", "version", "stringLiteralOffset", "stringLiteralSize",
    "stringLiteralDataOffset", "stringLiteralDataSize", "stringOffset",
    "stringSize", "eventsOffset", "eventsSize", "propertiesOffset",
    "propertiesSize", "methodsOffset", "methodsSize",
    "parameterDefaultValuesOffset", "parameterDefaultValuesSize",
    "fieldDefaultValuesOffset", "fieldDefaultValuesSize",
    "fieldAndParameterDefaultValueDataOffset",
    "fieldAndParameterDefaultValueDataSize", "fieldMarshaledSizesOffset",
    "fieldMarshaledSizesSize", "parametersOffset", "parametersSize",
    "fieldsOffset", "fieldsSize", "genericParametersOffset",
    "genericParametersSize", "genericParameterConstraintsOffset",
    "genericParameterConstraintsSize", "genericContainersOffset",
    "genericContainersSize", "nestedTypesOffset", "nestedTypesSize",
    "interfacesOffset", "interfacesSize", "vtableMethodsOffset",
    "vtableMethodsSize", "interfaceOffsetsOffset", "interfaceOffsetsSize",
    "typeDefinitionsOffset", "typeDefinitionsSize", "imagesOffset",
    "imagesSize", "assembliesOffset", "assembliesSize", "fieldRefsOffset",
    "fieldRefsSize", "referencedAssembliesOffset", "referencedAssembliesSize",
    "attributesInfoOffset", "attributesInfoCount", "attributeTypesOffset",
    "attributeTypesCount", "unresolvedVirtualCallParameterTypesOffset",
    "unresolvedVirtualCallParameterTypesSize",
    "unresolvedVirtualCallParameterRangesOffset",
    "unresolvedVirtualCallParameterRangesSize", "windowsRuntimeTypeNamesOffset",
    "windowsRuntimeTypeNamesSize", "windowsRuntimeStringsOffset",
    "windowsRuntimeStringsSize", "exportedTypeDefinitionsOffset",
    "exportedTypeDefinitionsSize",
)
METADATA_TARGETS = (
    ("Growing.Live", "SwitchSingerUtil"),
    ("Growing", "SoundManager"),
    ("Growing.Live", "LiveSoundDirector"),
    ("Growing.Live", "LiveStage"),
    ("Growing.Models.Data", "SongData"),
    ("Growing.Theater", "SongVisualizer"),
    ("Growing.Theater", "VocalSettingPopupContent"),
    ("CriWare.CriMana", "Player"),
)
METADATA_MEMBER_RE = re.compile(
    r"(?:song|vocal|singer|track|parallel|category|reserve|stop|pause|mute|"
    r"volume|pan|play|switch|cue|audio|envelope)",
    re.IGNORECASE,
)


def read_u16(data: bytes, offset: int) -> int:
    return struct.unpack_from(">H", data, offset)[0]


def read_u32(data: bytes, offset: int) -> int:
    return struct.unpack_from(">I", data, offset)[0]


def read_f32(data: bytes, offset: int) -> float:
    return struct.unpack_from(">f", data, offset)[0]


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


UTF_TYPE_SIZE = {
    0x0: 1,
    0x1: 1,
    0x2: 2,
    0x3: 2,
    0x4: 4,
    0x5: 4,
    0x6: 8,
    0x7: 8,
    0x8: 4,
    0x9: 8,
    0xA: 4,
    0xB: 8,
}


def decode_utf_value(
    data: bytes, offset: int, value_type: int, strings_base: int
) -> Any:
    if value_type == 0x0:
        return data[offset]
    if value_type == 0x1:
        return struct.unpack_from(">b", data, offset)[0]
    if value_type == 0x2:
        return read_u16(data, offset)
    if value_type == 0x3:
        return struct.unpack_from(">h", data, offset)[0]
    if value_type == 0x4:
        return read_u32(data, offset)
    if value_type == 0x5:
        return struct.unpack_from(">i", data, offset)[0]
    if value_type == 0x6:
        return struct.unpack_from(">Q", data, offset)[0]
    if value_type == 0x7:
        return struct.unpack_from(">q", data, offset)[0]
    if value_type == 0x8:
        return read_f32(data, offset)
    if value_type == 0x9:
        return struct.unpack_from(">d", data, offset)[0]
    if value_type == 0xA:
        return c_string(data, strings_base + read_u32(data, offset))
    if value_type == 0xB:
        return {
            "offset": read_u32(data, offset),
            "size": read_u32(data, offset + 4),
        }
    raise ValueError(f"unsupported CRI UTF value type 0x{value_type:x}")


def decode_utf_row(data: bytes, table: dict[str, Any], row: int) -> dict[str, Any]:
    values: dict[str, Any] = {}
    row_base = table["row_base"] + row * table["row_length"]
    for column in table["columns"]:
        name = column["name"] or f"__column_{column['index']}"
        if column["has_default"]:
            value = column["default_value"]
        elif column["row_offset"] is not None:
            value = decode_utf_value(
                data,
                row_base + column["row_offset"],
                column["value_type"],
                table["strings_base"],
            )
        else:
            value = None
        values[name] = value
    return values


def parse_utf_table(data: bytes, base: int) -> dict[str, Any] | None:
    """Parse one CRI ``@UTF`` table, including defaults and row values."""

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
    if string_base >= len(data) or row_base > len(data):
        return None

    columns: list[dict[str, Any]] = []
    cursor = column_base
    row_cursor = 0
    for index in range(column_count):
        if cursor >= len(data):
            return None
        flags = data[cursor]
        cursor += 1
        value_type = flags & 0x0F
        if value_type not in UTF_TYPE_SIZE:
            return None
        has_name = bool(flags & 0x10)
        has_default = bool(flags & 0x20)
        has_row = bool(flags & 0x40)
        column_name_offset = None
        name = ""
        if has_name:
            if cursor + 4 > len(data):
                return None
            column_name_offset = read_u32(data, cursor)
            cursor += 4
            name = c_string(data, string_base + column_name_offset)
        default_value = None
        if has_default:
            size = UTF_TYPE_SIZE[value_type]
            if cursor + size > len(data):
                return None
            default_value = decode_utf_value(data, cursor, value_type, string_base)
            cursor += size
        row_offset = None
        if has_row and not has_default:
            row_offset = row_cursor
            row_cursor += UTF_TYPE_SIZE[value_type]
        columns.append(
            {
                "index": index,
                "flags": f"0x{flags:02x}",
                "value_type": value_type,
                "storage": f"0x{flags:02x}",
                "has_name": has_name,
                "has_default": has_default,
                "has_row": has_row,
                "name_offset": column_name_offset,
                "name": name,
                "default_value": default_value,
                "row_offset": row_offset,
            }
        )

    row_end = row_base + row_length * row_count
    if cursor > row_base or row_cursor > row_length or row_end > len(data):
        return None
    row_bytes = data[row_base:row_end]
    table = {
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
        "strings_base": string_base,
        "data_base": prefix + data_offset,
        "row_base": row_base,
        "columns": columns,
        "row_bytes_sha256": sha256(row_bytes),
        "row_bytes_sample": row_bytes[:96].hex(),
    }
    table["rows"] = [decode_utf_row(data, table, row) for row in range(row_count)]
    return {
        key: value
        for key, value in table.items()
        if key not in {"strings_base", "data_base", "row_base"}
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


def _data_ref_hex(data: bytes, table: dict[str, Any], value: Any) -> str:
    """Resolve a CRI UTF data reference without interpreting its payload."""

    if not isinstance(value, dict) or not {"offset", "size"}.issubset(value):
        return ""
    start = table["offset"] + 8 + table["data_offset"] + int(value["offset"])
    end = start + int(value["size"])
    if start < 0 or end > len(data):
        return ""
    return data[start:end].hex()


def build_mixer_summary(data: bytes, tables: list[dict[str, Any]]) -> dict[str, Any]:
    by_name = {table["name"]: table for table in tables if table["name"]}
    root = by_name.get("Header")
    dsp_setting = by_name.get("DspSetting")
    bus = by_name.get("Bus")
    bus_name = by_name.get("BusName")
    snapshots = by_name.get("DspSettingSnapshot")
    categories = by_name.get("CategoryName")
    category_rows = by_name.get("Category")
    commands = by_name.get("Command")
    bus_links_table = by_name.get("BusLink")
    dsp_fx = by_name.get("DspFx")

    def values(table: dict[str, Any] | None, keys: Iterable[str]) -> list[dict[str, Any]]:
        if not table:
            return []
        wanted = tuple(keys)
        return [
            {key: row.get(key) for key in wanted if key in row}
            for row in table["rows"]
        ]

    bus_names = {
        index: row.get("StringValue", "")
        for index, row in enumerate(bus_name["rows"] if bus_name else [])
    }
    bus_rows: list[dict[str, Any]] = []
    if bus:
        for index, row in enumerate(bus["rows"]):
            bus_rows.append(
                {
                    "row": index,
                    "bus_no": row.get("BusNo"),
                    "name": bus_names.get(row.get("BusNameIndex"), ""),
                    "volume": row.get("Volume"),
                    "pan3d_volume": row.get("Pan3dVolume"),
                    "pan3d_angle": row.get("Pan3dAngle"),
                    "pan3d_distance": row.get("Pan3dDistance"),
                    "start_fx_index": row.get("StartFxIndex"),
                    "num_fxs": row.get("NumFxs"),
                    "start_bus_link_index": row.get("StartBusLinkIndex"),
                    "num_bus_links": row.get("NumBusLinks"),
                }
            )
    bus_links = [
        {
            "row": index,
            "type": row.get("Type"),
            "send_level": row.get("SendLevel"),
            "send_bus_no": row.get("SendBusNo"),
            "bus_name": bus_names.get(row.get("BusNameIndex"), ""),
            "backup_work_offset": row.get("BackupWorkOffset"),
        }
        for index, row in enumerate(bus_links_table["rows"] if bus_links_table else [])
    ]
    command_rows = []
    if commands:
        for index, row in enumerate(commands["rows"]):
            reference = row.get("Command")
            command_rows.append(
                {
                    "row": index,
                    "reference": reference,
                    "raw_hex": _data_ref_hex(data, commands, reference),
                }
            )
    category_name_by_id = {
        row.get("Index"): row.get("Name", "")
        for row in (categories["rows"] if categories else [])
    }
    category_command_map = []
    if category_rows:
        for row in category_rows["rows"]:
            category_id = row.get("Id")
            command_index = row.get("CommandIndex")
            category_command_map.append(
                {
                    "id": category_id,
                    "name": category_name_by_id.get(category_id, ""),
                    "group_index": row.get("GroupIndex"),
                    "command_index": command_index,
                    "command_raw_hex": (
                        command_rows[command_index]["raw_hex"]
                        if isinstance(command_index, int)
                        and 0 <= command_index < len(command_rows)
                        else ""
                    ),
                }
            )
    return {
        "status": "field_aware_partial",
        "decoder": "CRI UTF flags and scalar types; opaque data refs remain offset/size",
        "root": values(
            root,
            (
                "Name",
                "VersionString",
                "CategoriesParPlayback",
                "CharacterEncodingType",
                "LinkedCueCategoryLimitFlag",
                "PreReadTime",
            ),
        ),
        "dsp_settings": values(
            dsp_setting,
            ("Name", "StartIndex", "NumBuses", "SnapshotStartIndex", "NumSnapshots"),
        ),
        "snapshots": values(
            snapshots,
            ("Name", "StartIndex", "NumBuses", "StartExtendBusIndex", "NumExtendBuses"),
        ),
        "bus_names": bus_names,
        "buses": bus_rows,
        "categories": values(categories, ("Name", "Index")),
        "category_command_map": category_command_map,
        "commands": command_rows,
        "bus_links": bus_links,
        "dsp_effects": values(
            dsp_fx,
            ("FxType", "DspName", "NumParameters", "Bypass", "Parameters"),
        ),
    }


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


def audit_il2cpp_metadata(data: bytes) -> dict[str, Any]:
    """Describe the small set of managed song/mixer types we can prove.

    This intentionally reads names, tokens, and parameter names only.  IL2CPP
    metadata does not contain method bodies or the runtime values assigned by
    ``SwitchSingerUtil``'s static initializer.
    """

    if len(data) < 64 * 4:
        return {"status": "unsupported", "reason": "metadata header is truncated"}
    header_values = struct.unpack_from("<64I", data, 0)
    header = dict(zip(IL2CPP_HEADER_KEYS, header_values, strict=True))
    if header["sanity"] != 0xFAB11BAF:
        return {
            "status": "unsupported",
            "reason": "unexpected metadata magic",
            "magic": data[:4].hex(),
        }
    if header["version"] != 27:
        return {
            "status": "unsupported",
            "reason": f"unsupported metadata version {header['version']}",
            "version": header["version"],
        }

    def records(name: str, size: int, fmt: str) -> list[tuple[Any, ...]]:
        offset = header[f"{name}Offset"]
        byte_size = header[f"{name}Size"]
        if byte_size % size or offset + byte_size > len(data):
            raise ValueError(f"invalid {name} table bounds")
        return [
            struct.unpack_from(fmt, data, offset + index * size)
            for index in range(byte_size // size)
        ]

    types = records("typeDefinitions", 88, "<16i8H2I")
    methods = records("methods", 32, "<5iI4H")
    fields = records("fields", 12, "<IiI")
    parameters = records("parameters", 12, "<IIi")

    def string(index: int) -> str:
        start = header["stringOffset"] + index
        limit = header["stringOffset"] + header["stringSize"]
        if start < header["stringOffset"] or start >= limit:
            return ""
        end = data.find(b"\0", start, limit)
        if end < 0:
            return ""
        return data[start:end].decode("utf-8", "replace")

    def describe(namespace: str, name: str) -> dict[str, Any] | None:
        matches = [
            (index, record)
            for index, record in enumerate(types)
            if string(record[0]) == name and string(record[1]) == namespace
        ]
        if len(matches) != 1:
            return None
        index, record = matches[0]
        field_start, method_start = record[8], record[9]
        method_count, field_count = record[16], record[18]
        all_fields = [
            string(fields[field_index][0])
            for field_index in range(field_start, field_start + field_count)
        ]
        selected_fields = {
            field_name
            for field_name in all_fields
            if METADATA_MEMBER_RE.search(field_name)
            or name == "SwitchSingerUtil"
        }
        selected_methods: list[dict[str, Any]] = []
        for method_index in range(method_start, method_start + method_count):
            method = methods[method_index]
            method_name = string(method[0])
            if not METADATA_MEMBER_RE.search(method_name):
                continue
            parameter_names = [
                string(parameters[param_index][0])
                for param_index in range(method[3], method[3] + method[9])
            ]
            selected_methods.append(
                {
                    "name": method_name,
                    "token": f"0x{method[5]:08x}",
                    "parameters": parameter_names,
                }
            )
        return {
            "metadata_index": index,
            "namespace": namespace,
            "name": name,
            "token": f"0x{record[25]:08x}",
            "fields": sorted(selected_fields),
            "methods": selected_methods,
        }

    targets: list[dict[str, Any]] = []
    for namespace, name in METADATA_TARGETS:
        description = describe(namespace, name)
        if description is not None:
            targets.append(description)
    return {
        "status": "v27_targeted",
        "header": {"version": header["version"], "sanity": data[:4].hex()},
        "targets": targets,
        "numeric_preset_values": "not present in metadata string/type tables",
    }


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
                "mixer_summary": build_mixer_summary(acf, tables),
            },
            "il2cpp_metadata": {
                "size": len(metadata),
                "sha256": sha256(metadata),
                "magic": metadata[:4].hex(),
                "metadata_terms": metadata_term_hits(metadata),
                "targeted_types": audit_il2cpp_metadata(metadata),
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
