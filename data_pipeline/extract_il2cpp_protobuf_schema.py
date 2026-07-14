#!/usr/bin/env python3
"""Extract protobuf field-number constants from an IL2CPP v27 metadata file."""

from __future__ import annotations

import argparse
import hashlib
import json
import struct
from collections import Counter
from pathlib import Path


SANITY = 0xFAB11BAF
SUPPORTED_VERSION = 27
HEADER_PAIR_NAMES = (
    "string_literal",
    "string_literal_data",
    "string",
    "events",
    "properties",
    "methods",
    "parameter_default_values",
    "field_default_values",
    "default_value_data",
    "field_marshaled_sizes",
    "parameters",
    "fields",
    "generic_parameters",
    "generic_parameter_constraints",
    "generic_containers",
    "nested_types",
    "interfaces",
    "vtable_methods",
    "interface_offsets",
    "type_definitions",
    "images",
    "assemblies",
    "field_refs",
    "referenced_assemblies",
    "attributes_info",
    "attribute_types",
    "unresolved_virtual_call_parameter_types",
    "unresolved_virtual_call_parameter_ranges",
    "windows_runtime_type_names",
    "windows_runtime_strings",
    "exported_type_definitions",
)
TYPE_DEFINITION_FORMAT = "<16I8H2I"
TYPE_DEFINITION_SIZE = struct.calcsize(TYPE_DEFINITION_FORMAT)
FIELD_DEFINITION_FORMAT = "<IiI"
FIELD_DEFINITION_SIZE = struct.calcsize(FIELD_DEFINITION_FORMAT)
FIELD_DEFAULT_FORMAT = "<iii"
FIELD_DEFAULT_SIZE = struct.calcsize(FIELD_DEFAULT_FORMAT)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("metadata", type=Path, help="Path to global-metadata.dat")
    parser.add_argument("--out", required=True, type=Path, help="Output JSON path")
    parser.add_argument(
        "--namespace",
        action="append",
        dest="namespaces",
        help="Namespace prefix to include; repeat for multiple prefixes",
    )
    return parser.parse_args()


def parse_header(data: bytes) -> tuple[int, dict[str, tuple[int, int]]]:
    header_size = (2 + len(HEADER_PAIR_NAMES) * 2) * 4
    values = struct.unpack_from(f"<{2 + len(HEADER_PAIR_NAMES) * 2}I", data, 0)
    sanity, version = values[:2]
    if sanity != SANITY:
        raise ValueError(f"invalid IL2CPP metadata sanity: 0x{sanity:08x}")
    if version != SUPPORTED_VERSION:
        raise ValueError(f"unsupported IL2CPP metadata version: {version}")
    if values[2] != header_size:
        raise ValueError(f"unexpected v27 header size: {values[2]} (expected {header_size})")
    sections = {
        name: (values[2 + index * 2], values[3 + index * 2])
        for index, name in enumerate(HEADER_PAIR_NAMES)
    }
    return version, sections


def read_records(data: bytes, section: tuple[int, int], fmt: str) -> list[tuple[int, ...]]:
    offset, size = section
    record_size = struct.calcsize(fmt)
    if size % record_size:
        raise ValueError(f"section at {offset} has invalid size {size} for record size {record_size}")
    return [struct.unpack_from(fmt, data, cursor) for cursor in range(offset, offset + size, record_size)]


def build_string_reader(data: bytes, section: tuple[int, int]):
    offset, size = section
    end = offset + size

    def read_string(index: int) -> str:
        start = offset + index
        if start < offset or start >= end:
            raise ValueError(f"string index outside metadata heap: {index}")
        terminator = data.find(b"\0", start, end)
        if terminator < 0:
            raise ValueError(f"unterminated metadata string at index {index}")
        return data[start:terminator].decode("utf-8", errors="replace")

    return read_string


def field_number_defaults(data: bytes, sections: dict[str, tuple[int, int]]) -> dict[int, int]:
    values = read_records(data, sections["field_default_values"], FIELD_DEFAULT_FORMAT)
    data_offset, data_size = sections["default_value_data"]
    defaults: dict[int, int] = {}
    for field_index, _type_index, relative_index in values:
        if relative_index < 0 or relative_index + 4 > data_size:
            continue
        defaults[field_index] = struct.unpack_from("<i", data, data_offset + relative_index)[0]
    return defaults


def extract_models(data: bytes, namespaces: tuple[str, ...]) -> list[dict]:
    _version, sections = parse_header(data)
    read_string = build_string_reader(data, sections["string"])
    fields = read_records(data, sections["fields"], FIELD_DEFINITION_FORMAT)
    types = read_records(data, sections["type_definitions"], TYPE_DEFINITION_FORMAT)
    defaults = field_number_defaults(data, sections)
    models = []

    for type_index, type_definition in enumerate(types):
        type_name = read_string(type_definition[0])
        namespace = read_string(type_definition[1])
        if namespaces and not any(namespace.startswith(prefix) for prefix in namespaces):
            continue

        field_start = type_definition[8]
        field_count = type_definition[18]
        if not field_count or field_start >= len(fields):
            continue

        protobuf_fields = []
        type_field_end = min(field_start + field_count, len(fields))
        for field_index in range(field_start, type_field_end):
            field_name_index, field_type_index, field_token = fields[field_index]
            constant_name = read_string(field_name_index)
            if not constant_name.endswith("FieldNumber") or field_index not in defaults:
                continue

            logical_name = constant_name[: -len("FieldNumber")]
            backing_name = None
            backing_type_index = None
            for candidate_index in range(field_index + 1, min(field_index + 4, type_field_end)):
                candidate_name_index, candidate_type_index, _candidate_token = fields[candidate_index]
                candidate_name = read_string(candidate_name_index)
                if candidate_name.endswith("FieldNumber"):
                    break
                if candidate_name.startswith("_") and "codec" in candidate_name:
                    continue
                backing_name = candidate_name
                backing_type_index = candidate_type_index
                break

            protobuf_fields.append(
                {
                    "number": defaults[field_index],
                    "name": logical_name,
                    "constant": constant_name,
                    "constant_field_index": field_index,
                    "constant_type_index": field_type_index,
                    "constant_token": field_token,
                    "backing_field": backing_name,
                    "backing_type_index": backing_type_index,
                }
            )

        if not protobuf_fields:
            continue
        protobuf_fields.sort(key=lambda item: (item["number"], item["name"]))
        models.append(
            {
                "full_name": f"{namespace}.{type_name}" if namespace else type_name,
                "namespace": namespace,
                "type_name": type_name,
                "type_index": type_index,
                "fields": protobuf_fields,
            }
        )

    models.sort(key=lambda item: item["full_name"])
    return models


def main() -> None:
    args = parse_args()
    data = args.metadata.read_bytes()
    version, _sections = parse_header(data)
    namespaces = tuple(args.namespaces or ("Growing.Models.Data", "Growing.Services"))
    models = extract_models(data, namespaces)
    namespace_counts = Counter(model["namespace"] for model in models)
    output = {
        "schema_version": 1,
        "source": {
            "file": args.metadata.name,
            "sha256": hashlib.sha256(data).hexdigest(),
            "il2cpp_metadata_version": version,
        },
        "filters": {"namespace_prefixes": list(namespaces)},
        "meta": {
            "model_count": len(models),
            "field_count": sum(len(model["fields"]) for model in models),
            "namespace_counts": dict(sorted(namespace_counts.items())),
        },
        "models_by_full_name": {model["full_name"]: model for model in models},
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {args.out}: {len(models)} models, {output['meta']['field_count']} fields")


if __name__ == "__main__":
    main()
