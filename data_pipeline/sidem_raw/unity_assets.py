"""Unity TextAsset transport; UnityPy loads only when a bundle is opened."""
from pathlib import Path
from typing import Any


def text_asset_bytes(data: Any) -> bytes:
    script = data.m_Script
    return script.encode("utf-8") if isinstance(script, str) else bytes(script)


def extract_text_asset_records(bundle: Path, *, load_bundle=None) -> list[dict[str, Any]]:
    """Return TextAssets with the Unity container path that gives them identity."""
    if load_bundle is None:
        import UnityPy
        load_bundle = UnityPy.load
    environment = load_bundle(str(bundle))
    records = []
    for container_path, obj in environment.container.items():
        if obj.type.name != "TextAsset":
            continue
        data = obj.read()
        records.append(
            {
                "name": str(data.m_Name),
                "payload": text_asset_bytes(data),
                "container_path": str(container_path).replace("\\", "/"),
                "path_id": obj.path_id,
            }
        )
    return sorted(
        records,
        key=lambda record: (
            record["container_path"],
            record["name"],
            record["path_id"],
        ),
    )


def extract_text_assets(bundle: Path) -> list[tuple[str, bytes]]:
    """Compatibility wrapper for extractors that do not need container identity."""
    return [
        (str(record["name"]), bytes(record["payload"]))
        for record in extract_text_asset_records(bundle)
    ]


