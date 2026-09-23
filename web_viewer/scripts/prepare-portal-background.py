"""Export the one user-selected mobile background; no other bundle is scanned."""
import argparse
import hashlib
import json
import sys
from pathlib import Path

import UnityPy

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / "data_pipeline"))
from archive_paths import add_sources_config_argument, load_archive_sources


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    add_sources_config_argument(parser)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    sources = load_archive_sources(args.sources_config)
    bundle = sources.raw_root / "asset" / "image_mobile_backgrounds.unity3d"
    digest = hashlib.sha256(bundle.read_bytes()).hexdigest()
    if digest != "b9339c86689ad01a3c55a02b2ce6b0391562063f621dd02ff5530d4aa9ed4630":
        raise ValueError("Bundle differs from the reviewed image relation catalog")
    candidates = [obj for obj in UnityPy.load(str(bundle)).objects
                  if obj.type.name == "Texture2D" and obj.path_id == 3188813407174735134]
    if len(candidates) != 1:
        raise ValueError("Expected exactly one catalogued Texture2D")
    texture = candidates[0].read()
    if texture.m_Name != "image_mobile_background_common":
        raise ValueError("Texture name differs from the reviewed container")
    image = texture.image.convert("RGBA")
    if image.size != (688, 736):
        raise ValueError("Unexpected texture dimensions")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    image.save(args.output)
    print(json.dumps({"bundle_sha256": digest, "path_id": str(candidates[0].path_id),
                      "size": image.size, "rgba_sha256": hashlib.sha256(image.tobytes()).hexdigest(),
                      "png_sha256": hashlib.sha256(args.output.read_bytes()).hexdigest()}))


if __name__ == "__main__":
    main()
