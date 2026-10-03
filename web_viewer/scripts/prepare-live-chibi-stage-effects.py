#!/usr/bin/env python3
"""Extract built-in live-stage mask and laser textures from the local XAPK."""

from __future__ import annotations

import argparse
import hashlib
import io
import importlib.util
import json
import sys
import zipfile
from pathlib import Path

import UnityPy
from live_chibi_spotlight import spotlight_sprite_model, spotlight_background_model
from live_chibi_pinspotlight import pinspotlight_sprite_model
from live_chibi_stagelight import NAMES as STAGELIGHT_NAMES, TEXTURES as STAGELIGHT_TEXTURES, stagelight_model, stagelight_events
from live_chibi_suspensionlight import ASSET as SUSPENSION_ASSET, suspensionlight_model, suspensionlight_events
from live_chibi_laser import extract_laser_model
from live_chibi_spotbeam import extract_spotbeam_model
from live_chibi_character_shadow import extract_character_shadow
from live_chibi_raw_semantics import text_asset_payload, sha256_file


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_PIPELINE_ROOT = PROJECT_ROOT.parent / "data_pipeline"
sys.path.insert(0, str(DATA_PIPELINE_ROOT))

from archive_paths import add_sources_config_argument, load_archive_sources


DEFAULT_OUTPUT_ROOT = PROJECT_ROOT / "public" / "assets" / "live-chibi" / "stage-effects"


def find_xapk(explicit: Path | None, configured: Path | None) -> Path:
    path = (explicit or configured)
    if path is None:
        raise ValueError("xapk_file or --xapk is required for stage effects")
    resolved = path.resolve()
    if not resolved.is_file():
        raise FileNotFoundError(f"XAPK not found: {resolved}")
    return resolved


def read_unity_data(xapk: Path) -> bytes:
    with zipfile.ZipFile(xapk) as archive:
        apk_names = [
            name for name in archive.namelist()
            if name.endswith(".apk") and not Path(name).name.startswith("config.")
        ]
        if not apk_names:
            raise RuntimeError(f"Main APK missing from {xapk.name}")
        apk_bytes = archive.read(apk_names[0])
    with zipfile.ZipFile(io.BytesIO(apk_bytes)) as apk:
        data_name = "assets/bin/Data/data.unity3d"
        if data_name not in apk.namelist():
            raise RuntimeError(f"{data_name} missing from {apk_names[0]}")
        return apk.read(data_name)


