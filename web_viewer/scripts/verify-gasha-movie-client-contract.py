#!/usr/bin/env python3
"""Verify the committed gasha movie client contract, optionally against metadata."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
CONTRACT_PATH = (
    PROJECT_ROOT / "public" / "data" / "client" / "gasha_movie_contract.json"
)
GENERATOR_PATH = PROJECT_ROOT / "scripts" / "generate-gasha-movie-client-contract.py"
DEFAULT_METADATA = (
    PROJECT_ROOT / ".analysis" / "sidem_ios_keyfiles" / "global-metadata.dat"
)
CARD_VARIANTS = {
    1: ("r", "sr", "ssr"),
    2: ("r", "sr", "ssr"),
    3: ("r", "r_ssr", "sr", "sr_ssr", "ssr"),
}


def fail(message: str) -> None:
    raise SystemExit(f"Gasha movie client contract verification failed: {message}")


def expected_resources() -> list[dict]:
    resources = [
        {
            "id": f"c0{probability_key}_{rarity_key}",
            "filename": f"c0{probability_key}_{rarity_key}.usm",
            "role": "start-movie",
            "format_arguments": [probability_key, rarity_key],
        }
        for probability_key, rarity_keys in CARD_VARIANTS.items()
        for rarity_key in rarity_keys
    ]
    resources.append(
        {
            "id": "ssr_motion",
            "filename": "ssr_motion.usm",
            "role": "ssr-movie",
            "format_arguments": None,
        }
    )
    return sorted(resources, key=lambda item: item["id"])


def verify_shape(contract: dict) -> None:
    if contract.get("schema_version") != 1:
        fail("schema_version must be 1")
    meta = contract.get("meta") or {}
    if (
        meta.get("source_kind") != "il2cpp-global-metadata-v27"
        or meta.get("source_sha256")
        != "658f966af11aef965b541e093889056cafa61a7f7fcd4bbf38e1ca2eab6d6e00"
        or meta.get("source_bytes") != 12431328
        or meta.get("resource_count") != 12
        or meta.get("start_movie_count") != 11
        or meta.get("ssr_movie_count") != 1
    ):
        fail("metadata identity or resource summary drifted")
    consumer = contract.get("consumer") or {}
    if (
        consumer.get("namespace") != "Growing.Theater"
        or consumer.get("class") != "GashaAnimationMovieManager"
        or consumer.get("type_token") != "0x02000fcd"
    ):
        fail("consumer class drifted")
    fields = consumer.get("fields") or []
    if fields != [
        {"name": "_startMovieList", "token": "0x040041e2"},
        {"name": "_ssrMovie", "token": "0x040041e3"},
    ]:
        fail("consumer field evidence drifted")
    expected_methods = {
        "Setup": ["endMovieAction", "mostRarity", "showSpeechAction"],
        "CreateAnimation": ["mostRarity"],
        "GetProbabilityKey": ["dictionary"],
        "StartAnimePlay": ["_currentStartMovieOrder"],
        "SsrAnimePlay": ["showSsrCount"],
    }
    methods = consumer.get("methods") or []
    expected_method_tokens = {
        "Setup": "0x0600549d",
        "CreateAnimation": "0x0600549e",
        "GetProbabilityKey": "0x0600549f",
        "StartAnimePlay": "0x060054a0",
        "SsrAnimePlay": "0x060054a1",
    }
    if (
        {
            method.get("name"): method.get("parameters") for method in methods
        }
        != expected_methods
        or {
            method.get("name"): method.get("token") for method in methods
        }
        != expected_method_tokens
    ):
        fail("consumer method evidence drifted")
    movie_class = consumer.get("movie_class") or {}
    if (
        movie_class.get("namespace") != "Growing.Theater"
        or movie_class.get("class") != "GashaAnimationMovie"
        or movie_class.get("type_token") != "0x02000fcb"
        or (movie_class.get("setup_method") or {}).get("token") != "0x06005493"
        or (movie_class.get("setup_method") or {}).get("parameters")
        != ["filePath", "trimEndSeconds", "controllType"]
    ):
        fail("movie Setup(filePath, ...) evidence drifted")
    filename_contract = contract.get("filename_contract") or {}
    if (
        filename_contract.get("start_movie_template") != "c0{0}_{1}.usm"
        or filename_contract.get("fixed_ssr_movie") != "ssr_motion.usm"
    ):
        fail("filename contract drifted")
    literals = filename_contract.get("literals") or []
    if literals != [
        {"value": "c0{0}_{1}.usm", "literal_index": 13444},
        {"value": "r", "literal_index": 16767},
        {"value": "r_ssr", "literal_index": 16771},
        {"value": "sr", "literal_index": 17212},
        {"value": "sr_ssr", "literal_index": 17219},
        {"value": "ssr", "literal_index": 17223},
        {"value": "ssr_motion.usm", "literal_index": 17225},
    ]:
        fail("literal evidence drifted")
    if contract.get("resources") != expected_resources():
        fail("resource population drifted")
    if len(contract.get("evidence") or []) != 5:
        fail("evidence chain must retain five independent statements")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-only", action="store_true")
    parser.add_argument("--metadata", type=Path, default=DEFAULT_METADATA)
    args = parser.parse_args()

    contract = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
    verify_shape(contract)
    if not args.source_only:
        if not args.metadata.is_file():
            fail(f"mounted metadata is unavailable: {args.metadata}")
        with tempfile.TemporaryDirectory() as temp_dir:
            regenerated = Path(temp_dir) / "gasha_movie_contract.json"
            result = subprocess.run(
                [
                    sys.executable,
                    str(GENERATOR_PATH),
                    "--metadata",
                    str(args.metadata),
                    "--output",
                    str(regenerated),
                ],
                cwd=PROJECT_ROOT,
            )
            if result.returncode:
                fail("metadata regeneration failed")
            actual = json.loads(regenerated.read_text(encoding="utf-8"))
            if actual != contract:
                fail("committed contract differs from mounted metadata and RAW population")
    print(
        "Gasha movie client contract verified "
        f"({'source-only' if args.source_only else 'mounted'}): "
        "12 resources / 11 start movies / 1 SSR movie"
    )


if __name__ == "__main__":
    main()
