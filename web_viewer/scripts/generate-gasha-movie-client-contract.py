#!/usr/bin/env python3
"""Extract the exact gasha USM filename contract from IL2CPP metadata v27."""

from __future__ import annotations

import argparse
import hashlib
import json
import struct
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_PIPELINE_ROOT = PROJECT_ROOT.parent / "data_pipeline"
sys.path.insert(0, str(DATA_PIPELINE_ROOT))

from archive_paths import add_sources_config_argument, load_archive_sources


DEFAULT_METADATA = (
    PROJECT_ROOT / ".analysis" / "sidem_ios_keyfiles" / "global-metadata.dat"
)
DEFAULT_OUTPUT = (
    PROJECT_ROOT / "public" / "data" / "client" / "gasha_movie_contract.json"
)
HEADER_KEYS = [
    "sanity",
    "version",
    "stringLiteralOffset",
    "stringLiteralSize",
    "stringLiteralDataOffset",
    "stringLiteralDataSize",
    "stringOffset",
    "stringSize",
    "eventsOffset",
    "eventsSize",
    "propertiesOffset",
    "propertiesSize",
    "methodsOffset",
    "methodsSize",
    "parameterDefaultValuesOffset",
    "parameterDefaultValuesSize",
    "fieldDefaultValuesOffset",
    "fieldDefaultValuesSize",
    "fieldAndParameterDefaultValueDataOffset",
    "fieldAndParameterDefaultValueDataSize",
    "fieldMarshaledSizesOffset",
    "fieldMarshaledSizesSize",
    "parametersOffset",
    "parametersSize",
    "fieldsOffset",
    "fieldsSize",
    "genericParametersOffset",
    "genericParametersSize",
    "genericParameterConstraintsOffset",
    "genericParameterConstraintsSize",
    "genericContainersOffset",
    "genericContainersSize",
    "nestedTypesOffset",
    "nestedTypesSize",
    "interfacesOffset",
    "interfacesSize",
    "vtableMethodsOffset",
    "vtableMethodsSize",
    "interfaceOffsetsOffset",
    "interfaceOffsetsSize",
    "typeDefinitionsOffset",
    "typeDefinitionsSize",
    "imagesOffset",
    "imagesSize",
    "assembliesOffset",
    "assembliesSize",
    "fieldRefsOffset",
    "fieldRefsSize",
    "referencedAssembliesOffset",
    "referencedAssembliesSize",
    "attributesInfoOffset",
    "attributesInfoCount",
    "attributeTypesOffset",
    "attributeTypesCount",
    "unresolvedVirtualCallParameterTypesOffset",
    "unresolvedVirtualCallParameterTypesSize",
    "unresolvedVirtualCallParameterRangesOffset",
    "unresolvedVirtualCallParameterRangesSize",
    "windowsRuntimeTypeNamesOffset",
    "windowsRuntimeTypeNamesSize",
    "windowsRuntimeStringsOffset",
    "windowsRuntimeStringsSize",
    "exportedTypeDefinitionsOffset",
    "exportedTypeDefinitionsSize",
]
CARD_VARIANTS = {
    1: ("r", "sr", "ssr"),
    2: ("r", "sr", "ssr"),
    3: ("r", "r_ssr", "sr", "sr_ssr", "ssr"),
}


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def token(value: int) -> str:
    return f"0x{value:08x}"


