#!/usr/bin/env python3
"""Read indexed RAW prefabs without publishing textures or changing the player."""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import sys

import UnityPy

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT.parent / "data_pipeline"))
from archive_paths import add_sources_config_argument, load_archive_sources

DEFAULT_ASSETS = (
    "fx_in_drvalv_panel", "fx_in_tfmvmt_Incidentlight",
    "fx_in_anwhre_window_1", "fx_in_anwhre_window_2", "fx_in_brndnf_ring",
)
RENDER_MODES = {0: "billboard", 1: "stretch", 2: "horizontal_billboard",
                3: "vertical_billboard", 4: "mesh", 5: "none"}


def file_hash(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def json_hash(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"),
                                    ensure_ascii=False, allow_nan=False).encode()).hexdigest()


def pointer(value):
    return {"fileId": int(value.get("m_FileID", 0)),
            "pathId": str(value.get("m_PathID", 0))}


def local_object(owner, value, expected=None):
    ref = pointer(value)
    if ref["fileId"] or ref["pathId"] == "0":
        return None
    obj = owner.assets_file.objects.get(int(ref["pathId"]))
    if obj and (expected is None or obj.type.name == expected):
        return obj
    return None


def source_ref(obj):
    return {"serializedFile": obj.assets_file.name, "pathId": str(obj.path_id),
            "type": obj.type.name}


def reference(owner, value, expected=None, dependencies=None):
    ref = pointer(value)
    if ref["fileId"]:
        externals = owner.assets_file.externals
        if 0 < ref["fileId"] <= len(externals):
            external = externals[ref["fileId"] - 1]
            ref["externalPath"] = external.path
            ref["externalGuid"] = bytes(external.guid).hex()
    obj = local_object(owner, value, expected)
    dependency_resolved = False
    if not obj and ref.get("externalPath"):
        serialized_name = ref["externalPath"].rsplit("/", 1)[-1]
        external_file = (dependencies or {}).get(serialized_name)
        candidate = external_file.objects.get(int(ref["pathId"])) if external_file else None
        if candidate and (expected is None or candidate.type.name == expected):
            obj, dependency_resolved = candidate, True
    if obj:
        tree = obj.read_typetree()
        name = tree.get("m_Name") or tree.get("m_ParsedForm", {}).get("m_Name")
        return {**ref, "status": "resolved_dependency" if dependency_resolved else "resolved_in_bundle", "name": name,
                **source_ref(obj)}
    return {**ref, "status": "null" if ref["pathId"] == "0" else
            ("external_unresolved" if ref["fileId"] else "missing_or_wrong_type")}


def transform_chain(go):
    result, seen = [], set()
    tree = go.read_typetree()
    current = next((local_object(go, row["component"], "Transform")
                    for row in tree["m_Component"]
                    if local_object(go, row["component"], "Transform")), None)
    while current:
        identity = (current.assets_file.name, current.path_id)
        if identity in seen:
            raise ValueError("Cycle in RAW Transform parents")
        seen.add(identity)
        t = current.read_typetree()
        result.append({**source_ref(current), "position": t["m_LocalPosition"],
                       "rotation": t["m_LocalRotation"], "scale": t["m_LocalScale"],
                       "parent": pointer(t["m_Father"])})
        parent = t["m_Father"]
        if int(parent.get("m_FileID", 0)):
            result.append({"unresolvedParent": pointer(parent)})
            break
        current = local_object(current, parent, "Transform")
    return result


def material_record(owner, value, dependencies=None):
    result = reference(owner, value, "Material")
    material = local_object(owner, value, "Material")
    if not material:
        return result
    t = material.read_typetree()
    props = t.get("m_SavedProperties", {})
    result.update({"shader": reference(material, t["m_Shader"], "Shader", dependencies),
                   "keywords": t.get("m_ShaderKeywords"),
                   "customRenderQueue": t.get("m_CustomRenderQueue"),
                   "floats": dict(props.get("m_Floats", [])),
                   "colors": dict(props.get("m_Colors", [])), "textures": []})
    for name, env in props.get("m_TexEnvs", []):
        tex = local_object(material, env["m_Texture"], "Texture2D")
        metadata = reference(material, env["m_Texture"], "Texture2D")
        if tex:
            data = tex.read()
            metadata.update({"width": data.m_Width, "height": data.m_Height,
                             "format": data.m_TextureFormat})
        result["textures"].append({"property": name, "scale": env["m_Scale"],
                                   "offset": env["m_Offset"], **metadata})
    return result


