"""Read live choreography and lip-sync TextAssets from authoritative RAW bundles."""

from __future__ import annotations

import hashlib
from pathlib import Path

import UnityPy


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def text_asset_payload(text_asset) -> bytes:
    payload = text_asset.m_Script
    return (
        payload
        if isinstance(payload, bytes)
        else payload.encode("utf-8", errors="surrogateescape")
    )


def load_raw_live_semantics(raw_asset_root: Path) -> dict[str, dict[str, dict]]:
    result: dict[str, dict[str, dict]] = {
        "choreography": {},
        "lipSync": {},
    }
    for bundle in sorted(raw_asset_root.glob("song_*.unity3d")):
        environment = UnityPy.load(str(bundle))
        bundle_hash = None
        for obj in environment.objects:
            if obj.type.name != "TextAsset":
                continue
            asset = obj.read()
            name = str(asset.m_Name)
            if "_live_effect" in name:
                domain = "choreography"
            elif name.endswith("_for_lipsync"):
                domain = "lipSync"
            else:
                continue
            payload = text_asset_payload(asset)
            previous = result[domain].get(name)
            if previous:
                if previous["payload"] != payload:
                    raise ValueError(f"Conflicting RAW TextAsset payloads for {name}")
                previous["bundles"].append(bundle.name)
                continue
            if bundle_hash is None:
                bundle_hash = sha256_file(bundle)
            result[domain][name] = {
                "name": name,
                "payload": payload,
                "bytes": len(payload),
                "sha256": hashlib.sha256(payload).hexdigest(),
                "bundles": [bundle.name],
                "bundleSha256": bundle_hash,
            }
    return result