class MetadataV27:
    TYPE_DEFINITION_SIZE = 88
    METHOD_DEFINITION_SIZE = 32
    FIELD_DEFINITION_SIZE = 12
    PARAMETER_DEFINITION_SIZE = 12

    def __init__(self, data: bytes) -> None:
        self.data = data
        values = struct.unpack_from("<64I", data, 0)
        self.header = dict(zip(HEADER_KEYS, values, strict=True))
        if self.header["sanity"] != 0xFAB11BAF:
            raise ValueError("not an IL2CPP global metadata file")
        if self.header["version"] != 27:
            raise ValueError(
                f"expected IL2CPP metadata v27, got {self.header['version']}"
            )
        self.types = self._records(
            "typeDefinitions", self.TYPE_DEFINITION_SIZE, "<16i8H2I"
        )
        self.methods = self._records(
            "methods", self.METHOD_DEFINITION_SIZE, "<5iI4H"
        )
        self.fields = self._records(
            "fields", self.FIELD_DEFINITION_SIZE, "<IiI"
        )
        self.parameters = self._records(
            "parameters", self.PARAMETER_DEFINITION_SIZE, "<IIi"
        )
        self.literals = self._read_literals()

    def _records(self, name: str, size: int, fmt: str) -> list[tuple]:
        offset = self.header[f"{name}Offset"]
        byte_size = self.header[f"{name}Size"]
        if byte_size % size:
            raise ValueError(f"{name} byte size is not divisible by {size}")
        return [
            struct.unpack_from(fmt, self.data, offset + index * size)
            for index in range(byte_size // size)
        ]

    def string(self, index: int) -> str:
        start = self.header["stringOffset"] + index
        limit = self.header["stringOffset"] + self.header["stringSize"]
        end = self.data.find(b"\0", start, limit)
        if end < 0:
            raise ValueError(f"unterminated metadata string at {index}")
        return self.data[start:end].decode("utf-8")

    def _read_literals(self) -> list[str]:
        offset = self.header["stringLiteralOffset"]
        size = self.header["stringLiteralSize"]
        data_offset = self.header["stringLiteralDataOffset"]
        literals = []
        for index in range(size // 8):
            length, relative = struct.unpack_from("<II", self.data, offset + index * 8)
            start = data_offset + relative
            literals.append(self.data[start : start + length].decode("utf-8"))
        return literals

    def literal_index(self, value: str) -> int:
        matches = [index for index, item in enumerate(self.literals) if item == value]
        if len(matches) != 1:
            raise ValueError(f"expected one literal {value!r}, found {len(matches)}")
        return matches[0]

    def type(self, namespace: str, name: str) -> tuple[int, tuple]:
        matches = [
            (index, record)
            for index, record in enumerate(self.types)
            if self.string(record[0]) == name and self.string(record[1]) == namespace
        ]
        if len(matches) != 1:
            raise ValueError(
                f"expected one type {namespace}.{name}, found {len(matches)}"
            )
        return matches[0]

    def describe_type(self, namespace: str, name: str) -> dict:
        index, record = self.type(namespace, name)
        field_start, method_start = record[8], record[9]
        method_count, field_count = record[16], record[18]
        fields = {
            self.string(self.fields[field_index][0]): {
                "name": self.string(self.fields[field_index][0]),
                "token": token(self.fields[field_index][2]),
            }
            for field_index in range(field_start, field_start + field_count)
        }
        methods: dict[str, list[dict]] = {}
        for method_index in range(method_start, method_start + method_count):
            method = self.methods[method_index]
            parameter_names = [
                self.string(self.parameters[param_index][0])
                for param_index in range(
                    method[3], method[3] + method[9]
                )
            ]
            methods.setdefault(self.string(method[0]), []).append(
                {
                    "name": self.string(method[0]),
                    "token": token(method[5]),
                    "parameters": parameter_names,
                }
            )
        return {
            "metadata_index": index,
            "namespace": namespace,
            "name": name,
            "token": token(record[25]),
            "fields": fields,
            "methods": methods,
        }


def require_member(container: dict, name: str, parameters: list[str] | None = None) -> dict:
    value = container.get(name)
    if value is None:
        raise ValueError(f"missing metadata member {name}")
    if isinstance(value, list):
        matches = [
            item
            for item in value
            if parameters is None or item["parameters"] == parameters
        ]
        if len(matches) != 1:
            raise ValueError(
                f"expected one method {name}{parameters or ''}, found {len(matches)}"
            )
        return matches[0]
    return value


def build_contract(metadata_path: Path, raw_movie_root: Path) -> dict:
    data = metadata_path.read_bytes()
    metadata = MetadataV27(data)
    manager = metadata.describe_type(
        "Growing.Theater", "GashaAnimationMovieManager"
    )
    movie = metadata.describe_type("Growing.Theater", "GashaAnimationMovie")

    fields = [
        require_member(manager["fields"], "_startMovieList"),
        require_member(manager["fields"], "_ssrMovie"),
    ]
    methods = [
        require_member(
            manager["methods"],
            "Setup",
            ["endMovieAction", "mostRarity", "showSpeechAction"],
        ),
        require_member(manager["methods"], "CreateAnimation", ["mostRarity"]),
        require_member(manager["methods"], "GetProbabilityKey", ["dictionary"]),
        require_member(manager["methods"], "StartAnimePlay", ["_currentStartMovieOrder"]),
        require_member(manager["methods"], "SsrAnimePlay", ["showSsrCount"]),
    ]
    movie_setup = require_member(
        movie["methods"],
        "Setup",
        ["filePath", "trimEndSeconds", "controllType"],
    )
    literal_values = [
        "c0{0}_{1}.usm",
        "r",
        "r_ssr",
        "sr",
        "sr_ssr",
        "ssr",
        "ssr_motion.usm",
    ]
    literals = [
        {"value": value, "literal_index": metadata.literal_index(value)}
        for value in literal_values
    ]

    resources = []
    for probability_key, rarity_keys in CARD_VARIANTS.items():
        for rarity_key in rarity_keys:
            resource_id = f"c0{probability_key}_{rarity_key}"
            resources.append(
                {
                    "id": resource_id,
                    "filename": f"{resource_id}.usm",
                    "role": "start-movie",
                    "format_arguments": [probability_key, rarity_key],
                }
            )
    resources.append(
        {
            "id": "ssr_motion",
            "filename": "ssr_motion.usm",
            "role": "ssr-movie",
            "format_arguments": None,
        }
    )
    resources.sort(key=lambda item: item["id"])

    actual = {
        path.name
        for path in raw_movie_root.glob("*.usm")
        if path.stem == "ssr_motion" or path.stem.startswith("c0")
    }
    expected = {resource["filename"] for resource in resources}
    if actual != expected:
        raise ValueError(
            "gasha client contract and RAW movie population differ: "
            f"missing={sorted(expected - actual)}, extra={sorted(actual - expected)}"
        )

    return {
        "schema_version": 1,
        "meta": {
            "source_kind": "il2cpp-global-metadata-v27",
            "source_sha256": sha256_bytes(data),
            "source_bytes": len(data),
            "resource_count": len(resources),
            "start_movie_count": len(resources) - 1,
            "ssr_movie_count": 1,
        },
        "consumer": {
            "namespace": manager["namespace"],
            "class": manager["name"],
            "type_token": manager["token"],
            "fields": fields,
            "methods": methods,
            "movie_class": {
                "namespace": movie["namespace"],
                "class": movie["name"],
                "type_token": movie["token"],
                "setup_method": movie_setup,
            },
        },
        "filename_contract": {
            "start_movie_template": "c0{0}_{1}.usm",
            "fixed_ssr_movie": "ssr_motion.usm",
            "literals": literals,
        },
        "resources": resources,
        "evidence": [
            "GashaAnimationMovie.Setup accepts filePath and movie playback controls.",
            "GashaAnimationMovieManager constructs animations from mostRarity and a probability-key dictionary.",
            "The manager has distinct _startMovieList and _ssrMovie fields plus StartAnimePlay and SsrAnimePlay methods.",
            "The IL2CPP literal table contains the exact start-movie format and fixed SSR movie filename.",
            "The complete RAW c0*/ssr_motion population is exactly the set generated by this client filename contract.",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    add_sources_config_argument(parser)
    parser.add_argument("--metadata", type=Path, default=DEFAULT_METADATA)
    parser.add_argument("--raw-movie-root", type=Path)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    sources = load_archive_sources(args.sources_config)
    raw_movie_root = (
        args.raw_movie_root.resolve()
        if args.raw_movie_root
        else (sources.raw_root / "movie").resolve()
    )
    payload = build_contract(args.metadata.resolve(), raw_movie_root)
    output = args.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    print(
        "Gasha movie client contract written: "
        f"{payload['meta']['resource_count']} resources / "
        f"{payload['meta']['start_movie_count']} start movies / "
        f"{payload['meta']['ssr_movie_count']} SSR movie"
    )


if __name__ == "__main__":
    main()