def module_summary(module):
    curves = []
    def visit(value, path):
        if isinstance(value, dict):
            if "minMaxState" in value:
                curves.append({"parameter": path, "mode": value["minMaxState"],
                               "scalar": value.get("scalar"), "minScalar": value.get("minScalar"),
                               "maxKeys": len(value.get("maxCurve", {}).get("m_Curve", [])),
                               "minKeys": len(value.get("minCurve", {}).get("m_Curve", []))})
            for key, item in value.items():
                visit(item, f"{path}.{key}" if path else key)
        elif isinstance(value, list):
            for index, item in enumerate(value):
                visit(item, f"{path}[{index}]")
    visit(module, "")
    return {"enabled": module["enabled"], "parametersSha256": json_hash(module),
            "scalars": {k: v for k, v in module.items() if not isinstance(v, (dict, list))},
            "curves": curves}


def particle_record(owner, value, include_module_data=False, dependencies=None):
    particle = local_object(owner, value, "ParticleSystem")
    if not particle:
        return reference(owner, value, "ParticleSystem")
    t = particle.read_typetree()
    go = local_object(particle, t["m_GameObject"], "GameObject")
    if not go:
        raise ValueError(f"Particle {particle.path_id} has no local GameObject")
    go_tree = go.read_typetree()
    renderers = [local_object(go, row["component"], "ParticleSystemRenderer")
                 for row in go_tree["m_Component"]]
    renderers = [item for item in renderers if item]
    if len(renderers) != 1:
        raise ValueError(f"Particle {particle.path_id} has {len(renderers)} renderers")
    renderer = renderers[0]
    r = renderer.read_typetree()
    modules = {key: value for key, value in t.items()
               if isinstance(value, dict) and "enabled" in value}
    return {**source_ref(particle), "status": "resolved_in_bundle",
            "name": go_tree["m_Name"], "gameObjectActive": go_tree.get("m_IsActive"),
            "transformChain": transform_chain(go),
            "main": {key: value for key, value in t.items() if key not in modules
                     and key != "m_GameObject"},
            "enabledModules": [key for key, value in modules.items() if value["enabled"]],
            "modules": {key: value if include_module_data else module_summary(value)
                        for key, value in modules.items() if value["enabled"]},
            "parameterTreeSha256": json_hash(t),
            "renderer": {**source_ref(renderer), "enabled": r["m_Enabled"],
                         "renderMode": r["m_RenderMode"],
                         "renderModeName": RENDER_MODES.get(r["m_RenderMode"], "unknown"),
                         "alignment": r["m_RenderAlignment"], "pivot": r["m_Pivot"],
                         "sortingOrder": r["m_SortingOrder"],
                         "sortingLayerId": r["m_SortingLayerID"],
                         "materials": [material_record(renderer, ptr, dependencies) for ptr in r["m_Materials"]
                                       if int(ptr.get("m_PathID", 0))],
                         # A mesh pointer is not a missing dependency in billboard mode.
                         "mesh": reference(renderer, r["m_Mesh"], "Mesh")}}


def inspect_asset(environment, asset, entry, include_module_data=False, dependencies=None):
    found = []
    for obj in environment.objects:
        if obj.type.name != "MonoBehaviour":
            continue
        t = obj.read_typetree()
        if "_particles" not in t:
            continue
        go = local_object(obj, t.get("m_GameObject", {}), "GameObject")
        if go and go.read_typetree()["m_Name"].casefold() == f"liveobjectobjectlayer_{asset}".casefold():
            found.append((obj, t, go))
    if len(found) != 1:
        raise ValueError(f"{asset}: expected one exact keeper, found {len(found)}")
    keeper, t, go = found[0]
    particles = [particle_record(keeper, ptr, include_module_data, dependencies) for ptr in t["_particles"]
                 if int(ptr.get("m_PathID", 0))]
    if len(particles) != int(entry["particleCount"]):
        raise ValueError(f"{asset}: RAW/index particle count mismatch")
    return {"asset": asset, "bundle": entry["bundle"], "kind": entry["kind"],
            "keeper": source_ref(keeper), "rootTransformChain": transform_chain(go),
            "keepOriginalOrder": t.get("_keepOriginalOrder"),
            "spriteReferences": [reference(keeper, ptr, "SpriteRenderer") for ptr in t.get("_sprites", [])],
            "groupReferences": [reference(keeper, ptr) for ptr in t.get("_groups", [])],
            "particles": particles, "status": "source_extracted_runtime_unimplemented"}