def is_stage_effect_texture(name: str) -> bool:
    lowered = name.lower()
    return name == 'fx_in_ntalon_spotlight' or name == SUSPENSION_ASSET or name in STAGELIGHT_TEXTURES or '_stagelight' in lowered or lowered in {"tex_chara_shadow_2", "laserlight_1", "laserlight_2", "laserlight_3", "spotlight1", "spotlight2"} or (
        "pinspotlight" in lowered
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    add_sources_config_argument(parser)
    parser.add_argument("--xapk", type=Path)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    args = parser.parse_args()

    sources = load_archive_sources(args.sources_config)
    xapk = find_xapk(args.xapk, sources.xapk_file)
    output_root = args.output_root.resolve()
    unity_data = read_unity_data(xapk)
    environment = UnityPy.load(unity_data)
    output_root.mkdir(parents=True, exist_ok=True)
    assets: dict[str, dict] = {}
    for obj in environment.objects:
        if obj.type.name != "Texture2D":
            continue
        texture = obj.read()
        if not is_stage_effect_texture(texture.m_Name):
            continue
        image = texture.image.convert("RGBA")
        filename = f"{texture.m_Name}.png"
        target = output_root / filename
        temporary = target.with_name(f"{target.stem}.tmp{target.suffix}")
        temporary.unlink(missing_ok=True)
        image.save(temporary, format="PNG", optimize=True)
        temporary.replace(target)
        assets[texture.m_Name] = {
            "file": f"stage-effects/{filename}",
            "width": image.width,
            "height": image.height,
            "alphaRange": list(image.getchannel("A").getextrema()),
            "bytes": target.stat().st_size,
            "source": {"serializedFile": obj.assets_file.name, "pathId": str(obj.path_id),
                       "sha256": hashlib.sha256(obj.get_raw_data()).hexdigest()},
            "pngSha256": hashlib.sha256(target.read_bytes()).hexdigest(),
        }

    # Inspect typed bindings before publishing a renderer descriptor; names alone
    # do not establish that a texture belongs to the Spotlight prefab.
    import importlib.util
    audit_spec = importlib.util.spec_from_file_location('light_audit', PROJECT_ROOT / 'scripts/audit-chibi-light-resources.py')
    audit = importlib.util.module_from_spec(audit_spec)
    audit_spec.loader.exec_module(audit)
    roots = [obj for obj in environment.objects
             if obj.type.name == 'GameObject' and obj.read().m_Name == 'LiveObjectSpotlight']
    if len(roots) != 1:
        raise ValueError('Ambiguous native Spotlight prefab')
    spotlight = spotlight_sprite_model(audit.inspect_prefab(roots[0]))
    backgrounds = [obj for obj in environment.objects
                   if obj.type.name == 'GameObject' and obj.read().m_Name == 'SpotlightBackground']
    if len(backgrounds) != 1:
        raise ValueError('Ambiguous native Spotlight background')
    background = spotlight_background_model(audit.inspect_prefab(backgrounds[0]))
    pin_roots = [obj for obj in environment.objects
                 if obj.type.name == 'GameObject' and obj.read().m_Name == 'LiveObjectPinspotlight']
    if len(pin_roots) != 1:
        raise ValueError('Ambiguous native Pinspotlight')
    pinspotlight = pinspotlight_sprite_model(audit.inspect_prefab(pin_roots[0]))
    suspension_roots = [obj for obj in environment.objects
                        if obj.type.name == 'GameObject' and obj.read().m_Name == 'LiveObjectNewSuspensionLight']
    if len(suspension_roots) != 1:
        raise ValueError('Ambiguous native new-suspension prefab')
    suspension = suspensionlight_model(audit.inspect_prefab(suspension_roots[0]))
    particle_spec = importlib.util.spec_from_file_location(
        'laser_particle_audit', PROJECT_ROOT / 'scripts/audit-live-chibi-stage-objects.py')
    particle_audit = importlib.util.module_from_spec(particle_spec)
    particle_spec.loader.exec_module(particle_audit)
    laser, _ = extract_laser_model(environment, particle_audit)
    spotbeam, _ = extract_spotbeam_model(environment, particle_audit)
    if assets['fx_in_ntalon_spotlight']['source']['pathId'] != '629':
        raise ValueError('Wrong native spotbeam atlas')
    character_shadow, _ = extract_character_shadow(environment)
    if assets[character_shadow['asset']]['source']['pathId'] != character_shadow['texturePathId']:
        raise ValueError('Wrong native character shadow texture')
    suspension_songs = {}
    stagelights, unsupported_prefabs = {}, {}
    native_names = set()
    for obj in environment.objects:
        if obj.type.name != 'GameObject': continue
        name = obj.read().m_Name
        if not name.startswith('fx_in_') or '_stagelight' not in name: continue
        prefab = audit.inspect_prefab(obj)
        if not any(c.get('scriptClass') == 'LiveObjectLightSpriteEffect' for c in prefab['components']): continue
        if name in native_names:
            stagelights.pop(name,None)
            unsupported_prefabs[name] = 'Ambiguous native prefab name; exact director binding pending'
            continue
        native_names.add(name)
        try: stagelights[name] = stagelight_model(prefab, allow_general=name not in STAGELIGHT_NAMES)
        except ValueError as error: unsupported_prefabs[name] = str(error)
    if not STAGELIGHT_NAMES <= stagelights.keys():
        raise ValueError('Incomplete native Take stage lamp set')
    stagelight_songs = {}
    for bundle in sorted((sources.raw_root / 'asset').glob('song_*.unity3d')):
        code = bundle.stem.removeprefix('song_')
        bundle_environment = UnityPy.load(str(bundle))
        for obj in bundle_environment.objects:
            if obj.type.name != 'TextAsset': continue
            script = obj.read()
            if '_live_effect' not in script.m_Name: continue
            payload = text_asset_payload(script)
            events = suspensionlight_events(payload)
            if not events: continue
            if script.m_Name in suspension_songs:
                raise ValueError('Ambiguous new-suspension track: ' + script.m_Name)
            track = {'events': events,
                'status': 'partial_reference_normal_show_unknown_controls_retained',
                'source': {'bundle': bundle.name, 'bundleSha256': sha256_file(bundle),
                           'serializedFile': obj.assets_file.name, 'pathId': str(obj.path_id),
                           'sha256': hashlib.sha256(payload).hexdigest()}}
            relative = f'new-suspension/{script.m_Name}.json'
            target = output_root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(json.dumps(track, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
            suspension_songs[script.m_Name] = {'file': f'stage-effects/{relative}',
                'eventCount': len(events), 'source': track['source'], 'status': track['status'],
                'unimplementedCommands': sum(e['command'] not in {
                    'NewSuspensionlight_create', 'NewSuspensionlight_normal_show'} for e in events)}
        scripts = [obj for obj in bundle_environment.objects
                   if obj.type.name == 'TextAsset' and obj.read().m_Name == f'{code}_live_effect']
        if not scripts: continue
        if len(scripts) != 1: raise ValueError('Ambiguous native choreography: ' + code)
        payload = text_asset_payload(scripts[0].read())
        events = stagelight_events(payload, native_names=native_names)
        if not events: continue
        # Retain unsupported commands and identities; never substitute static
        # white lamps for unrecovered rainbow/color/director modes.
        unknown = sorted({e['asset'] for e in events if not e['hide'] and e['asset'] not in stagelights})
        modes = sorted({(e['alphaMode'], e['colorMode']) for e in events if not e['hide']
                        and (e['alphaMode'] not in (0,1) or e['colorMode'] not in (1,2,5))},key=str)
        if code not in ('tkstp1','tkstp2'):
            for event in events:
                if not event['hide']:
                    event['previewSupported'] = event['asset'] in stagelights and event['alphaMode'] in (0,1) and event['colorMode'] in (1,2,5)
        stagelight_songs[code] = {'source': {'bundle': bundle.name, 'bundleSha256': sha256_file(bundle),
            'textAsset': f'{code}_live_effect', 'sha256': hashlib.sha256(payload).hexdigest()},
            'events': events, 'unsupportedAssets':unknown, 'unsupportedModes':modes,
            'status':'native_bindings_partial_recording_guided_envelopes'}
    for model in (spotlight, background, pinspotlight, suspension, *stagelights.values()):
        for layer in model['layers']:
            source = assets[layer['asset']]['source']
            if (source['serializedFile'], source['pathId']) != (model['serializedFile'], layer['texturePathId']):
                raise ValueError('Spotlight texture identity mismatch')

    index = {
        "schemaVersion": 7,
        "source": xapk.name,
        "unityDataSha256": hashlib.sha256(unity_data).hexdigest(),
        "assets": dict(sorted(assets.items())),
        "spotlight": spotlight,
        "spotlightBackground": background,
        "pinspotlight": pinspotlight,
        "newSuspensionlight": suspension,
        "laserlight": laser,
        "spotbeam": spotbeam,
        "characterShadow": character_shadow,
        "newSuspensionlightSongs": suspension_songs,
        "stagelights": dict(sorted(stagelights.items())),
        "stagelightSongs": stagelight_songs,
        "stagelightInventory": {"nativePrefabs":len(native_names), "renderablePrefabs":len(stagelights),
            "unsupportedPrefabs":unsupported_prefabs,"nativeTracks":len(stagelight_songs)},
    }
    index_target = output_root / "index.json"
    index_target.write_text(
        json.dumps(index, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"Prepared {len(assets)} built-in stage-effect textures from {xapk.name}")


if __name__ == "__main__":
    main()
