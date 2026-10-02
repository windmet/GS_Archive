"""Photo metadata and explicit group/cue joins; no runtime asset inference."""
from .named_schema import TABLE_IDS
from .domain_common import PHOTO_TABLES, clean, group

def build_photo(tables, fk, diagnostics):
    photo = {key: clean(tables.get(t, [])) for key, t in PHOTO_TABLES.items()}
    initial = {}
    initial_fields = {TABLE_IDS['InitialPhotoFilters']: ('filters', 'photoFilterId', TABLE_IDS['PhotoFilters']), TABLE_IDS['InitialPhotoStickers']: ('stickers', 'photoStickerId', TABLE_IDS['PhotoStickers']), TABLE_IDS['InitialPhotoSpots']: ('spots', 'photoSpotId', TABLE_IDS['PhotoSpots']), TABLE_IDS['InitialPhotoScenes']: ('scenes', 'photoSceneId', TABLE_IDS['PhotoScenes']), TABLE_IDS['InitialPhotoFrames']: ('frames', 'photoFrameId', TABLE_IDS['PhotoFrames'])}
    for t, (name, field, target) in initial_fields.items():
        initial[name] = clean(tables.get(t, []))
        for r in tables.get(t, []):
            fk(target, r.get(field, 0), f"{t}:{r['id']}.{field}")
    photo['initialGrants'] = initial
    scene_groups = group(tables.get(TABLE_IDS['PhotoScenes'], []), 'groupId')
    photo['sceneIdsBySpotId'] = {}
    for row in tables.get(TABLE_IDS['PhotoSpots'], []):
        matches = scene_groups.get(row.get('photoSceneGroupId', 0), [])
        photo['sceneIdsBySpotId'][str(row['id'])] = [r['id'] for r in matches]
        if not matches:
            diagnostics.append({'kind': 'missing-scene-group', 'spotId': row['id'], 'groupId': row.get('photoSceneGroupId', 0)})
    for t in (TABLE_IDS['PhotoFaces'], TABLE_IDS['PhotoPoses']):
        for r in tables.get(t, []):
            fk(TABLE_IDS['Idols'], r.get('idolId', 0), f"{t}:{r['id']}.idolId")
            fk(TABLE_IDS['StoryCostumes'], r.get('storyCostumeId', 0), f"{t}:{r['id']}.storyCostumeId", optional=True)
            if t == TABLE_IDS['PhotoPoses']:
                fk(TABLE_IDS['PhotoFaces'], r.get('defaultPhotoFaceId', 0), f"{t}:{r['id']}.defaultPhotoFaceId", optional=True)
    photo['voiceIdsByPoseId'] = {str(k): [r['id'] for r in v] for k, v in group(tables.get(TABLE_IDS['PhotoPoseVoices'], []), 'photoPoseId').items()}
    for r in tables.get(TABLE_IDS['PhotoPoseVoices'], []):
        fk(TABLE_IDS['PhotoPoses'], r.get('photoPoseId', 0), f"122:{r['id']}.photoPoseId")
    photo['uniqueVoiceCues'] = [{'cueSheetName': s, 'cueName': n} for s, n in sorted({(r.get('cueSheetName', ''), r.get('cueName', '')) for r in tables.get(TABLE_IDS['PhotoPoseVoices'], [])})]
    photo['mediaStatus'] = 'not-checked'
    photo['implementationStatus'] = 'catalog-only'
    photo['limits'] = ['No photo/filter shader parameters in these tables.', 'Animation/script/cue identifiers are not verified deployed assets.', 'Absent costume/default-face fields are NOT a verified fallback rule.', 'Initial grants are historical grants, NOT present user inventory.']
    return photo