def stringify_path_ids(value):
    """JSON consumers must not round 64-bit Unity identities through JS Number."""
    if isinstance(value, dict):
        return {key: str(item) if key == "m_PathID" else stringify_path_ids(item)
                for key, item in value.items()}
    if isinstance(value, list):
        return [stringify_path_ids(item) for item in value]
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    add_sources_config_argument(parser)
    parser.add_argument("--asset", action="append", default=[])
    parser.add_argument("--all-indexed-particles", action="store_true",
                        help="Inspect only the exact bundle names in the existing object index.")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--include-module-data", action="store_true",
                        help="Include full enabled-module curves for a selected implementation sample.")
    parser.add_argument("--dependency", action="append", default=[],
                        help="Explicit RAW bundle basename; resolve external references only by exact CAB and PathID.")
    args = parser.parse_args()
    if args.asset and args.all_indexed_particles:
        parser.error("Choose --asset or --all-indexed-particles")
    sources = load_archive_sources(args.sources_config)
    raw_root = (sources.raw_root / "asset").resolve()
    output = args.output.resolve()
    if output.is_relative_to(sources.raw_root.resolve()) or output.is_relative_to(sources.publish_root.resolve()):
        parser.error("Audit output must be outside RAW and published assets")
    index_path = sources.published_path("assets/live-chibi/object-layers/index.json")
    index = json.loads(index_path.read_text(encoding="utf-8"))
    assets = index["assets"]
    selected = sorted(key for key, value in assets.items() if value["particleCount"]) if args.all_indexed_particles else list(dict.fromkeys(args.asset or DEFAULT_ASSETS))
    if any(key not in assets for key in selected):
        parser.error("Unknown asset; use exact published object index identities")
    records, bundle_records, dependency_records = [], [], []
    dependencies = {}
    for name in sorted(set(args.dependency)):
        path = (raw_root / name).resolve()
        if path.parent != raw_root or path.suffix != ".unity3d":
            raise ValueError(f"Unsafe dependency bundle path: {name}")
        environment = UnityPy.load(str(path))
        files = {obj.assets_file.name: obj.assets_file for obj in environment.objects}
        if dependencies.keys() & files.keys():
            raise ValueError("Ambiguous dependency serialized-file identity")
        dependencies.update(files)
        dependency_records.append({"name": name, "bytes": path.stat().st_size,
                                   "sha256": file_hash(path), "serializedFiles": sorted(files)})
    by_bundle = {}
    for key in selected:
        bundle = assets[key]["bundle"]
        path = (raw_root / bundle).resolve()
        if path.parent != raw_root or path.suffix != ".unity3d":
            raise ValueError(f"Unsafe indexed bundle path: {bundle}")
        by_bundle.setdefault(bundle, []).append(key)
    for bundle, keys in sorted(by_bundle.items()):
        path = raw_root / bundle
        environment = UnityPy.load(str(path))
        bundle_records.append({"name": bundle, "bytes": path.stat().st_size, "sha256": file_hash(path)})
        records.extend(inspect_asset(environment, key, assets[key], args.include_module_data, dependencies) for key in keys)
        print(f"Read {bundle}: {len(keys)} exact indexed objects", flush=True)
    systems = [p for record in records for p in record["particles"]]
    resolved = [p for p in systems if p["status"] == "resolved_in_bundle"]
    report = {"schemaVersion": 1, "status": "raw_inventory_not_visual_acceptance",
              "includesModuleData": args.include_module_data,
              "unityPyVersion": UnityPy.__version__,
              "objectIndexSha256": file_hash(index_path), "indexedStats": index["stats"],
              "indexedMissing": index["missing"], "bundles": bundle_records,
              "dependencies": dependency_records,
              "stats": {"objects": len(records), "particleReferences": len(systems),
                        "resolvedParticleSystems": len(resolved),
                        "renderModes": dict(Counter(p["renderer"]["renderModeName"] for p in resolved)),
                        "enabledModules": dict(Counter(k for p in resolved for k in p["enabledModules"]))},
              "objects": records}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(stringify_path_ids(report), ensure_ascii=False, separators=(",", ":"),
                                 allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps(report["stats"], ensure_ascii=False))


if __name__ == "__main__":
    main()
